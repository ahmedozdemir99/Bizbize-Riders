-- Run after the application's base schema. No browser can read subscription secrets.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  group_ids text[] not null default '{}',
  blocked_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- Actor identity is set by PostgreSQL from the verified JWT, never trusted from JSON.
alter table public.messages add column if not exists push_actor_uid uuid;
alter table public.messages add column if not exists reply_preview jsonb;
alter table public.calls add column if not exists push_actor_uid uuid;
alter table public.group_calls add column if not exists push_actor_uid uuid;
alter table public.group_calls add column if not exists group_id text;

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('messages','calls','group_calls')),
  source_id text not null,
  event_type text not null,
  actor_uid uuid not null,
  expires_at timestamptz not null,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  unique(source_table,source_id,event_type)
);
create index if not exists push_outbox_due_idx on public.push_outbox(available_at) where not done;
create table if not exists public.push_deliveries (
  job_id uuid not null references public.push_outbox(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  attempts integer not null default 0,
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  available_at timestamptz not null default now(),
  primary key(job_id,subscription_id)
);
alter table public.push_outbox enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_outbox, public.push_deliveries from anon, authenticated;
grant all on public.push_outbox, public.push_deliveries to service_role;

create or replace function public.push_set_actor() returns trigger language plpgsql
set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'messages' then
      if new.sender_id is distinct from old.sender_id or new.recipient_id is distinct from old.recipient_id or new.group_id is distinct from old.group_id then
        raise exception 'message routing is immutable';
      end if;
    elsif tg_table_name = 'calls' then
      if new.caller_id is distinct from old.caller_id or new.callee_id is distinct from old.callee_id or new.created_at is distinct from old.created_at then
        raise exception 'call routing is immutable';
      end if;
    elsif tg_table_name = 'group_calls' then
      if new.host_id is distinct from old.host_id or new.group_id is distinct from old.group_id then
        raise exception 'group call routing is immutable';
      end if;
    end if;
  end if;
  new.push_actor_uid := auth.uid(); return new;
end $$;
create or replace function public.push_enqueue() returns trigger language plpgsql security definer
set search_path = '' as $$
declare event_name text; expires timestamptz; actor uuid := auth.uid();
begin
  if actor is null then return new; end if;
  if tg_table_name = 'messages' then
    if tg_op <> 'INSERT' or new.sender_id <> actor::text or new.deleted then return new; end if;
    event_name := 'message'; expires := now() + interval '24 hours';
  elsif tg_table_name = 'calls' then
    if actor::text not in (new.caller_id,new.callee_id) then return new; end if;
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    if tg_op = 'INSERT' and new.caller_id <> actor::text then return new; end if;
    if new.status = 'ringing' and tg_op = 'INSERT' then
      event_name := 'call'; expires := new.created_at + interval '45 seconds';
    elsif new.status in ('ended','rejected','missed') then
      event_name := 'call-ended'; expires := now() + interval '2 minutes';
    else return new; end if;
  elsif tg_table_name = 'group_calls' then
    if tg_op <> 'INSERT' or new.host_id <> actor::text or new.status <> 'active' or new.group_id is null then return new; end if;
    event_name := 'group-call'; expires := new.created_at + interval '45 seconds';
  end if;
  insert into public.push_outbox(source_table,source_id,event_type,actor_uid,expires_at)
  values(tg_table_name,new.id::text,event_name,actor,expires) on conflict do nothing;
  return new;
end $$;

drop trigger if exists push_actor on public.messages;
create trigger push_actor before insert or update on public.messages for each row execute function public.push_set_actor();
drop trigger if exists push_actor on public.calls;
create trigger push_actor before insert or update on public.calls for each row execute function public.push_set_actor();
drop trigger if exists push_actor on public.group_calls;
create trigger push_actor before insert or update on public.group_calls for each row execute function public.push_set_actor();
drop trigger if exists push_enqueue on public.messages;
create trigger push_enqueue after insert on public.messages for each row execute function public.push_enqueue();
drop trigger if exists push_enqueue on public.calls;
create trigger push_enqueue after insert or update on public.calls for each row execute function public.push_enqueue();
drop trigger if exists push_enqueue on public.group_calls;
create trigger push_enqueue after insert on public.group_calls for each row execute function public.push_enqueue();

create or replace function public.push_claim_job() returns setof public.push_outbox language plpgsql security definer
set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service role required'; end if;
  update public.push_outbox set done=true,locked_until=null where not done and expires_at<=now();
  return query update public.push_outbox set locked_until = now() + interval '90 seconds'
  where id in (select id from public.push_outbox where not done and available_at <= now()
    and (locked_until is null or locked_until < now()) order by case when event_type='message' then 1 else 0 end,created_at for update skip locked limit 1)
  returning *;
end $$;
revoke all on function public.push_claim_job() from public,anon,authenticated;
grant execute on function public.push_claim_job() to service_role;

-- Secrets are read only inside this definer function. The browser never sees them.
create or replace function public.push_wake_worker() returns void language plpgsql security definer
set search_path = '' as $$
declare target text; secret text;
begin
  if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') and pg_trigger_depth() = 0 then raise exception 'worker access denied'; end if;
  if not exists(select 1 from public.push_outbox where not done and available_at<=now() and expires_at>now() and (locked_until is null or locked_until<now())) then return; end if;
  select decrypted_secret into target from vault.decrypted_secrets where name='riders_push_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name='riders_push_worker_secret' limit 1;
  if target is null or secret is null then return; end if;
  perform net.http_post(url:=target,
    headers:=jsonb_build_object('Content-Type','application/json','x-push-worker-secret',secret),
    body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function public.push_wake_worker() from public,anon,authenticated;
grant execute on function public.push_wake_worker() to service_role;
create or replace function public.push_wake_after_enqueue() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  begin perform public.push_wake_worker(); exception when others then null; end;
  return new;
end $$;
drop trigger if exists push_wake on public.push_outbox;
create trigger push_wake after insert on public.push_outbox for each row execute function public.push_wake_after_enqueue();

-- Retry queue work after network/provider errors, even when the sending app is closed.
select cron.unschedule(jobid) from cron.job where jobname='riders-web-push';
select cron.schedule('riders-web-push','10 seconds',$$select public.push_wake_worker();$$);
select cron.unschedule(jobid) from cron.job where jobname='riders-web-push-cleanup';
select cron.schedule('riders-web-push-cleanup','17 3 * * *',
  $$delete from public.push_outbox where created_at < now() - interval '2 days';$$);

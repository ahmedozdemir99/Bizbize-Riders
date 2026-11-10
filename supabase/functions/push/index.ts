// Deno entrypoint. Secret keys exist only in Supabase Edge Function secrets.
import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {createHandler} from './http.ts';
import {repository} from './repository.ts';
import type {PushPayload,Subscription} from './core.ts';
const env=(name: string)=>Deno.env.get(name)||'';
const origin=env('APP_ORIGIN');
const required=['APP_ORIGIN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','PUSH_WORKER_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const configured=required.every(name=>!!env(name));
const db=createClient(env('SUPABASE_URL')||'https://unconfigured.invalid',env('SUPABASE_SERVICE_ROLE_KEY')||'unconfigured',{auth:{persistSession:false,autoRefreshToken:false}});
const checked=({data,error}: any)=>{if(error)throw new Error(error.code||'database_error');return data;};
const send=async(subscription: Subscription,payload: PushPayload,ttl: number)=>{
  const request=webpush.generateRequestDetails({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify(payload),{
    TTL:Math.max(1,Math.min(ttl,86400)),urgency:payload.type.includes('call')?'high':'normal',
    vapidDetails:{subject:env('VAPID_SUBJECT'),publicKey:env('VAPID_PUBLIC_KEY'),privateKey:env('VAPID_PRIVATE_KEY')}
  });
  const response=await fetch(request.endpoint,{method:'POST',headers:request.headers,body:new Uint8Array(request.body),redirect:'error',signal:AbortSignal.timeout(5000)});
  return response.status;
};
const handler=createHandler({origin,publicKey:env('VAPID_PUBLIC_KEY'),workerSecret:env('PUSH_WORKER_SECRET'),repo:repository(db),send,
 async authenticate(token){const {data,error}=await db.auth.getUser(token);return error?null:data.user?.id||null;},
 async save(userId,subscription,groupIds,blockedIds){
   const existing=checked(await db.from('push_subscriptions').select('id,user_id').eq('endpoint',subscription.endpoint).maybeSingle());
   if(existing&&existing.user_id!==userId)throw new Error('subscription_owned_by_another_user');
   if(!existing){const {count,error}=await db.from('push_subscriptions').select('id',{count:'exact',head:true}).eq('user_id',userId);if(error)throw error;if((count||0)>=5)throw new Error('subscription_limit');}
   const row={...subscription,user_id:userId,group_ids:groupIds,blocked_ids:blockedIds,updated_at:new Date().toISOString()};
   // Never reassign an existing endpoint to a different account, including races.
   if(existing){checked(await db.from('push_subscriptions').update(row).eq('id',existing.id).eq('user_id',userId));return existing.id;}
   return checked(await db.from('push_subscriptions').insert(row).select('id').single()).id;
 },
 async remove(userId,endpoint){checked(await db.from('push_subscriptions').delete().eq('user_id',userId).eq('endpoint',endpoint));},
 async own(userId,endpoint){return checked(await db.from('push_subscriptions').select('*').eq('user_id',userId).eq('endpoint',endpoint).maybeSingle());},
 async preferences(userId,endpoint,groupIds,blockedIds){checked(await db.from('push_subscriptions').update({group_ids:groupIds,blocked_ids:blockedIds}).eq('user_id',userId).eq('endpoint',endpoint));}
});
Deno.serve(request=>configured?handler(request):new Response(JSON.stringify({error:'push_not_configured'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}}));

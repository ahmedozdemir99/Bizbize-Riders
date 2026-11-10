export type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
export type Job = { id: string; source_table: string; source_id: string; event_type: string; actor_uid: string; expires_at: string; created_at: string };
export type PushPayload = { type: string; eventId: string; eventAt: number; title: string; body: string; callId?: string; groupCallId?: string; chatId?: string; expiresAt?: number };

export function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash) return false;
    return url.hostname === 'fcm.googleapis.com' || url.hostname === 'web.push.apple.com' ||
      url.hostname === 'updates.push.services.mozilla.com' || url.hostname.endsWith('.push.services.mozilla.com') ||
      url.hostname.endsWith('.notify.windows.com') || url.hostname.endsWith('.push.apple.com');
  } catch { return false; }
}
export function validateSubscription(value: any) {
  if (!value || !validEndpoint(value.endpoint) || typeof value.keys?.p256dh !== 'string' || typeof value.keys?.auth !== 'string') throw new Error('invalid_subscription');
  const decode = (text: string) => {
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(text)) return -1;
    try { return atob(text.replace(/-/g,'+').replace(/_/g,'/')).length; } catch { return -1; }
  };
  if (decode(value.keys.p256dh) !== 65 || decode(value.keys.auth) !== 16) throw new Error('invalid_subscription_keys');
  return { endpoint:value.endpoint as string, p256dh:value.keys.p256dh as string, auth:value.keys.auth as string };
}
export function groupPreferences(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !id || id.length > 200)) throw new Error('invalid_preferences');
  return [...new Set(value)];
}
export function makePayload(job: Job, row: any, now: number): PushPayload | null {
  if (!row || now >= Date.parse(job.expires_at)) return null;
  const base = {eventId:job.id,eventAt:Date.parse(job.created_at),expiresAt:Date.parse(job.expires_at)};
  if (job.event_type === 'message') {
    if (row.deleted || row.sender_id !== job.actor_uid) return null;
    return {...base,type:'message',title:'BizBize Riders',body:'Yeni mesajınız var.',chatId:row.group_id};
  }
  if (job.event_type === 'call') {
    if (row.status !== 'ringing' || row.caller_id !== job.actor_uid) return null;
    return {...base,type:'call',title:row.type==='video'?'Gelen görüntülü arama':'Gelen sesli arama',body:'Bir sürücü sizi arıyor.',callId:row.id};
  }
  if (job.event_type === 'call-ended') {
    if (!['ended','rejected','missed'].includes(row.status) || ![row.caller_id,row.callee_id].includes(job.actor_uid)) return null;
    return {...base,type:'call-ended',title:row.status==='missed'?'Cevapsız arama':'Arama sonlandı',body:'Arama geçmişini görmek için dokunun.',callId:row.id};
  }
  if (job.event_type === 'group-call' && row.status==='active' && row.host_id===job.actor_uid && row.group_id) {
    return {...base,type:'group-call',title:'Kortej araması',body:'Katılmak için dokunun.',groupCallId:row.id,chatId:row.group_id};
  }
  return null;
}

export interface PushRepository {
  claimJob(): Promise<Job | null>;
  getSource(job: Job): Promise<any>;
  prepareDeliveries(job: Job, row: any): Promise<void>;
  dueDeliveries(job: Job): Promise<Array<{subscription: Subscription; attempts: number}>>;
  sent(job: Job, subscription: Subscription): Promise<void>;
  failed(job: Job, subscription: Subscription, attempts: number, permanent: boolean): Promise<void>;
  removeSubscription(id: string): Promise<void>;
  pending(job: Job): Promise<boolean>;
  finish(job: Job): Promise<void>;
  release(job: Job): Promise<void>;
}
export async function dispatchOne(repo: PushRepository, send: (subscription: Subscription, payload: PushPayload, ttl: number) => Promise<number>, now = Date.now) {
  const job = await repo.claimJob();
  if (!job) return {processed:0};
  try {
    const row = await repo.getSource(job);
    const payload = makePayload(job,row,now());
    if (!payload) { await repo.finish(job); return {processed:1,expired:true}; }
    await repo.prepareDeliveries(job,row);
    const deliveries = await repo.dueDeliveries(job);
    let sent = 0;
    // Bounded batches fit within the job lease. Successful deliveries never retry.
    for (let start=0; start<deliveries.length; start+=10) {
      await Promise.all(deliveries.slice(start,start+10).map(async ({subscription,attempts}) => {
        const ttl = Math.ceil((Date.parse(job.expires_at)-now())/1000);
        if (ttl <= 0) return;
        try {
          const status = await send(subscription,payload,ttl);
          if (status >= 200 && status < 300) { await repo.sent(job,subscription); sent++; return; }
          if (status === 404 || status === 410) { await repo.removeSubscription(subscription.id); return; }
          await repo.failed(job,subscription,attempts+1,(status>=400 && status<500 && status!==408 && status!==429) || attempts>=4);
        } catch { await repo.failed(job,subscription,attempts+1,attempts>=4); }
      }));
    }
    if (now() >= Date.parse(job.expires_at) || !await repo.pending(job)) await repo.finish(job);
    else await repo.release(job);
    return {processed:1,sent};
  } catch (error) { await repo.release(job); throw error; }
}

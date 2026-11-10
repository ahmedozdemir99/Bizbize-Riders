import type { Job, PushRepository, Subscription } from './core.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function repository(db: any): PushRepository {
  const checked = ({data,error}: any) => { if (error) throw new Error(error.code || 'database_error'); return data; };
  return {
    async claimJob() { return checked(await db.rpc('push_claim_job'))?.[0] || null; },
    async getSource(job) { return checked(await db.from(job.source_table).select('*').eq('id',job.source_id).maybeSingle()); },
    async prepareDeliveries(job,row) {
      let query = db.from('push_subscriptions').select('id').neq('user_id',job.actor_uid).not('blocked_ids','cs',`{${job.actor_uid}}`);
      const recipient = job.source_table==='calls' ? row.callee_id : row.recipient_id;
      if (recipient) {
        if (!uuid.test(recipient)) return;
        query = query.eq('user_id',recipient);
      } else {
        const group = row.group_id;
        if (!group || group.startsWith('dm_')) return;
        query = query.contains('group_ids',[group]);
      }
      // Keyset pagination avoids silently dropping users beyond PostgREST's page size.
      let cursor = '';
      for (;;) {
        let page = query.order('id').limit(500);
        if (cursor) page = page.gt('id',cursor);
        const rows = checked(await page) || [];
        if (rows.length) checked(await db.from('push_deliveries').upsert(rows.map((s: any)=>({job_id:job.id,subscription_id:s.id})),{onConflict:'job_id,subscription_id',ignoreDuplicates:true}));
        if (rows.length<500) break;
        cursor = rows.at(-1).id;
      }
    },
    async dueDeliveries(job) {
      const rows = checked(await db.from('push_deliveries').select('attempts,subscription:push_subscriptions(*)').eq('job_id',job.id).eq('status','pending').lte('available_at',new Date().toISOString()).limit(50)) || [];
      return rows.filter((r: any)=>r.subscription).map((r: any)=>({subscription:r.subscription,attempts:r.attempts}));
    },
    async sent(job,s) { checked(await db.from('push_deliveries').update({status:'sent'}).eq('job_id',job.id).eq('subscription_id',s.id)); },
    async failed(job,s,attempts,permanent) { checked(await db.from('push_deliveries').update({attempts,status:permanent?'failed':'pending',available_at:new Date(Date.now()+Math.min(60000,2**attempts*1000)).toISOString()}).eq('job_id',job.id).eq('subscription_id',s.id)); },
    async removeSubscription(id) { checked(await db.from('push_subscriptions').delete().eq('id',id)); },
    async pending(job) { return !!checked(await db.from('push_deliveries').select('subscription_id').eq('job_id',job.id).eq('status','pending').limit(1))?.length; },
    async finish(job) { checked(await db.from('push_outbox').update({done:true,locked_until:null}).eq('id',job.id)); },
    async release(job) { checked(await db.from('push_outbox').update({locked_until:null,available_at:new Date(Date.now()+2000).toISOString()}).eq('id',job.id)); }
  };
}

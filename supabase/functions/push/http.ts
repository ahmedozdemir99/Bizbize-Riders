import { dispatchOne, groupPreferences, validateSubscription, type PushPayload, type Subscription, type PushRepository } from './core.ts';
export interface Gateway {
  origin: string; publicKey: string; workerSecret: string;
  authenticate(token: string): Promise<string | null>;
  save(userId: string, subscription: ReturnType<typeof validateSubscription>, groups: string[], blocked: string[]): Promise<string>;
  remove(userId: string, endpoint: string): Promise<void>;
  own(userId: string, endpoint: string): Promise<Subscription | null>;
  preferences(userId: string, endpoint: string, groups: string[], blocked: string[]): Promise<void>;
  send(subscription: Subscription, payload: PushPayload, ttl: number): Promise<number>;
  repo: PushRepository;
}
async function sameSecret(a: string,b: string) {
  const digest = (value: string) => crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  const [x,y] = await Promise.all([digest(a),digest(b)]);
  const aa = new Uint8Array(x), bb = new Uint8Array(y); let difference=0;
  for (let i=0;i<aa.length;i++) difference|=aa[i]^bb[i];
  return difference===0;
}
export function createHandler(gateway: Gateway) {
  const allowedOrigins = new Set(gateway.origin.split(',').map(origin => origin.trim()).filter(Boolean));
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const allowed = origin !== null && allowedOrigins.has(origin);
    const headers = {'content-type':'application/json','cache-control':'no-store',vary:'Origin',
      ...(allowed ? {'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type'} : {})};
    const reply=(status: number,body: unknown)=>new Response(JSON.stringify(body),{status,headers});
    if (origin && !allowed) return reply(403,{error:'origin_not_allowed'});
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if (request.method==='GET') return reply(200,{publicKey:gateway.publicKey});
    if (request.method!=='POST') return reply(405,{error:'method_not_allowed'});
    try {
      if (Number(request.headers.get('content-length')||0)>16384) return reply(413,{error:'request_too_large'});
      const text=await request.text(); if (new TextEncoder().encode(text).length>16384) return reply(413,{error:'request_too_large'});
      const body=JSON.parse(text);
      if (body.action==='dispatch') {
        if (!gateway.workerSecret || !await sameSecret(request.headers.get('x-push-worker-secret')||'',gateway.workerSecret)) return reply(401,{error:'unauthorized_worker'});
        return reply(200,await dispatchOne(gateway.repo,gateway.send));
      }
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
      const userId = token ? await gateway.authenticate(token) : null;
      if (!userId) return reply(401,{error:'authentication_required'});
      if (body.action==='subscribe') {
        const subscription = validateSubscription(body.subscription);
        const id = await gateway.save(userId,subscription,groupPreferences(body.groupIds || []),groupPreferences(body.blockedIds || []));
        return reply(200,{id,userId,subscribed:true});
      }
      if (body.action==='unsubscribe') {
        if (typeof body.endpoint!=='string') return reply(400,{error:'invalid_endpoint'});
        await gateway.remove(userId,body.endpoint); return reply(200,{subscribed:false});
      }
      if (body.action==='preferences') {
        await gateway.preferences(userId,body.endpoint,groupPreferences(body.groupIds||[]),groupPreferences(body.blockedIds||[])); return reply(200,{updated:true});
      }
      if (body.action==='status') {
        const subscription=await gateway.own(userId,body.endpoint);
        return reply(200,{subscribed:!!subscription,userId});
      }
      if (body.action==='test') {
        const subscription=await gateway.own(userId,body.endpoint);
        if (!subscription) return reply(404,{error:'subscription_not_found'});
        const status=await gateway.send(subscription,{type:'message',eventId:crypto.randomUUID(),eventAt:Date.now(),title:'Bildirim denemesi',body:'Web Push gönderimi çalışıyor.',chatId:'global',expiresAt:Date.now()+60000},60);
        if (status === 404 || status === 410) {
          await gateway.remove(userId, subscription.endpoint);
          return reply(410,{error:'subscription_expired'});
        }
        return reply(status>=200&&status<300?200:502,{accepted:status>=200&&status<300});
      }
      return reply(400,{error:'unknown_action'});
    } catch (error) {
      const message=error instanceof Error?error.message:'';
      if (message==='subscription_owned_by_another_user') return reply(409,{error:message});
      if (message==='subscription_limit') return reply(429,{error:message});
      if (error instanceof SyntaxError || message.startsWith('invalid_')) return reply(400,{error:'invalid_request'});
      console.error('Push request failed'); return reply(503,{error:'push_service_unavailable'});
    }
  };
}

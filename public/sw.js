self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
let pushChain=Promise.resolve();

async function showPush(raw){
  if(!raw||typeof raw!=='object')return;
  let data={...raw};
  const callId=typeof data.callId==='string'?data.callId:null;
  const groupCallId=typeof data.groupCallId==='string'?data.groupCallId:null;
  const id=callId||groupCallId;
  const expire = payload => {
    if ((payload.type === 'call' || payload.type === 'group-call') &&
        (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now())) {
      return {...payload, type:'call-ended', title:'Cevapsız arama', body:'Bu aramanın süresi doldu.'};
    }
    return payload;
  };
  data = expire(data);
  let stale=false;
  if(id&&self.caches){
    try{
      const cache=await caches.open('riders-push-state-v1');
      const key=new URL('/__push_state__/'+encodeURIComponent(id),self.location.origin).href;
      const previous=await cache.match(key);const saved=previous?await previous.json():null;
      if(saved&&((saved.type==='call-ended'&&data.type!=='call-ended')||(saved.eventAt||0)>(data.eventAt||0)||(saved.type===data.type&&saved.eventId&&saved.eventId===data.eventId))){data=saved;stale=true;}
      else await cache.put(key,new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}}));
      const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-128)))await cache.delete(old);
    }catch{/* Notification delivery must not depend on cache availability. */}
  }
  // Check expiry after replay protection too: cached ringing payloads can expire.
  data = expire(data);
  const ringing=data.type==='call'||data.type==='group-call';
  const terminal=data.type==='call-ended';
  const tag=id?`call:${id}`:`chat:${data.chatId||'messages'}${typeof data.eventId==='string' ? ':'+data.eventId : ''}`;
  await self.registration.showNotification(data.title||(ringing?'Gelen arama':'BizBize Riders'),{
    body:data.body||(ringing?'Bir sürücü sizi arıyor.':'Yeni mesajınız var.'),icon:'/logo.png',badge:'/logo.png',tag,
    requireInteraction:ringing,renotify:false,silent:terminal||stale,
    ...(!(terminal||stale)?{vibrate:ringing?[250,150,250,150,250]:[150]}:{}),
    data:{type:data.type,callId,groupCallId,chatId:typeof data.chatId==='string'?data.chatId:null,expiresAt:data.expiresAt},
    actions:ringing?[{action:'open',title:'Aramayı aç'},...(callId?[{action:'reject',title:'Reddet'}]:[])]:[{action:'open',title:terminal?'Aramayı görüntüle':'Sohbeti aç'}]
  });
}
self.addEventListener('push',event=>{
  let data;try{data=event.data?.json();}catch{return;}
  pushChain=pushChain.catch(()=>{}).then(()=>showPush(data));event.waitUntil(pushChain);
});
self.addEventListener('pushsubscriptionchange',event=>{
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>Promise.all(clients.map(client=>client.postMessage({type:'PUSH_SUBSCRIPTION_CHANGED'})))));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const data=event.notification.data||{};
    const intent={type:'NOTIFICATION_INTENT',callId:data.callId,groupCallId:data.groupCallId,chatId:data.chatId,action:event.action==='reject'?'reject':'open'};
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const scope = self.registration.scope || self.location.origin + '/';
    const url = new URL(scope);
    if(typeof data.callId==='string')url.searchParams.set('call',data.callId);
    if(typeof data.groupCallId==='string')url.searchParams.set('groupCall',data.groupCallId);
    if(typeof data.chatId==='string')url.searchParams.set('chat',data.chatId);
    url.searchParams.set('action',intent.action);
    const client = windows.find(window => window.url.startsWith(scope));
    if (client) {
      try {
        await client.focus();
        const handled = await new Promise(resolve => {
          const channel = new MessageChannel();
          const finish = value => {
            clearTimeout(timer);
            channel.port1.close();
            resolve(value);
          };
          const timer = setTimeout(() => finish(false), 750);
          channel.port1.onmessage = event => finish(event.data === true);
          try { client.postMessage(intent, [channel.port2]); }
          catch { channel.port2.close(); finish(false); }
        });
        if (handled) return;
        const navigated = await client.navigate(url.href);
        if (navigated) return;
      } catch { /* The client can close while handling the notification. */ }
    }
    await self.clients.openWindow(url.href);
  })());
});

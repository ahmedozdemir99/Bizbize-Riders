// Foreground application and native wrapper share this notification payload contract.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    if (!data || typeof data !== 'object') return;
    const callId = typeof data.callId === 'string' ? data.callId : null;
    if (data.type === 'call-ended' && callId) {
      for (const notification of await self.registration.getNotifications({tag:`call:${callId}`})) notification.close();
      return;
    }
    const call = data.type === 'call' && callId;
    if (call && (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now())) return;
    await self.registration.showNotification(data.title || (call ? 'Gelen arama' : 'BizBize Riders'), {
      body:data.body || (call ? 'Bir sürücü sizi arıyor.' : 'Yeni mesajınız var.'), icon:'/logo.png', badge:'/logo.png',
      tag:call ? `call:${callId}` : `chat:${data.chatId || 'messages'}`, requireInteraction:!!call,
      vibrate:call ? [250,150,250,150,250] : [150],
      data:{type:call?'call':'message',callId,chatId:typeof data.chatId==='string'?data.chatId:null,expiresAt:data.expiresAt},
      actions:call ? [{action:'open',title:'Aramayı aç'},{action:'reject',title:'Reddet'}] : [{action:'open',title:'Sohbeti aç'}]
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    const intent = {type:'NOTIFICATION_INTENT',callId:data.callId,chatId:data.chatId,action:event.action==='reject'?'reject':'open'};
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (client) { client.postMessage(intent); await client.focus(); return; }
    const url = new URL('/',self.location.origin);
    if (typeof data.callId === 'string') url.searchParams.set('call',data.callId);
    if (typeof data.chatId === 'string') url.searchParams.set('chat',data.chatId);
    url.searchParams.set('action',intent.action);
    await self.clients.openWindow(url.href);
  })());
});

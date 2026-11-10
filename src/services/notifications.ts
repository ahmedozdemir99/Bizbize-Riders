import type { CallRecord } from '../types';

export type NotificationIntent = { callId?: string; chatId?: string; action?: 'open' | 'reject' };

declare global {
  interface Window {
    // Optional adapter implemented by the native app, not an Appmint built-in API.
    BizBizeNotifications?: {
      requestPermission: () => Promise<'granted' | 'denied'>;
      showIncomingCall: (call: { callId: string; callerName: string; video: boolean; expiresAt: number }) => Promise<void>;
      dismissCall: (callId: string) => Promise<void>;
    };
  }
}

const shown = new Set<string>();
export async function notifyIncomingCall(call: CallRecord) {
  const expiresAt = new Date(call.created_at).getTime() + 45000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || shown.has(call.id)) return;
  shown.add(call.id);
  try {
    if (window.BizBizeNotifications) {
      await window.BizBizeNotifications.showIncomingCall({callId:call.id,callerName:call.caller_name,video:call.type==='video',expiresAt}); return;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = `Gelen ${call.type === 'video' ? 'görüntülü' : 'sesli'} arama`;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body:`${call.caller_name} sizi arıyor`, tag:`call:${call.id}`,
        icon:'/logo.png', requireInteraction:true, data:{type:'call',callId:call.id,expiresAt},
        actions:[{action:'open',title:'Aramayı aç'},{action:'reject',title:'Reddet'}] } as NotificationOptions);
    } else {
      const notification = new Notification(title, {body:`${call.caller_name} sizi arıyor`,tag:`call:${call.id}`});
      notification.onclick = () => { window.focus(); window.dispatchEvent(new CustomEvent('bizbize:notification', {detail:{callId:call.id,action:'open'}})); notification.close(); };
    }
  } catch (error) { shown.delete(call.id); console.warn('Incoming call notification:',error); }
}

export async function dismissCallNotification(callId: string) {
  try {
    await window.BizBizeNotifications?.dismissCall(callId);
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      for (const notification of await registration?.getNotifications({tag:`call:${callId}`}) || []) notification.close();
    }
  } catch (error) { console.warn('Notification dismissal:',error); }
}

export async function enableNotifications(): Promise<string> {
  if (window.BizBizeNotifications) {
    const permission = await window.BizBizeNotifications.requestPermission();
    return permission === 'granted' ? 'Yerel bildirim izni verildi. Kilit ekranı teslimatı paketin FCM kurulumuna bağlıdır.' : 'Bildirim izni verilmedi.';
  }
  if (!('Notification' in window)) return 'Bu tarayıcı bildirimleri desteklemiyor. iPhone’da uygulamayı ana ekrana yüklemek gerekebilir.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'Bildirim izni verilmedi. Tarayıcı ayarlarından değiştirebilirsiniz.';
  return 'Bildirim izni verildi. Uygulama kapalıyken teslimat için Web Push veya Appmint FCM kurulumu henüz gerekli.';
}

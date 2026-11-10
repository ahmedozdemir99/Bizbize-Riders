import { getDeviceId, getStoredSupabaseConfig, getSupabaseClient } from './supabase';
export type PushState = 'off' | 'enabled' | 'blocked' | 'unsupported' | 'install' | 'setup' | 'repair';
const flag='rider_web_push_enabled';
const gatewayUrl=()=>getStoredSupabaseConfig().url.replace(/\/$/,'')+'/functions/v1/push';
export function iosNeedsInstall() {
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  return ios && !matchMedia('(display-mode: standalone)').matches && !(navigator as Navigator & {standalone?:boolean}).standalone;
}
export function supportsWebPush() { return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function decodeKey(value:string) {
  const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(bytes.length!==65||bytes[0]!==4)throw new Error('Sunucunun bildirim anahtarı geçersiz.');return bytes;
}
async function config() {
  const response=await fetch(gatewayUrl(),{headers:{apikey:getStoredSupabaseConfig().key},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Supabase bildirim fonksiyonu henüz kurulmamış veya yapılandırılmamış.');
  const body=await response.json();if(typeof body.publicKey!=='string')throw new Error('Bildirim sunucusu yanıtı geçersiz.');return body;
}
async function api(action:string,body:Record<string,unknown>={}) {
  const client=getSupabaseClient();if(!client)throw new Error('Supabase bağlantısı gerekli.');
  const {data,error}=await client.auth.getSession();
  if(error||!data.session)throw new Error('Bildirim oturumu bulunamadı. Bildirimleri tekrar açın.');
  const response=await fetch(gatewayUrl(),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${data.session.access_token}`,apikey:getStoredSupabaseConfig().key},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error==='subscription_owned_by_another_user'?'Bu tarayıcı aboneliği eski bir oturuma ait. Bildirimleri kapatıp tekrar açın.':result.error==='authentication_required'?'Bildirim oturumu doğrulanamadı.': 'Bildirim sunucusu işlemi tamamlayamadı. Kurulumu ve bağlantıyı kontrol edin.');
  return result;
}
async function registration() {
  const worker=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL});
  await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Bildirim çalışanı başlatılamadı. Yayımlanmış uygulama bağlantısını açın.')),10000))]);
  return worker;
}
export async function getWebPushState():Promise<PushState> {
  if(iosNeedsInstall())return 'install';
  if(!supportsWebPush())return 'unsupported';
  if(Notification.permission==='denied')return 'blocked';
  if(localStorage.getItem(flag)!=='true')return 'off';
  const worker=await navigator.serviceWorker.getRegistration();const subscription=await worker?.pushManager.getSubscription();
  if(!subscription||Notification.permission!=='granted')return 'repair';
  try {const result=await api('status',{endpoint:subscription.endpoint});return result.subscribed?'enabled':'repair';}
  catch{return 'setup';}
}
export async function enableWebPush(groupIds:string[],blockedIds:string[]) {
  if(iosNeedsInstall())throw new Error('iPhone’da Safari paylaş menüsünden Ana Ekrana Ekle’yi seçin, ardından uygulamayı o simgeden açın. iOS 16.4 veya üzeri gerekir.');
  if(!supportsWebPush())throw new Error('Web Push için HTTPS üzerinden yayımlanmış, desteklenen bir tarayıcı gerekli.');
  if(window.top!==window.self)throw new Error('Bildirimleri AI Studio önizlemesinde değil, yayımlanmış uygulama bağlantısında ayrı bir sekmede açın.');
  // Keep the permission request directly in the user's click gesture (iOS requirement).
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Bildirim izni verilmedi. Tarayıcı/site ayarlarından izin verin.');
  const settings=await config();
  const client=getSupabaseClient();if(!client)throw new Error('Supabase bağlantısı gerekli.');
  let session=(await client.auth.getSession()).data.session;
  if(!session){const result=await client.auth.signInAnonymously();if(result.error||!result.data.session)throw new Error('Supabase Authentication → Providers bölümünde Anonymous Sign-Ins açılmalı.');session=result.data.session;}
  const worker=await registration();const key=decodeKey(settings.publicKey);
  let subscription=await worker.pushManager.getSubscription();
  if(subscription){
    const existing=subscription.options.applicationServerKey;
    if(!existing||new Uint8Array(existing).some((byte,index)=>byte!==key[index])||existing.byteLength!==key.length){await subscription.unsubscribe();subscription=null;}
  }
  if(!subscription)subscription=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await api('subscribe',{subscription:subscription.toJSON(),groupIds,blockedIds});
  localStorage.setItem(flag,'true');localStorage.setItem('rider_push_groups',JSON.stringify(groupIds));
  const previous=getDeviceId(),next=session.user.id;
  if(previous!==next){
    const aliases:string[]=JSON.parse(localStorage.getItem('rider_legacy_device_ids')||'[]');
    localStorage.setItem('rider_legacy_device_ids',JSON.stringify([...new Set([...aliases,previous])]));
    localStorage.setItem('rider_device_id',next);
    localStorage.setItem('rider_push_identity_notice','true');
    window.dispatchEvent(new Event('rider:identity-changed'));
  }
  return {enabled:true,identityChanged:previous!==next};
}
export async function disableWebPush() {
  const worker=await navigator.serviceWorker.getRegistration();const subscription=await worker?.pushManager.getSubscription();
  let serverRemoved=true;
  if(subscription){try{await api('unsubscribe',{endpoint:subscription.endpoint});}catch{serverRemoved=false;}await subscription.unsubscribe();}
  localStorage.removeItem(flag);return {serverRemoved};
}
export async function testWebPush() {
  const worker=await navigator.serviceWorker.getRegistration();const subscription=await worker?.pushManager.getSubscription();
  if(!subscription)throw new Error('Önce bildirimleri açın.');return api('test',{endpoint:subscription.endpoint});
}
export async function syncPushPreferences(groupIds:string[],blockedIds:string[]) {
  if(localStorage.getItem(flag)!=='true'||!supportsWebPush())return;
  const worker=await navigator.serviceWorker.getRegistration();const subscription=await worker?.pushManager.getSubscription();
  if(subscription)await api('preferences',{endpoint:subscription.endpoint,groupIds,blockedIds});
}
export function getOwnRiderIds():string[] {
  try{return [getDeviceId(),...JSON.parse(localStorage.getItem('rider_legacy_device_ids')||'[]')];}catch{return [getDeviceId()];}
}

import {useEffect,useState} from 'react';
import {X,Bell} from 'lucide-react';
import {disableWebPush,enableWebPush,getWebPushState,testWebPush,type PushState} from '../../services/webPush';
const labels:Record<PushState,string>={off:'Bildirimler kapalı',enabled:'Sunucu aboneliği etkin',blocked:'Tarayıcı bildirim izni engellenmiş',unsupported:'Bu tarayıcı Web Push desteklemiyor',install:'iPhone’da ana ekrandan açılmalı',setup:'Sunucu bağlantısı veya kurulumu kontrol edilmeli',repair:'Abonelik yenilenmeli'};
export function NotificationSettingsModal({isOpen,onClose,groupIds,blockedIds}:{isOpen:boolean;onClose:()=>void;groupIds:string[];blockedIds:string[]}){
 const [state,setState]=useState<PushState>('off'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [groups,setGroups]=useState(()=>{try{return JSON.parse(localStorage.getItem('rider_push_groups')||'[]').length>0;}catch{return false;}});
 useEffect(()=>{if(!isOpen)return;let alive=true;void getWebPushState().then(value=>{if(alive)setState(value);});return()=>{alive=false;};},[isOpen]);
 if(!isOpen)return null;
 const run=async(task:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await task();}catch(error:any){setMessage(error.message||'İşlem tamamlanamadı.');}finally{setBusy(false);}};
 return <div className="fixed inset-0 z-[650] bg-black/85 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="push-title">
  <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-3xl p-5 space-y-4">
   <div className="flex items-center justify-between"><h2 id="push-title" className="text-lg font-bold flex gap-2 items-center"><Bell className="w-5 h-5 text-orange-500"/>Bildirim Ayarları</h2><button onClick={onClose} aria-label="Bildirim ayarlarını kapat"><X/></button></div>
   <p role="status" className="text-sm text-orange-300">{labels[state]}</p>
   <p className="text-sm text-zinc-300">Uygulama kapalıyken gelen bildirime dokununca arama kabul ekranı açılır. Telefon araması gibi kendiliğinden tam ekran açılmaz.</p>
   {state==='install'&&<p className="text-sm text-amber-300">iOS 16.4+: Safari → Paylaş → Ana Ekrana Ekle. Uygulamayı eklenen simgeden açıp burada izin verin.</p>}
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={groups} onChange={event=>setGroups(event.target.checked)}/>Kortej mesaj ve arama bildirimlerini de al</label>
   <p className="text-xs text-zinc-400">İlk açılışta şifresiz, doğrulanmış bir sürücü kimliği oluşturulur. ID’niz değişirse iki telefonda da Profil Ayarları’ndaki yeni ID’lerle birbirinizi yeniden ekleyin. Eski sohbet geçmişi cihazda kalır.</p>
   <button disabled={busy||state==='unsupported'||state==='install'} className="w-full bg-orange-600 disabled:opacity-40 rounded-xl py-3 font-bold" onClick={()=>void run(async()=>{const result=await enableWebPush(groups?groupIds:[],blockedIds);setState('enabled');setMessage(result.identityChanged?'Bildirimler açıldı. Profilinizdeki yeni sürücü ID’sini paylaşın.':'Bildirimler açıldı ve abonelik doğrulandı.');})}>{busy?'İşlem sürüyor…':state==='enabled'?'Aboneliği / tercihleri güncelle':'Bildirimleri aç'}</button>
   <button disabled={busy||state!=='enabled'} className="w-full rounded-xl border border-zinc-600 py-3 disabled:opacity-40" onClick={()=>void run(async()=>{const result=await testWebPush();setMessage(result.accepted?'Test bildirimi gönderim servisine iletildi. Kilit ekranında görünmesini telefonunuzda kontrol edin.':'Test gönderilemedi.');})}>Test bildirimi gönder</button>
   <button disabled={busy} className="w-full text-zinc-400 py-2" onClick={()=>void run(async()=>{const result=await disableWebPush();setState('off');setMessage(result.serverRemoved?'Cihaz ve sunucu aboneliği kapatıldı.':'Cihaz aboneliği kapatıldı. Sunucuya ulaşılamadı; eski kayıt geçersiz uç nokta temizliğinde kaldırılır.');})}>Bildirimleri kapat</button>
   {message&&<p role="alert" className="text-sm text-zinc-200 break-words">{message}</p>}
   <p className="text-xs text-zinc-500">“Etkin” aboneliğin kayıtlı olduğunu gösterir. Gerçek kilit ekranı teslimatı; internet, işletim sistemi ayarları ve push sağlayıcısına bağlıdır.</p>
  </div>
 </div>;
}

// Uses a private in-memory REST fixture; never writes to the production database.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_URL || 'http://localhost:3000';
const db = { profiles: [], rider_groups: [], messages: [], calls: [], call_signals: [], group_calls: [], group_call_members: [], group_call_signals: [] };
let seq = 0, delayNextMessages = false, failMessages = false;
function matches(row, params) {
  for (const [key, expression] of params) {
    const [op, ...rest] = expression.split('.'); const value = rest.join('.');
    if (op === 'eq' && String(row[key]) !== value) return false;
    if (op === 'neq' && String(row[key]) === value) return false;
    if (op === 'gte' && String(row[key]) < value) return false;
    if (op === 'is' && value === 'null' && row[key] != null) return false;
  }
  return true;
}
async function mock(route) {
  const req = route.request(), url = new URL(req.url());
  if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
  const table = url.pathname.split('/').pop(), rows = db[table];
  if (!rows) throw new Error('Unexpected table: ' + table);
  if (req.method() === 'OPTIONS') return route.fulfill({status:204});
  if (failMessages && table === 'messages') return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'offline'})});
  let result = [];
  if (req.method() === 'GET') {
    result = rows.filter(row => matches(row,url.searchParams)).map(row=>({...row}));
    const order = url.searchParams.get('order');
    if (order) {const [key,dir] = order.split('.'); result.sort((a,b)=>(a[key]<b[key]?-1:a[key]>b[key]?1:0)*(dir==='desc'?-1:1));}
    if (url.searchParams.has('limit')) result = result.slice(0,Number(url.searchParams.get('limit')));
    if (table === 'messages' && delayNextMessages) {delayNextMessages=false; await new Promise(r=>setTimeout(r,1800));}
  } else if (req.method() === 'POST') {
    let input = req.postDataJSON(); if (!Array.isArray(input)) input=[input];
    for(const item of input) {
      const existing=rows.find(row=> table==='group_call_members' ? row.room_id===item.room_id && row.user_id===item.user_id : item.id && row.id===item.id);
      if(existing && (req.headers()['prefer']||'').includes('merge-duplicates')) Object.assign(existing,item);
      else rows.push({id:String(++seq),created_at:new Date().toISOString(),...item});
    }
  } else if (req.method() === 'PATCH') {
    for (const row of rows.filter(row=>matches(row,url.searchParams))) Object.assign(row,req.postDataJSON());
  } else if (req.method() === 'DELETE') db[table]=rows.filter(row=>!matches(row,url.searchParams));
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
}
async function waitFor(check,label,timeout=25000) {
  const until=Date.now()+timeout;
  while(Date.now()<until){if(await check())return;await new Promise(r=>setTimeout(r,200));}
  throw new Error('Timed out: '+label);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,
   args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 try {
 const errors=[];
 async function rider(id,name) {
   const ctx=await browser.newContext({permissions:['camera','microphone'],viewport:{width:390,height:844}});
   await ctx.route('https://*.supabase.co/**',mock);
   await ctx.routeWebSocket('wss://*.supabase.co/**', socket => socket.close());
   await ctx.addInitScript(({id,name})=>{
     localStorage.setItem('rider_device_id',id);localStorage.setItem('rider_username',name);
     const Original=window.RTCPeerConnection;window.__peers=[];
     window.RTCPeerConnection=new Proxy(Original,{construct(target,args){const pc=new target(...args);window.__peers.push(pc);return pc;}});
   },{id,name});
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.getByTitle('Menü ve Ayarlar').waitFor();
   return page;
 }
 console.log('Starting isolated browser riders');
 const a=await rider('rider_a_under_score','Ali');const b=await rider('rider_b_under_score','Bora');
 const checks = await a.evaluate(async () => {
   const { CallConnection, resolveRiderId } = await import('/src/services/callConnection.ts');
   if (resolveRiderId('dm_rider_a_under_score_rider_b_under_score', 'rider_a_under_score') !== 'rider_b_under_score') throw Error('DM identity split');
   const Original = window.RTCPeerConnection;
   class FakePeer {
     remoteDescription = null; signalingState = 'stable'; added = [];
     async setRemoteDescription(description) { this.remoteDescription = description; }
     async addIceCandidate(candidate) { if (!this.remoteDescription) throw Error('Too early'); this.added.push(candidate); }
     close() {}
   }
   try {
     window.RTCPeerConnection = FakePeer;
     const call = new CallConnection({getTracks:()=>[]}, () => {}, () => {}, async () => {});
     const candidate = {candidate:'test-candidate'};
     await call.receive('ice', candidate);
     if (call.pc.added.length !== 0) throw Error('ICE was not queued');
     await call.receive('offer', {type:'offer',sdp:'test'});
     await call.receive('ice', candidate);
     if (call.pc.added.length !== 1) throw Error('ICE was lost or duplicated');
     call.close();
   } finally { window.RTCPeerConnection = Original; }
   const { latestLiveLocations, escapeMapText } = await import('/src/services/location.ts');
   const now=Date.now();
   const point=(sender,time,lat=41)=>({group_id:'global',sender_id:sender,sender_name:sender,type:'location',time,url:JSON.stringify({lat,lng:29,live:true})});
   const points=latestLiveLocations([point('a',now-1000),point('a',now),point('b',now-180000),point('c',now,999)],now);
   if(points.length!==1 || points[0].time!==now) throw Error('Radar repeats stale or invalid locations');
   const tag=document.createElement('div');tag.innerHTML=escapeMapText('<img src=x onerror=alert(1)>');
   if(tag.children.length || !tag.textContent.includes('<img')) throw Error('Map name rendered as HTML');
   const { isMessageForRider } = await import('/src/services/messageAccess.ts');
   if (isMessageForRider({group_id:'dm_other_third',sender_id:'other',recipient_id:'third'},'rider_a_under_score')) throw Error('Unrelated DM leaked');
   if (!isMessageForRider({group_id:'dm_rider_a_under_score_rider_b_under_score',sender_id:'rider_b_under_score'},'rider_a_under_score')) throw Error('Legacy DM blocked');
   const local = await import('/src/services/localStore.ts');
   const originalSet = Storage.prototype.setItem;
   try {
     Storage.prototype.setItem = function(key,value) {
       if (key === 'rider_messages_quota-test') throw new DOMException('Full','QuotaExceededError');
       return originalSet.call(this,key,value);
     };
     local.saveLocalMessage('quota-test', {group_id:'quota-test',sender_id:'rider_a_under_score',sender_name:'Ali',time:1,type:'text',text:'quota'});
     if (local.getLocalMessages('quota-test').length !== 1 || !local.unpersistedChats.has('quota-test')) throw Error('Quota lost message silently');
   } finally { Storage.prototype.setItem = originalSet; local.clearLocalMessages('quota-test'); }
   return true;
 });
 assert(checks);
 console.log('PASS: early ICE queue, replay deduplication, underscore rider IDs and storage quota fallback');
 await a.getByRole('button',{name:/Ortak Kortej/}).click();
 // GPS denial must never fabricate a rider's position.
 await a.evaluate(()=>{ navigator.geolocation.getCurrentPosition = (_ok, error) => error({code:1,message:'denied'}); });
 await a.getByTitle('Medya / Konum / Ek Ekle').click();
 await a.getByRole('button',{name:'Sabit Konum',exact:true}).click();
 await a.waitForTimeout(100);
 assert.equal(db.messages.filter(m=>m.type==='location').length,0);
 await a.getByRole('button',{name:'Canlı Konum',exact:true}).click();
 await a.waitForTimeout(100);
 assert.equal(db.messages.filter(m=>m.type==='location').length,0);
 // A delayed GPS result after leaving the chat must be discarded.
 await a.evaluate(()=>{navigator.geolocation.getCurrentPosition = ok => {window.__latePosition=ok;};});
 await a.getByTitle('Medya / Konum / Ek Ekle').click();
 await a.getByRole('button',{name:'Canlı Konum',exact:true}).click();
 await a.getByTitle('Geri',{exact:true}).click();
 await a.evaluate(()=>window.__latePosition({coords:{latitude:41,longitude:29}}));
 await a.waitForTimeout(100);assert.equal(db.messages.filter(m=>m.type==='location').length,0);
 // Microphone permission completing after the chat closed must release all tracks.
 await a.getByRole('button',{name:/Ortak Kortej/}).click();
 await a.evaluate(()=>{
   window.__originalGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia = async constraints => {
     const stream = await window.__originalGum(constraints);window.__lateMicStream=stream;
     return new Promise(resolve=>{window.__releaseMic=()=>resolve(stream);});
   };
 });
 await a.getByTitle('Sesli Telsiz Kaydı Başlat').click();
 await a.waitForFunction(()=>!!window.__releaseMic);
 await a.getByTitle('Geri',{exact:true}).click();
 await a.evaluate(()=>window.__releaseMic());
 await a.waitForFunction(()=>window.__lateMicStream.getTracks().every(t=>t.readyState==='ended'));
 assert.equal(db.messages.filter(m=>m.type==='audio').length,0);
 await a.evaluate(()=>{navigator.mediaDevices.getUserMedia = window.__originalGum;});
 await a.getByRole('button',{name:/Ortak Kortej/}).click();
 // Closing the attachments drawer cancels an active recording without sending it.
 await a.getByTitle('Medya / Konum / Ek Ekle').click();
 await a.getByRole('button',{name:'SES KAYDI BAŞLAT',exact:true}).click();
 await a.getByText(/Kayıt Yapılıyor:/).waitFor();
 await a.getByText('Kapat / Geri',{exact:true}).click();
 await a.waitForTimeout(100);assert.equal(db.messages.filter(m=>m.type==='audio').length,0);
 // A normal recording still sends a correctly labelled media payload.
 await a.getByTitle('Sesli Telsiz Kaydı Başlat').click();
 await a.getByText('Sesli Telsiz Kaydediliyor...').waitFor();
 await a.waitForTimeout(500);
 await a.getByRole('button',{name:'Bitir & Gönder',exact:true}).click();
 await waitFor(()=>db.messages.some(m=>m.type==='audio'),'voice note saved');
 assert.match(db.messages.find(m=>m.type==='audio').url,/^data:audio\/(webm|mp4|ogg)/);
 // Import both a current chat and an archived chat, then export all local history.
 const backup={app:'BizBize Riders',version:2,customGroups:{archive:{info:{id:'archive',name:'Arşiv Korteji',avatar:'🏍️',color:'from-orange-700 to-orange-500'}}},dmContacts:{},messages:[
   {group_id:'global',sender_id:'backup_rider',sender_name:'Yedek',time:1,type:'text',text:'Geri yüklenen mesaj'},
   {group_id:'archive',sender_id:'backup_rider',sender_name:'Yedek',time:2,type:'text',text:'Arşiv geçmişi'}]};
 await a.getByTitle('Menü ve Ayarlar').click();await a.getByRole('button',{name:'Yedekleme & Geri Yükle'}).click();
 await a.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await a.getByText('Geri yüklenen mesaj',{exact:true}).waitFor();
 await a.getByTitle('Menü ve Ayarlar').click();await a.getByRole('button',{name:'Yedekleme & Geri Yükle'}).click();
 const downloadPromise=a.waitForEvent('download');await a.getByRole('button',{name:'Yedek İndir (.JSON)',exact:true}).click();
 const download=await downloadPromise;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
 const exported=JSON.parse(Buffer.concat(chunks).toString());
 assert(exported.messages.some(m=>m.text==='Arşiv geçmişi'));assert(exported.messages.some(m=>m.text==='Geri yüklenen mesaj'));
 // Close the backup dialog by its close icon.
 await a.locator('div.fixed').filter({has:a.getByText('YEDEKLEME & GERİ YÜKLE',{exact:true})}).locator('button').first().click();
 await a.evaluate(()=>{
   const channel=new BroadcastChannel('bizbize_riders_local_channel');
   channel.postMessage({type:'NEW_LOCAL_MESSAGE',payload:{group_id:'dm_other_third',sender_id:'other',recipient_id:'third',sender_name:'Other',type:'text',text:'Başkasının özel mesajı',time:Date.now()}});
   setTimeout(()=>channel.close(),100);
 });
 await a.waitForTimeout(150);assert.equal(await a.getByText(/Başkasının özel mesajı/).count(),0);
 console.log('PASS: unrelated direct messages do not produce notifications');
 console.log('PASS: GPS denial, late location/microphone callbacks, recording cleanup and backup round trip');
 // Polling must preserve the scroll position while reading older messages.
 for(let i=0;i<35;i++) db.messages.push({id:String(++seq),group_id:'global',sender_id:'reader_fixture',sender_name:'Geçmiş',time:Date.now()+i,type:'text',text:'Okuma '+i});
 await a.getByText('Okuma 0',{exact:true}).waitFor({state:'attached'});
 const feed=a.getByRole('log',{name:'Sohbet mesajları'});
 await feed.evaluate(element=>{element.scrollTop=0;element.dispatchEvent(new Event('scroll'));});
 await a.waitForTimeout(4500);assert(await feed.evaluate(element=>element.scrollTop<5),'history scroll preserved');
 console.log('PASS: history scroll survives background refresh');
 // An old empty response arrives after two newer sends.
 delayNextMessages=true;
 await a.evaluate(()=>import('/src/services/supabase.ts').then(m=>m.getSupabaseClient().from('messages').select('*'))); // fixture delay probe
 delayNextMessages=true;
 await a.getByTitle('Geri',{exact:true}).click();await a.getByRole('button',{name:/Ortak Kortej/}).click();
 await a.getByPlaceholder('Mesaj yazın veya telsiz kaydı yapın...').fill('Kalıcı mesaj bir');await a.getByTitle('Gönder',{exact:true}).click();
 await a.getByPlaceholder('Mesaj yazın veya telsiz kaydı yapın...').fill('Kalıcı mesaj iki');await a.getByTitle('Gönder',{exact:true}).click();
 await a.waitForTimeout(2200);
 for(const text of ['Kalıcı mesaj bir','Kalıcı mesaj iki']) await a.getByText(text,{exact:true}).waitFor();
 await a.reload();await a.getByRole('button',{name:/Ortak Kortej/}).click();
 await a.getByText('Kalıcı mesaj iki',{exact:true}).waitFor();
 await b.getByRole('button',{name:/Ortak Kortej/}).click();await b.getByText('Kalıcı mesaj iki',{exact:true}).waitFor();
 failMessages=true;
 await a.getByPlaceholder('Mesaj yazın veya telsiz kaydı yapın...').fill('Çevrimdışı kalıcı');await a.getByTitle('Gönder',{exact:true}).click();
 await a.waitForTimeout(4500);await a.getByText('Çevrimdışı kalıcı',{exact:true}).waitFor();
 await a.reload();await a.getByRole('button',{name:/Ortak Kortej/}).click();await a.getByText('Çevrimdışı kalıcı',{exact:true}).waitFor();
 failMessages=false;
 console.log('PASS: delayed reads, consecutive sends, reload, remote reception and offline message retention');
 await a.getByTitle('Geri',{exact:true}).click();await b.getByTitle('Geri',{exact:true}).click();
 // Add a real contact through the UI.
 await a.getByTitle('Sürücü Ekle',{exact:true}).click();
 await a.getByPlaceholder('Sürücü takma adı...').fill('Bora');assert(await a.getByRole('button',{name:'Sürücüyü Ekle',exact:true}).isDisabled());await a.getByPlaceholder('Örn: rider_xyz123').fill('rider_b_under_score');
 await a.getByRole('button',{name:'Sürücüyü Ekle',exact:true}).click();
 await a.getByRole('button',{name:/Bora.*Sürücü Birebir Sohbet/}).click();
 async function mediaReceived(page,video) {
   return page.evaluate(async(video)=> {
     const pc=window.__peers.findLast(pc=>pc.connectionState==='connected');if(!pc)return false;
     const stats=[...(await pc.getStats()).values()].filter(s=>s.type==='inbound-rtp');
     return stats.some(s=>s.kind==='audio' && s.bytesReceived>0) && (!video || stats.some(s=>s.kind==='video' && s.bytesReceived>0));
   },video);
 }
 for(const video of [false,true]) {
   await a.getByTitle(video?'Görüntülü Arama':'Sesli Arama',{exact:true}).click();
   await b.getByRole('button',{name:'Kabul Et',exact:true}).click({timeout:20000});
   try {
     await waitFor(async()=>await mediaReceived(a,video)&&await mediaReceived(b,video),'bidirectional '+(video?'video':'audio'));
   } catch(error) {
     for(const page of [a,b]) console.log('PEERS',await page.evaluate(async()=>await Promise.all(window.__peers.map(async pc=>({
       connection:pc.connectionState, ice:pc.iceConnectionState, signaling:pc.signalingState,
       hasLocal:!!pc.localDescription, hasRemote:!!pc.remoteDescription,
       stats:[...(await pc.getStats()).values()].filter(s=>['inbound-rtp','candidate-pair'].includes(s.type))
     })))));
     console.log('FIXTURE CALL STATUS', db.calls.map(call=>({id:call.id,status:call.status})), 'SIGNALS', db.call_signals.length);
     throw error;
   }
   for(const page of [a,b]) assert(await page.locator('video').evaluateAll(videos=>videos.some(v=>v.srcObject && !v.muted && !v.paused)),'remote media is playing');
   await a.getByTitle('Aramayı Sonlandır').click();
   await b.getByTitle('Aramayı Sonlandır').waitFor({state:'hidden',timeout:15000});
   console.log('PASS: bidirectional '+(video?'audio + video':'audio')+' RTP, playback, remote hangup');
 }
 await a.getByTitle('Geri',{exact:true}).click();await a.getByRole('button',{name:/Ortak Kortej/}).click();
 await a.getByTitle('Görüntülü Arama',{exact:true}).click();
 await b.getByRole('button',{name:'Katıl',exact:true}).click({timeout:20000});
 await waitFor(async()=>await mediaReceived(a,true)&&await mediaReceived(b,true),'group media');
 await b.getByTitle('Aramayı Sonlandır').click();
 assert(await a.getByTitle('Aramayı Sonlandır').isVisible(),'guest leaving must not close host call');
 await a.getByTitle('Aramayı Sonlandır').click();
 console.log('PASS: group bidirectional media and independent guest leave');
 assert.deepEqual(errors,[]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

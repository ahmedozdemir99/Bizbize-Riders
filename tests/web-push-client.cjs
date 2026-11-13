const {chromium}=require('playwright');
const {createECDH}=require('node:crypto');
const assert=require('node:assert/strict');
const uid='11111111-1111-4111-8111-111111111111';
const key=createECDH('prime256v1');key.generateKeys();const publicKey=key.getPublicKey().toString('base64url');
const endpoint='https://fcm.googleapis.com/fcm/send/browser-fixture';
const now=Math.floor(Date.now()/1000),token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})).toString('base64url')+'.fixture';
const requests=[];let subscribed=false;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.routeWebSocket('wss://*.supabase.co/**',socket=>socket.close());
  await context.route('https://*.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url());let body={};
   if(url.pathname==='/auth/v1/signup')body={access_token:token,refresh_token:'fixture-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',app_metadata:{provider:'anonymous',providers:['anonymous']},user_metadata:{},created_at:new Date().toISOString(),is_anonymous:true}};
   else if(url.pathname==='/functions/v1/push'){
    assert.equal(request.method(),'GET');
    assert.equal(request.headers().apikey,undefined,'Gateway discovery should avoid a CORS preflight');
    await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'NOT_FOUND'})});
    return;
   }else if(url.pathname==='/functions/v1/rapid-task'){
    if(request.method()==='GET')body={publicKey};
    else {const data=request.postDataJSON();requests.push(data);assert.equal(request.headers().authorization,'Bearer '+token);
     if(data.action==='subscribe'){assert(!('userId' in data));assert(!('deviceId' in data));subscribed=true;body={userId:uid,subscribed:true,id:'sub1'};}
     if(data.action==='status')body={userId:uid,subscribed};
     if(data.action==='test')body={accepted:true};
     if(data.action==='unsubscribe'){subscribed=false;body={subscribed:false};}
     if(data.action==='preferences')body={updated:true};
    }
   }else body=[];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await context.addInitScript(({publicKey,endpoint})=>{
   localStorage.setItem('rider_device_id','rider_legacy');localStorage.setItem('rider_username','Bildirim Test');
   localStorage.setItem('rider_messages_global',JSON.stringify([{group_id:'global',sender_id:'rider_legacy',sender_name:'Bildirim Test',type:'text',text:'Eski mesajım',time:1}]));
   let current=null;
   const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const subscription={endpoint,options:{applicationServerKey:bytes.buffer},toJSON:()=>({endpoint,keys:{p256dh:publicKey,auth:'AAAAAAAAAAAAAAAAAAAAAA'}}),async unsubscribe(){current=null;return true;}};
   const worker={pushManager:{async getSubscription(){return current;},async subscribe(){current=subscription;return current;}},async showNotification(){},async getNotifications(){return [];}};
   Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:{},register:async()=>worker,getRegistration:async()=>worker,ready:Promise.resolve(worker),addEventListener(){},removeEventListener(){}}});
   Object.defineProperty(window,'PushManager',{configurable:true,value:class{}});
   Object.defineProperty(window,'Notification',{configurable:true,value:class{static permission='default';static async requestPermission(){this.permission='granted';return this.permission;}}});
  },{publicKey,endpoint});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://localhost:3001');
  await page.getByTitle('Menü ve Ayarlar').click();await page.getByRole('button',{name:'Bildirim Ayarları',exact:true}).click();
  await page.getByRole('button',{name:'Bildirimleri aç',exact:true}).click();
  await page.waitForFunction(uid=>localStorage.getItem('rider_device_id')===uid,uid);
  assert.equal(await page.evaluate(()=>localStorage.getItem('rider_web_push_enabled')),'true');
  assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('rider_legacy_device_ids')))).includes('rider_legacy'));
  await page.getByRole('button',{name:/Ortak Kortej/}).click();await page.getByText('Eski mesajım',{exact:true}).waitFor();
  await page.getByTitle('Menü ve Ayarlar').click();await page.getByRole('button',{name:'Bildirim Ayarları',exact:true}).click();
  await page.getByText('Sunucu aboneliği etkin',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Test bildirimi gönder',exact:true}).click();await page.getByText(/Test bildirimi gönderim servisine iletildi/).waitFor();
  await page.getByRole('button',{name:'Bildirimleri kapat',exact:true}).click();await page.getByText('Bildirimler kapalı',{exact:true}).waitFor();
  assert.equal(subscribed,false);assert.equal(await page.evaluate(()=>localStorage.getItem('rider_web_push_enabled')),null);
  assert(requests.some(request=>request.action==='subscribe'));assert(requests.some(request=>request.action==='test'));assert(requests.some(request=>request.action==='unsubscribe'));assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Bildirim ayarlarını kapat'}).click();
  await page.evaluate(()=>Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}));
  await page.getByTitle('Menü ve Ayarlar').click();await page.getByRole('button',{name:'Bildirim Ayarları',exact:true}).click();
  await page.getByText('iPhone’da ana ekrandan açılmalı',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Bildirimleri aç',exact:true}).isDisabled());
  console.log('PASS: browser permission, authenticated PushManager registration, protected new rider ID, history preservation, subscription health, test delivery request and unsubscribe');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});

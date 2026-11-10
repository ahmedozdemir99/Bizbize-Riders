const {webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  const context=await browser.newContext({...devices['iPhone 13']});
  await context.route('https://*.supabase.co/**',route=>route.fulfill({status:route.request().method()==='OPTIONS'?204:200,contentType:'application/json',headers:{'access-control-allow-origin':new URL(process.env.TEST_URL||'http://localhost:3001').origin,'access-control-allow-methods':'GET, POST, PATCH, DELETE, OPTIONS','access-control-allow-headers':route.request().headers()['access-control-request-headers']||'*'},body:route.request().method()==='OPTIONS'?'':'[]'}));
  await context.routeWebSocket('wss://*.supabase.co/**',socket=>socket.close());
  await context.addInitScript(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      return url.hostname.endsWith('.supabase.co')?Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json'}})):originalFetch(input,init);
    };
    // Deterministic iOS-format capture fixture; real camera/microphone require a device.
    const track={readyState:'live',stop(){this.readyState='ended';}};
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[track]})}, configurable:true});
    window.MediaRecorder=class {
      state='inactive';mimeType='audio/mp4';
      start(){this.state='recording';}
      stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['aac-fixture'],{type:this.mimeType})});this.onstop?.();});}
    };
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('WebKit page error:',error.message);});
  await page.goto(process.env.TEST_URL||'http://localhost:3001');
  await page.getByRole('textbox',{name:'Sürücü adın'}).fill('iPhone Test');
  await page.getByRole('button',{name:'Kontağı Çevir'}).click();
  await page.getByTitle('Menü ve Ayarlar').waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert((await page.locator('meta[name=viewport]').getAttribute('content')).includes('viewport-fit=cover'));
  await page.getByRole('button',{name:/Ortak Kortej/}).click();
  assert.equal(await page.getByPlaceholder('Mesaj yazın veya telsiz kaydı yapın...').evaluate(element=>getComputedStyle(element).fontSize),'16px');
  await page.getByTitle('Sesli Telsiz Kaydı Başlat').click();await page.getByText('Sesli Telsiz Kaydediliyor...').waitFor();
  await page.getByRole('button',{name:'Bitir & Gönder',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('rider_messages_global')||'[]').some(message=>message.type==='audio'));
  const url=await page.evaluate(()=>JSON.parse(localStorage.getItem('rider_messages_global')).find(message=>message.type==='audio').url);
  assert.match(url,/^data:audio\/mp4/);
  await page.setViewportSize({width:320,height:568});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS: WebKit/iPhone layout, login, safe viewport, readable input and MP4 voice-note encoding fixture');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});

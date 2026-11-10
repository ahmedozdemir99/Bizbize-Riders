const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const handlers={}, shown=[], closed=[], messages=[], opened=[];
const state=new Map();const caches={async open(){return {async match(key){return state.get(key)?.clone();},async put(key,response){state.set(key,response.clone());},async keys(){return [...state.keys()];},async delete(key){return state.delete(key);}};}};
const self={caches,location:{origin:'https://riders.test'},skipWaiting(){},
 addEventListener(name,handler){handlers[name]=handler;},
 registration:{async showNotification(title,options){shown.push({title,...options});},async getNotifications({tag}){return [{close(){closed.push(tag);}}];}},
 clients:{async claim(){},async matchAll(){return self.testWindows||[];},async openWindow(url){opened.push(url);}}};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL,Date,console,Response,caches});
async function push(payload){let pending;handlers.push({data:{json:()=>payload},waitUntil(promise){pending=promise;}});await pending;}
async function click(data,action=''){let pending;handlers.notificationclick({notification:{data,close(){}},action,waitUntil(promise){pending=promise;}});await pending;}
(async()=>{
 await push({type:'call',callId:'expired',expiresAt:Date.now()-1});assert.equal(shown[0].data.type,'call-ended');shown.length=0;
 await push({type:'call',callId:'fresh',expiresAt:Date.now()+45000,title:'Gelen arama'});
 assert.equal(shown[0].tag,'call:fresh');assert.deepEqual(Array.from(shown[0].actions,a=>a.action),['open','reject']);
 await push({type:'call-ended',callId:'fresh',eventAt:Date.now()});assert.equal(shown.at(-1).data.type,'call-ended');
 await push({type:'call',callId:'fresh',eventAt:Date.now()-1000,expiresAt:Date.now()+45000});assert.equal(shown.at(-1).data.type,'call-ended');assert(shown.at(-1).silent);
 self.testWindows=[{url:'https://other.test/',postMessage(){throw Error('Wrong origin');}},{url:'https://riders.test/',postMessage(data){messages.push(data);},async focus(){}}];
 await click({callId:'fresh'},'reject');assert.equal(messages[0].action,'reject');assert.equal(messages[0].callId,'fresh');
 self.testWindows=[];await click({callId:'fresh',url:'https://evil.test/'},'open');assert.equal(new URL(opened[0]).origin,'https://riders.test');assert.equal(new URL(opened[0]).searchParams.get('call'),'fresh');
 await push({type:'message',chatId:'global',body:'Yeni mesaj'});assert.equal(shown.at(-1).tag,'chat:global');
 console.log('PASS: user-visible expired/cancelled pushes, out-of-order call suppression, notification expiry, call actions, dismissal, same-origin routing and cold-start deep link');
})().catch(error=>{console.error(error);process.exit(1)});

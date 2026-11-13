import assert from 'node:assert/strict';
import {createECDH,randomBytes,createDecipheriv,hkdfSync} from 'node:crypto';
import webpush from 'web-push';
import {createHandler} from '../supabase/functions/push/http.ts';
import {dispatchOne,makePayload,validEndpoint,validateSubscription,type Job,type PushRepository,type Subscription} from '../supabase/functions/push/core.ts';

const key=createECDH('prime256v1');key.generateKeys();const auth=randomBytes(16);
const subscription:Subscription={id:'s1',user_id:'recipient',endpoint:'https://fcm.googleapis.com/fcm/send/test',p256dh:key.getPublicKey().toString('base64url'),auth:auth.toString('base64url')};
const job:Job={id:'j1',source_table:'calls',source_id:'call1',event_type:'call',actor_uid:'sender',expires_at:new Date(Date.now()+45000).toISOString(),created_at:new Date().toISOString()};
let complete=false,released=false,removed=false,attempts=0,delivered=false;
const repo:PushRepository={async claimJob(){return job;},async getSource(){return {id:'call1',caller_id:'sender',callee_id:'recipient',status:'ringing',type:'video'};},async prepareDeliveries(){},async dueDeliveries(){return delivered?[]:[{subscription,attempts}];},async sent(){delivered=true;},async failed(_j,_s,n,permanent){attempts=n;if(permanent)delivered=true;},async removeSubscription(){removed=true;delivered=true;},async pending(){return !delivered;},async finish(){complete=true;},async release(){released=true;}};
assert(!validEndpoint('http://127.0.0.1/private'));assert(!validEndpoint('https://fcm.googleapis.com.attacker.test/push'));assert(!validEndpoint('https://fcm.googleapis.com:8443/push'));assert(!validEndpoint('https://user@web.push.apple.com/test'));
assert(validEndpoint('https://web.push.apple.com/endpoint'));
assert.throws(()=>validateSubscription({endpoint:subscription.endpoint,keys:{p256dh:'bad',auth:'bad'}}));
const payload=makePayload(job,await repo.getSource(job),Date.now())!;assert(payload);assert.equal(makePayload(job,{status:'connected'},Date.now()),null);
assert.equal(makePayload({...job,expires_at:new Date(0).toISOString()},await repo.getSource(job),Date.now()),null);
await dispatchOne(repo,async()=>503);assert.equal(attempts,1);assert(released);assert(!complete);
released=false;await dispatchOne(repo,async()=>201);assert(delivered&&complete);
let duplicate=0;await dispatchOne(repo,async()=>{duplicate++;return 201;});assert.equal(duplicate,0);
delivered=false;complete=false;await dispatchOne(repo,async()=>410);assert(removed&&complete);
const gateway=createHandler({origin:'https://riders.test, https://new-riders.test',publicKey:'public',workerSecret:'worker-secret',repo,
 authenticate:async token=>token==='good'?'owner':null,
 save:async(user,s)=>{assert.equal(user,'owner');assert.equal(s.endpoint,subscription.endpoint);return 's1';},remove:async()=>{},own:async(user)=>user==='owner'?subscription:null,preferences:async()=>{},send:async()=>201});
const request=(body:unknown,token?:string,origin='https://riders.test')=>gateway(new Request('https://push.test/',{method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
assert.equal((await request({action:'subscribe'})).status,401);
assert.equal((await request({action:'dispatch'},'good')).status,401);
assert.equal((await request({action:'test',endpoint:subscription.endpoint},'good','https://evil.test')).status,403);
assert.equal((await request({action:'test',endpoint:subscription.endpoint},'good','https://new-riders.test')).headers.get('access-control-allow-origin'),'https://new-riders.test');
assert.equal((await request({action:'subscribe',userId:'victim',subscription:{endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},groupIds:['global']},'good')).status,200);
assert.equal((await request({action:'test',endpoint:subscription.endpoint},'good')).status,200);
assert.equal((await request({action:'subscribe',subscription:{endpoint:'https://127.0.0.1/secret',keys:{} }},'good')).status,400);
// Generate a real RFC 8291 request and decrypt it with the browser's private key.
const vapid=webpush.generateVAPIDKeys();
const encrypted=webpush.generateRequestDetails({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify(payload),{TTL:45,vapidDetails:{subject:'mailto:test@example.com',...vapid}});
const body=Buffer.from(encrypted.body!);const salt=body.subarray(0,16),serverPublic=body.subarray(21,21+body[20]);
const shared=key.computeSecret(serverPublic);
const info=Buffer.concat([Buffer.from('WebPush: info\0'),key.getPublicKey(),serverPublic]);
const ikm=Buffer.from(hkdfSync('sha256',shared,auth,info,32));
const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
const ciphertext=body.subarray(21+body[20]);const decipher=createDecipheriv('aes-128-gcm',cek,nonce);decipher.setAuthTag(ciphertext.subarray(-16));
const plaintext=Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]);
assert.equal(plaintext.at(-1),2);assert.deepEqual(JSON.parse(plaintext.subarray(0,-1).toString()),payload);
assert.equal(encrypted.headers.TTL,45);assert(String(encrypted.headers.Authorization).startsWith('vapid '));
console.log('PASS: push gateway authentication/origin/SSRF validation, durable retry, expired/revoked delivery, deduplication and real encrypted Web Push payload');

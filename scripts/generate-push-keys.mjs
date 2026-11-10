import {createECDH,randomBytes} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
const output='.env.push.local';
if(existsSync(output))throw new Error(`${output} already exists. Keep the existing keys; rotating VAPID keys requires re-subscribing every device.`);
const key=createECDH('prime256v1');key.generateKeys();
const publicKey=key.getPublicKey().toString('base64url');
writeFileSync(output,[`VAPID_PUBLIC_KEY=${publicKey}`,`VAPID_PRIVATE_KEY=${key.getPrivateKey().toString('base64url')}`,`PUSH_WORKER_SECRET=${randomBytes(32).toString('hex')}`,'VAPID_SUBJECT=mailto:YOUR_EMAIL','APP_ORIGIN=https://YOUR_PUBLISHED_APP_ORIGIN'].join('\n')+'\n',{mode:0o600,flag:'wx'});
console.log(`Keys written privately to ${output}. Fill APP_ORIGIN and VAPID_SUBJECT, then upload this file using Supabase secrets. Do not commit or share it.`);

import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
const ref=process.argv[process.argv.indexOf('--project-ref')+1];
if(!process.argv.includes('--project-ref')||!ref||!/^[a-z0-9]{20}$/.test(ref))throw new Error('Usage: node scripts/push-vault.mjs --project-ref YOUR_PROJECT_REF');
const settings=parse(readFileSync('.env.push.local'));
if(!/^[0-9a-f]{64}$/.test(settings.PUSH_WORKER_SECRET||''))throw new Error('Generate keys first using npm run push:keys.');
const origins = settings.APP_ORIGIN.split(',').map(value => value.trim());
if (origins.some(value => {
  try {
    const url = new URL(value);
    return url.protocol !== 'https:' || url.origin !== value || value.includes('YOUR_');
  } catch { return true; }
})) throw new Error('Set APP_ORIGIN to your published HTTPS origin(s), without trailing slashes.');
if(!settings.VAPID_SUBJECT||settings.VAPID_SUBJECT.includes('YOUR_'))throw new Error('Set VAPID_SUBJECT to mailto:your-email.');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const functionName=process.argv.includes('--function-name')?process.argv[process.argv.indexOf('--function-name')+1]:'push';
if(!/^[a-zA-Z0-9_-]+$/.test(functionName||''))throw new Error('Invalid function name');
const values=[['riders_push_url',`https://${ref}.supabase.co/functions/v1/${functionName}`],['riders_push_worker_secret',settings.PUSH_WORKER_SECRET]];
const sql=values.map(([name,value])=>`do $$ declare existing uuid; begin
select id into existing from vault.decrypted_secrets where name=${quote(name)} limit 1;
if existing is null then perform vault.create_secret(${quote(value)},${quote(name)});
else perform vault.update_secret(existing,${quote(value)},${quote(name)}); end if;
end $$;`).join('\n')+'\nselect public.push_wake_worker();\n';
writeFileSync('.push-vault.local.sql',sql,{mode:0o600,flag:'wx'});
console.log('Private Vault setup written to .push-vault.local.sql. Run it in your Supabase SQL Editor after the migration. Do not commit or share it.');

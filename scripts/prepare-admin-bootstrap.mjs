// Creates a LOCAL one-time SQL file. Never connects to Cloudflare, GitHub or an email provider.
import {randomUUID} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {emailAddress} from '../functions/_lib/login-safety.js';

export function createBootstrapSql({email,name,id=randomUUID()}){
 const e=emailAddress(email);
 const badName=typeof name!=='string'||/[\u0000-\u001f\u007f]/.test(name);
 const display=typeof name==='string'?name.trim():'';
 if(!e||badName||display.length<2||display.length>80)throw Error('Valid email and display name are required');
 if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid generated ID');
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 return [
  '-- OFFLINE-GENERATED. MANUAL execution ONLY in the already-verified GewinnRadar D1 database.',
  '-- CREATE FIRST ADMIN ONLY when users is empty. No session, verification or mail token is created.',
  'INSERT INTO users (id,email,display_name,role,senior_mode,daily_email,email_verified,consent_at)',
  "SELECT "+[id,e,display].map(quote).join(',')+",'admin',1,0,0,NULL",
  'WHERE NOT EXISTS (SELECT 1 FROM users);',
  'SELECT role,senior_mode,daily_email,email_verified FROM users WHERE id='+quote(id)+';',
  ''
 ].join('\n');
}

export function prepareLocalFile({env=process.env,args=process.argv.slice(2)}={}){
 if(args.length!==2||args[0]!=='--output')throw Error('Usage: node scripts/prepare-admin-bootstrap.mjs --output /private/path/admin-bootstrap.sql');
 const email=env.GEWINNRADAR_ADMIN_EMAIL, name=env.GEWINNRADAR_ADMIN_NAME;
 const path=resolve(args[1]);
 if(path.startsWith(resolve(process.cwd())+'/')||path===resolve(process.cwd()))throw Error('Output MUST be outside the Git repository');
 if(existsSync(path))throw Error('Output exists; refusing overwrite');
 writeFileSync(path,createBootstrapSql({email,name}),{mode:0o600,flag:'wx'});
 return {file:path};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{const r=prepareLocalFile();console.log('Offline SQL prepared outside repository. DO NOT commit or share this file:',r.file)}
 catch(error){console.error(error.message);process.exitCode=1}
}

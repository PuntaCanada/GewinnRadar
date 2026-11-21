import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {randomBytes} from 'node:crypto';

const config='scripts/wrangler-recovery-pages-ci.toml';
const database='gewinnradar-recovery-ci-only';
const persist='scripts/.wrangler/state';
const id='00000000-0000-0000-0000-000000000000';
const port=18789;
const base='http://127.0.0.1:'+port;
const email='ci-recovery@example.invalid';
const secret=randomBytes(32).toString('hex');
const args=['--yes','wrangler@4'];
const command=(a)=>['npx',...args,...a];
function cli(subargs){
 const [cmd,...argv]=command(subargs);
 const result=spawnSync(cmd,argv,{encoding:'utf8',timeout:90000,env:{...process.env,CI:'true'}});
 if(result.error||result.status!==0)throw Error('Local Wrangler command failed: '+subargs.join(' ')+'\\n'+(result.stderr||'').slice(-1800));
 return result.stdout;
}
function sql(query){return cli(['d1','execute',database,'--local','--config',config,'--command',query]);}
let server;
async function stop(){
 if(!server)return;
 const child=server;server=null;
 // npm/npx launches nested Wrangler, workerd and esbuild processes. Stop
 // the whole detached process group so CI does not hang after a PASS.
 try{process.kill(-child.pid,'SIGTERM')}catch{child.kill('SIGTERM')}
 if(child.exitCode===null)
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);
 try{process.kill(-child.pid,'SIGKILL')}catch{}
 child.stdout.destroy();child.stderr.destroy();
}
async function start(){
 const [cmd,...argv]=command(['pages','dev','public','--d1','DB='+id,'--ip','127.0.0.1','--port',String(port),'--persist-to',persist,
  '--binding','ADMIN_RECOVERY_ENABLED=true','--binding','ADMIN_BOOTSTRAP_ENABLED=false',
  '--binding','LOGIN_MAIL_ENABLED=false','--binding','ADMIN_BOOTSTRAP_EMAIL='+email,
  '--binding','ADMIN_BOOTSTRAP_SECRET='+secret]);
 let output='';
 server=spawn(cmd,argv,{stdio:['ignore','pipe','pipe'],detached:true,env:{...process.env,CI:'true'}});
 server.stdout.on('data',v=>{output=(output+v.toString()).slice(-3000)});
 server.stderr.on('data',v=>{output=(output+v.toString()).slice(-3000)});
 for(let i=0;i<120;i++){
  if(server.exitCode!==null)throw Error('Local Pages server exited: '+output);
  try{
   const r=await fetch(base+'/api/me');
   if(r.ok)return;
  }catch{}
  await delay(300);
 }
 throw Error('Local Pages server did not start: '+output);
}
async function recover(value=secret){
 return fetch(base+'/api/admin/recover',{method:'POST',headers:{origin:base,'content-type':'application/json'},
  body:JSON.stringify({recovery_secret:value}),redirect:'manual'});
}
try{
 // Actual Pages Functions + actual isolated Wrangler local D1. No HTTP mocks.
 for(let n=1;n<=6;n++){
  const filenames=['0001_initial','0002_review_security','0003_catalog_staging','0004_source_evidence','0005_form_and_reminders','0006_admin_bootstrap'];
  cli(['d1','execute',database,'--local','--config',config,'--file','migrations/'+filenames[n-1]+'.sql']);
 }
 sql("INSERT INTO users(id,email,display_name,role,email_verified) VALUES('ci-admin','"+email+"','CI Admin','admin',0)");
 // First run MUST roll back all changes if session insertion is silently skipped.
 sql("CREATE TRIGGER ci_skip_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(IGNORE); END");
 await start();
 const aborted=await recover();
 assert.equal(aborted.status,503,'silent session-write failure must abort the HTTP request');
 assert.equal(aborted.headers.get('set-cookie'),null,'failed recovery must not set session cookie');
 await stop();
 const untouched=sql("SELECT CASE WHEN (SELECT email_verified FROM users WHERE id='ci-admin')=0 AND (SELECT COUNT(*) FROM admin_bootstrap)=0 AND (SELECT COUNT(*) FROM sessions)=0 THEN 1 ELSE json_extract('invalid-json',char(36)) END AS rollback_verified;");
 assert.match(untouched,/rollback_verified/);
 sql('DROP TRIGGER ci_skip_session');
 await start();
 const wrong=await recover('0'.repeat(64));
 assert.equal(wrong.status,403);
 const response=await recover();
 assert.equal(response.status,201,'actual local Pages request must recover the admin once');
 const result=await response.json();
 assert.equal(result.recovered_existing_admin,true);
 assert.equal(result.mail_sent,false);
 const cookie=response.headers.get('set-cookie')||'';
 assert.match(cookie,/gr_session=[0-9a-f]{64}/);
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/Secure/);
 assert.match(cookie,/SameSite=Strict/);
 assert.match(cookie,/Max-Age=86400/);
 assert.doesNotMatch(cookie,/Domain=/);
 const sessionCookie=cookie.split(';')[0];
 const me=await fetch(base+'/api/me',{headers:{cookie:sessionCookie}});
 assert.equal(me.status,200);
 assert.equal((await me.json()).user.role,'admin');
 assert.equal((await recover()).status,409,'replay must be denied');
 await stop();
 const verified=sql("SELECT CASE WHEN (SELECT COUNT(*) FROM users WHERE role='admin' AND email='"+email+"' AND email_verified=1)=1 AND (SELECT COUNT(*) FROM admin_bootstrap WHERE slot=1 AND admin_id='ci-admin')=1 AND (SELECT COUNT(*) FROM sessions WHERE user_id='ci-admin')=1 AND (SELECT COUNT(*) FROM login_tokens)=0 THEN 1 ELSE json_extract('invalid-json',char(36)) END AS integration_verified;");
 assert.match(verified,/integration_verified/);
 console.log('REAL LOCAL Pages + Wrangler D1 recovery: rollback, once, cookie, authenticated /api/me, replay denial PASS');
}finally{await stop();}

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPost as recover} from '../functions/api/admin/recover.js';
import {onRequestGet as me} from '../functions/api/me.js';
import {onRequestGet as readiness} from '../functions/api/admin/readiness.js';
import {onRequestPost as originalBootstrap} from '../functions/api/admin/bootstrap.js';

function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql','0006_admin_bootstrap.sql'])
  sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={
  prepare(q){return{bind(...args){return{
   _q:q,_args:args,
   first:async()=>sql.prepare(q).get(...args)??null,
   all:async()=>({results:sql.prepare(q).all(...args)}),
   run:async()=>{const z=sql.prepare(q).run(...args);return{meta:{changes:Number(z.changes)}}}
  }}}},
  async batch(stmts){sql.exec('BEGIN');try{
   const results=stmts.map(s=>{const stmt=sql.prepare(s._q);if(/^\s*SELECT\b/i.test(s._q)){const row=stmt.get(...s._args);return{results:row?[row]:[],meta:{changes:0}}}const z=stmt.run(...s._args);return{meta:{changes:Number(z.changes)}}});
   sql.exec('COMMIT');return results;
  }catch(e){sql.exec('ROLLBACK');throw e}}
 };
 return {sql,DB};
}
const origin='https://gewinnradar.pages.dev',key='b'.repeat(64);
function env(DB,overrides={}){
 return {DB,ADMIN_BOOTSTRAP_ENABLED:'false',ADMIN_RECOVERY_ENABLED:'true',ADMIN_BOOTSTRAP_SECRET:key,ADMIN_BOOTSTRAP_EMAIL:'correct@example.invalid',LOGIN_MAIL_ENABLED:'false',...overrides};
}
function req(path,method='GET',data,originHeader=origin,cookie){
 return new Request(origin+path,{method,headers:{origin:originHeader,'content-type':'application/json',...(cookie?{cookie}:{})},
  body:data===undefined?undefined:JSON.stringify(data)});
}
const request=(settings,data={recovery_secret:key},originHeader=origin)=>recover({env:settings,request:req('/api/admin/recover','POST',data,originHeader)});
function user(sql,email='correct@example.invalid',role='admin',verified=0,id='old-admin'){
 sql.prepare('INSERT INTO users(id,email,display_name,role,email_verified) VALUES(?,?,?,?,?)').run(id,email,'Existing Account',role,verified);
}
test('recovery stays locked without explicit independent switch and exact configuration',async()=>{
 const {sql,DB}=fixture();user(sql);
 for(const x of [{ADMIN_RECOVERY_ENABLED:'false'},{ADMIN_RECOVERY_ENABLED:undefined},
 {ADMIN_BOOTSTRAP_ENABLED:'true'},{LOGIN_MAIL_ENABLED:'true'},
 {LOGIN_MAIL_ENABLED:undefined},{LOGIN_MAIL_ENABLED:''},{LOGIN_MAIL_ENABLED:'TRUE'},
 {ADMIN_BOOTSTRAP_SECRET:''},{ADMIN_BOOTSTRAP_EMAIL:''}])
  assert.equal((await request(env(DB,x))).status,403);
 assert.equal(sql.prepare("SELECT email_verified FROM users WHERE id='old-admin'").get().email_verified,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);sql.close();
});
test('single existing admin recovered once with admin-only cookie, no duplicate accounts or mail',async()=>{
 const {sql,DB}=fixture();user(sql);
 assert.equal((await request(env(DB),{recovery_secret:key},'https://attacker.invalid')).status,403);
 assert.equal((await request(env(DB),{recovery_secret:'c'.repeat(64)})).status,403);
 assert.equal((await request(env(DB),{recovery_secret:'invalid'})).status,403);
 assert.equal(sql.prepare("SELECT email_verified FROM users WHERE id='old-admin'").get().email_verified,0);
 const first=await request(env(DB));
 assert.equal(first.status,201);
 assert.deepEqual(await first.json(),{ok:true,recovered_existing_admin:true,mail_sent:false});
 const cookie=first.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM users').get().n,1);
 assert.equal(sql.prepare("SELECT id,email,role,email_verified FROM users").get().id,'old-admin');
 assert.equal(sql.prepare("SELECT email_verified FROM users WHERE id='old-admin'").get().email_verified,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM admin_bootstrap').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM login_tokens').get().n,0);
 const current=await me({env:env(DB),request:req('/api/me','GET',undefined,origin,cookie.split(';')[0])});
 assert.equal((await current.json()).user.role,'admin');
 const check=await readiness({env:env(DB),request:req('/api/admin/readiness','GET',undefined,origin,cookie.split(';')[0])});
 assert.equal(check.status,200);
 assert.equal((await request(env(DB))).status,409);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
 const prior=await originalBootstrap({env:env(DB,{ADMIN_BOOTSTRAP_ENABLED:'true'}),request:req('/api/admin/bootstrap','POST',{setup_secret:key})});
 assert.equal(prior.status,409,'first-admin provisioning cannot run after recovery');
 sql.close();
});
test('mismatched email, existing verified admin, multiple admins, any old session/token all fail closed',async()=>{
 for(const mode of ['mismatch','verified','multiple','session','token']){
  const {sql,DB}=fixture();
  user(sql,mode==='mismatch'?'wrong@example.invalid':'correct@example.invalid','admin',mode==='verified'?1:0);
  if(mode==='multiple')user(sql,'another@example.invalid','admin',0,'another-admin');
  if(mode==='session')sql.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('oldhash','old-admin','2027-01-01T00:00:00Z')").run();
  if(mode==='token')sql.prepare("INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES('oldhash','old-admin','2027-01-01T00:00:00Z')").run();
  assert.equal((await request(env(DB))).status,409,mode);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM admin_bootstrap').get().n,0);
  assert.equal(sql.prepare("SELECT email_verified FROM users WHERE id='old-admin'").get().email_verified,mode==='verified'?1:0);
  sql.close();
 }
});
test('without migration the recovery fails without changing the existing account',async()=>{
 const {sql,DB}=fixture();user(sql);
 sql.exec('DROP TABLE admin_bootstrap');
 assert.equal((await request(env(DB))).status,503);
 assert.equal(sql.prepare("SELECT email_verified FROM users WHERE id='old-admin'").get().email_verified,0);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);sql.close();
});

test('transaction rolls back when conditional verification or session insert is silently skipped',async()=>{
 for(const mode of ['skip-verification','skip-session']){
  const {sql,DB}=fixture();user(sql);
  if(mode==='skip-verification')sql.exec("CREATE TRIGGER skip_verification BEFORE UPDATE OF email_verified ON users BEGIN SELECT RAISE(IGNORE); END");
  else sql.exec("CREATE TRIGGER skip_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(IGNORE); END");
  assert.equal((await request(env(DB))).status,503,mode);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM admin_bootstrap').get().n,0,mode+' must roll back singleton');
  assert.equal(sql.prepare("SELECT email_verified FROM users WHERE id='old-admin'").get().email_verified,0,mode);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,0,mode);
  sql.close();
 }
});
test('state change between preflight and atomic batch never consumes recovery claim',async()=>{
 for(const mode of ['new-session','new-token','verified','second-admin']){
  const {sql,DB}=fixture();user(sql);
  const batch=DB.batch;
  DB.batch=async statements=>{
   if(mode==='new-session')sql.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('other-session','old-admin','2027-01-01T00:00:00Z')").run();
   if(mode==='new-token')sql.prepare("INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES('other-token','old-admin','2027-01-01T00:00:00Z')").run();
   if(mode==='verified')sql.prepare("UPDATE users SET email_verified=1 WHERE id='old-admin'").run();
   if(mode==='second-admin')user(sql,'second@example.invalid','admin',0,'second-admin');
   return batch(statements);
  };
  assert.equal((await request(env(DB))).status,503,mode);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM admin_bootstrap').get().n,0,mode);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions').get().n,mode==='new-session'?1:0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM users').get().n,mode==='second-admin'?2:1);
  sql.close();
 }
});

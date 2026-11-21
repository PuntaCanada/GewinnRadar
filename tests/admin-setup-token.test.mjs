import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPost as bootstrap} from '../functions/api/admin/bootstrap.js';
import {onRequestGet as me} from '../functions/api/me.js';
import {onRequestGet as readiness} from '../functions/api/admin/readiness.js';
import {onRequestPost as login} from '../functions/api/login.js';

function fixture(withMigration=true){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 const names=['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'];
 if(withMigration)names.push('0006_admin_bootstrap.sql');
 for(const name of names)sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const DB={
  prepare(q){return {bind(...args){return {
   _q:q,_args:args,
   first:async()=>sql.prepare(q).get(...args)??null,
   all:async()=>({results:sql.prepare(q).all(...args)}),
   run:async()=>{const x=sql.prepare(q).run(...args);return {meta:{changes:Number(x.changes)}}}
  }}}},
  async batch(stmts){
   sql.exec('BEGIN');
   try{
    const results=stmts.map(s=>{const x=sql.prepare(s._q).run(...s._args);return{meta:{changes:Number(x.changes)}}});
    sql.exec('COMMIT');return results;
   }catch(e){sql.exec('ROLLBACK');throw e}
  }
 };
 return {sql,DB};
}
const origin='https://gewinnradar.pages.dev';
const secret='a'.repeat(64);
function env(DB,overrides={}){
 return {DB,ADMIN_BOOTSTRAP_ENABLED:'true',ADMIN_BOOTSTRAP_SECRET:secret,
  ADMIN_BOOTSTRAP_EMAIL:'owner@example.invalid',LOGIN_MAIL_ENABLED:'false',...overrides};
}
function request(path,method='GET',data,opts={}){
 return new Request(origin+path,{method,headers:{
  origin:opts.origin||origin,'content-type':'application/json',
  ...(opts.cookie?{cookie:opts.cookie}:{})
 },body:data===undefined?undefined:JSON.stringify(data)});
}
const send=(settings,data={setup_secret:secret},opts={})=>bootstrap({env:settings,request:request('/api/admin/bootstrap','POST',data,opts)});
test('bootstrap defaults disabled and cannot activate without all server-side secrets',async()=>{
 const {sql,DB}=fixture();
 for(const cfg of [
  env(DB,{ADMIN_BOOTSTRAP_ENABLED:'false'}),env(DB,{ADMIN_BOOTSTRAP_SECRET:''}),
  env(DB,{ADMIN_BOOTSTRAP_EMAIL:''}),env(DB,{LOGIN_MAIL_ENABLED:'true'})
 ])assert.equal((await send(cfg)).status,403);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM users').get().n,0);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM admin_bootstrap').get().n,0);
 sql.close();
});
test('single-use session: wrong origin, wrong secret, reuse, and family login forbidden',async()=>{
 const {sql,DB}=fixture();
 const settings=env(DB);
 assert.equal((await send(settings,{setup_secret:secret},{origin:'https://other.invalid'})).status,403);
 assert.equal((await send(settings,{setup_secret:'b'.repeat(64)})).status,403);
 assert.equal((await send(settings,{setup_secret:'short'})).status,403);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM users').get().n,0);
 const first=await send(settings);
 assert.equal(first.status,201);
 assert.deepEqual(await first.json(),{ok:true,admin_ready:true,mail_sent:false});
 const cookie=first.headers.get('set-cookie');
 assert.match(cookie,/gr_session=[0-9a-f]{64}/);
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
 assert.match(cookie,/SameSite=Strict/);
 assert.equal(sql.prepare("SELECT count(*) AS n FROM users WHERE role='admin' AND email_verified=1").get().n,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM admin_bootstrap').get().n,1);
 const current=await me({request:request('/api/me','GET',undefined,{cookie:cookie.split(';')[0]}),env:settings});
 assert.equal((await current.json()).user.role,'admin');
 const diagnostic=await readiness({request:request('/api/admin/readiness','GET',undefined,{cookie:cookie.split(';')[0]}),env:settings});
 assert.equal(diagnostic.status,200,'new session accesses protected admin API');
 assert.equal((await send(settings)).status,409);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM users').get().n,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
 assert.equal((await login({request:request('/api/login','POST',{email:'owner@example.invalid'}),env:settings})).status,503);
 sql.close();
});
test('existing owner account never gets silently promoted',async()=>{
 const {sql,DB}=fixture();
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES('member','owner@example.invalid','Owner','member',1)").run();
 assert.equal((await send(env(DB))).status,409);
 assert.equal(sql.prepare("SELECT role FROM users WHERE id='member'").get().role,'member');
 sql.close();
});
test('migration requirement and atomic rollback prevent half-created owners',async()=>{
 const {sql,DB}=fixture(false);
 assert.equal((await send(env(DB))).status,503);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM users').get().n,0);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
 sql.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {hash} from '../functions/_lib/core.js';
import {loginAllowed} from '../functions/_lib/login-safety.js';
import {onRequestGet as me} from '../functions/api/me.js';
import {onRequestGet as adminList} from '../functions/api/admin/contests.js';
import {onRequestPost as adminAdd} from '../functions/api/admin/contests.js';
import {onRequestPost as login} from '../functions/api/login.js';

function localDB(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'])
  sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){const stmt=sql.prepare(query);return {
  first:async()=>stmt.get(...args)??null,
  all:async()=>({results:stmt.all(...args)}),
  run:async()=>{const result=stmt.run(...args);return {meta:{changes:Number(result.changes)}}}
 };}}}};
 return {sql,db};
}
function request(path,{session,method='GET',body}={}){
 return new Request('https://gewinnradar.pages.dev'+path,{
  method,
  headers:{...(session?{cookie:'gr_session='+session}:{}),...(body?{'content-type':'application/json',origin:'https://gewinnradar.pages.dev'}:{})},
  body:body?JSON.stringify(body):undefined
 });
}
test('Admin can be exercised offline without enabling live mail or adding production accounts',async()=>{
 const {sql,db}=localDB();
 const env={DB:db,LOGIN_MAIL_ENABLED:'false',MAIL_ENABLED:'false'};
 assert.equal(loginAllowed(env),false);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM users').get().n,0);
 const adminSession='e'.repeat(64),memberSession='f'.repeat(64);
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES ('testadmin','admin@example.invalid','Test Admin','admin',1)").run();
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES ('testmember','member@example.invalid','Test Member','member',1)").run();
 for(const [id,token] of [['testadmin',adminSession],['testmember',memberSession]])
  sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),id,'2099-01-01T00:00:00Z');
 assert.equal((await (await me({request:request('/api/me'),env})).json()).user,null);
 assert.equal((await adminList({request:request('/api/admin/contests'),env})).status,403);
 assert.equal((await adminList({request:request('/api/admin/contests',{session:memberSession}),env})).status,403);
 const r=await adminList({request:request('/api/admin/contests',{session:adminSession}),env});
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).contests,[]);
 let outbound=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>{outbound++;throw Error('No real mail allowed')};
 try{
  const response=await login({request:request('/api/login',{method:'POST',body:{email:'admin@example.invalid'}}),env});
  assert.equal(response.status,503);
  assert.equal(outbound,0);
 }finally{globalThis.fetch=original}
 assert.equal(sql.prepare('SELECT count(*) AS n FROM login_tokens').get().n,0);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM email_log').get().n,0);
 sql.close();
});
test('Authenticated users cannot elevate privileges using the public contest endpoint',async()=>{
 const {sql,db}=localDB();
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES ('testmember','member@example.invalid','Test Member','member',1)").run();
 const token='f'.repeat(64);
 sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'testmember','2099-01-01T00:00:00Z');
 const response=await adminAdd({request:request('/api/admin/contests',{method:'POST',session:token,body:{id:'fake-2026'}}),env:{DB:db}});
 assert.equal(response.status,403);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM games').get().n,0);
 sql.close();
});

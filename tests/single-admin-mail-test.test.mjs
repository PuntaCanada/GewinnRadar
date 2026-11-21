import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPost} from '../functions/api/admin-login-test.js';
const origin='https://gewinnradar.pages.dev';
const code='Q'.repeat(40);
const key='S'.repeat(48);
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0001_initial.sql','0002_review_security.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 sql.prepare("INSERT INTO users(id,email,display_name,role,senior_mode,daily_email,email_verified) VALUES('admin','admin@example.invalid','Test Admin','admin',1,0,0)").run();
 const db={prepare(query){
   const stmt=sql.prepare(query);
   return {all:async()=>({results:stmt.all()}),bind(...args){return {
    first:async()=>stmt.get(...args)??null,
    run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}})
   }}}
 }};
 const env={DB:db,LOGIN_MAIL_ENABLED:'false',ADMIN_MAGIC_LINK_TEST_ENABLED:'true',
 ADMIN_MAGIC_LINK_TEST_CODE:code,ADMIN_MAGIC_LINK_TEST_EXPIRES_AT:new Date(Date.now()+30*60*1000).toISOString().replace(/\.\d{3}Z$/,'Z'),
 LOGIN_RATE_SALT:key,BREVO_API_KEY:'mock-no-real-key',SENDER_EMAIL:'sender@example.invalid'};
 const request=(testCode=code,opts={})=>new Request(origin+'/api/admin-login-test',{method:'POST',
 headers:{origin:opts.origin??origin,'content-type':'application/x-www-form-urlencoded'},
 body:new URLSearchParams({code:testCode})});
 return {sql,db,env,request};
}
function count(sql,table){return sql.prepare('SELECT count(*) AS n FROM '+table).get().n}
test('default disabled, broad login enabled, wrong code, stale permission, and foreign origin are blocked',async()=>{
 const {sql,env,request}=setup();
 const original=globalThis.fetch;let sends=0;
 globalThis.fetch=()=>{sends++;throw Error('must not call network')};
 try {
  for(const overrides of [{ADMIN_MAGIC_LINK_TEST_ENABLED:'false'},{LOGIN_MAIL_ENABLED:'true'},
   {ADMIN_MAGIC_LINK_TEST_EXPIRES_AT:'2000-01-01T00:00:00Z'},
   {ADMIN_MAGIC_LINK_TEST_EXPIRES_AT:'2099-01-01T00:00:00Z'},
   {BREVO_API_KEY:undefined},{LOGIN_RATE_SALT:'short'}]){
    assert.equal((await onRequestPost({request:request(),env:{...env,...overrides}})).status,503);
  }
  assert.equal((await onRequestPost({request:request('wrong'),env})).status,503);
  assert.equal((await onRequestPost({request:request(code,{origin:'https://evil.invalid'}),env})).status,503);
  assert.equal(sends,0);assert.equal(count(sql,'login_tokens'),0);assert.equal(count(sql,'login_limits'),0);
 }finally{globalThis.fetch=original;sql.close()}
});
test('one admin, exactly one provider send across simultaneous requests; cannot rearm through flag or new code',async()=>{
 const {sql,env,request}=setup();
 const original=globalThis.fetch;let sends=0;
 globalThis.fetch=async(url,opts)=>{
  sends++;assert.equal(String(url),'https://api.brevo.com/v3/smtp/email');
  const body=JSON.parse(opts.body);
  assert.deepEqual(body.to,[{email:'admin@example.invalid'}]);
  assert.match(body.textContent,/\/api\/verify\?token=[a-f0-9]{64}/);
  return new Response(JSON.stringify({messageId:'mock'}),{status:201,headers:{'content-type':'application/json'}});
 };
 try{
  const responses=await Promise.all(Array.from({length:6},()=>onRequestPost({request:request(),env})));
  assert.equal(responses.filter(r=>r.status===200).length,1);
  assert.equal(sends,1);assert.equal(count(sql,'login_tokens'),1);assert.equal(count(sql,'login_limits'),1);
  const again=await onRequestPost({request:request('Z'.repeat(40)),env:{...env,ADMIN_MAGIC_LINK_TEST_CODE:'Z'.repeat(40)}});
  assert.equal(again.status,503);assert.equal(sends,1);
  assert.equal(sql.prepare('SELECT daily_email FROM users').get().daily_email,0);
 }finally{globalThis.fetch=original;sql.close()}
});
test('only one administrator must exist; no member-targeted mail',async()=>{
 const {sql,env,request}=setup(),orig=globalThis.fetch;let sends=0;
 globalThis.fetch=()=>{sends++;throw Error('must not send')};
 try{
  sql.prepare("INSERT INTO users(id,email,display_name,role) VALUES('other','other@example.invalid','Second Admin','admin')").run();
  assert.equal((await onRequestPost({request:request(),env})).status,503);
  assert.equal(count(sql,'login_tokens'),0);assert.equal(count(sql,'login_limits'),0);assert.equal(sends,0);
 }finally{globalThis.fetch=orig;sql.close()}
});
test('provider failure consumes allowance and deletes token; subsequent attempts stay denied',async()=>{
 const {sql,env,request}=setup(),orig=globalThis.fetch;let sends=0;
 globalThis.fetch=async()=>{sends++;return new Response('refused',{status:401})};
 try {
  assert.equal((await onRequestPost({request:request(),env})).status,502);
  assert.equal((await onRequestPost({request:request(),env})).status,503);
  assert.equal(sends,1);
  assert.equal(count(sql,'login_limits'),1);
  assert.equal(count(sql,'login_tokens'),0);
 }finally{globalThis.fetch=orig;sql.close()}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {hash} from '../functions/_lib/core.js';
import {onRequestGet,onRequestPost} from '../functions/api/verify.js';
import {onRequestPost as login} from '../functions/api/login.js';

const origin='https://gewinnradar.pages.dev';
function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const db={prepare(query){return {bind(...args){const statement=sql.prepare(query);return {
  first:async()=>statement.get(...args)??null,
  run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})
 };}}}};
 sql.prepare("INSERT INTO users(id,email,display_name,role,daily_email,email_verified) VALUES ('owner','admin@example.invalid','Admin','admin',0,0)").run();
 return {sql,db};
}
function ctx(path,db,{method='GET',token,originHeader=origin,contentType='application/x-www-form-urlencoded'}={}){
 const headers=method==='POST'?{'origin':originHeader,'content-type':contentType}:{};
 const body=method==='POST'?new URLSearchParams({token:token??''}):undefined;
 return {env:{DB:db},request:new Request(origin+path,{method,headers,body})};
}
test('GET confirmation never consumes login link, even after repeated prefetches',async()=>{
 const {db,sql}=setup(),token='a'.repeat(64);
 sql.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'owner',new Date(Date.now()+600000).toISOString());
 for(let n=0;n<2;n++){
  const response=await onRequestGet(ctx('/api/verify?token='+token,db));
  assert.equal(response.status,200);
  assert.match(await response.text(),/method="post"/);
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.match(response.headers.get('content-security-policy'),/form-action 'self'/);
  assert.equal(response.headers.get('set-cookie'),null);
 }
 assert.equal(sql.prepare('SELECT used_at FROM login_tokens').get().used_at,null);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
 sql.close();
});
test('user confirmation activates exactly one session and invalidates a replay',async()=>{
 const {db,sql}=setup(),token='b'.repeat(64);
 sql.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'owner',new Date(Date.now()+600000).toISOString());
 const first=await onRequestPost(ctx('/api/verify',db,{method:'POST',token}));
 assert.equal(first.status,303);
 assert.match(first.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.equal(first.headers.get('location'),'/');
 assert.equal(sql.prepare('SELECT email_verified FROM users').get().email_verified,1);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);
 assert.ok(sql.prepare('SELECT used_at FROM login_tokens').get().used_at);
 const replay=await onRequestPost(ctx('/api/verify',db,{method:'POST',token}));
 assert.equal(replay.status,303);
 assert.equal(replay.headers.get('set-cookie'),null);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);
 sql.close();
});
test('expired, malformed and cross-origin requests never create a session',async()=>{
 const {db,sql}=setup(),expired='c'.repeat(64),valid='d'.repeat(64);
 for(const [token,expiration] of [[expired,'2000-01-01T00:00:00Z'],[valid,new Date(Date.now()+600000).toISOString()]])
  sql.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'owner',expiration);
 const inputs=[
  ctx('/api/verify',db,{method:'POST',token:expired}),
  ctx('/api/verify',db,{method:'POST',token:'wrong'}),
  ctx('/api/verify',db,{method:'POST',token:valid,originHeader:'https://another.example'}),
  ctx('/api/verify',db,{method:'POST',token:valid,contentType:'text/plain'})
 ];
 for(const input of inputs){
  const response=await onRequestPost(input);
  assert.equal(response.status,303);
  assert.equal(response.headers.get('set-cookie'),null);
 }
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
 assert.equal(sql.prepare('SELECT email_verified FROM users').get().email_verified,0);
 sql.close();
});
test('login disabled: no external mail call and no login token created',async()=>{
 const {db,sql}=setup();
 let mailCalls=0;const prevFetch=globalThis.fetch;
 globalThis.fetch=async()=>{mailCalls++;throw Error('Network access forbidden in tests')};
 try {
  const request=new Request(origin+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'admin@example.invalid'})});
  const response=await login({request,env:{DB:db,LOGIN_MAIL_ENABLED:'false',MAIL_ENABLED:'false'}});
  assert.equal(response.status,503);
  assert.equal(mailCalls,0);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM login_tokens').get().n,0);
 }finally{globalThis.fetch=prevFetch;sql.close()}
});

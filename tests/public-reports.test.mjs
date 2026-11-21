import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/public-reports.js';
const domain='https://gewinnradar.pages.dev';
const env={PUBLIC_REPORTS_ENABLED:'true',PUBLIC_REPORTS_TURNSTILE_SITE_KEY:'sitekey12345678',
 PUBLIC_REPORTS_TURNSTILE_SECRET:'secret12345678',DB:{prepare(sql){
  return {bind(...args){return {async first(){return {n:0}},async run(){return {meta:{changes:1}}}}}}
 }}};
const req=(data,origin=domain)=>new Request(domain+'/api/public-reports',{
 method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
const good={contest_id:'bayern-digitalradio-2026',kind:'broken_link',
 details:'Die Seite zeigt beim Absenden eine Fehlermeldung.',turnstile_token:'abcdef0123456789'};
test('anonymous reporting defaults to disabled, no D1 or Turnstile traffic',async()=>{
 const r=await onRequestGet({env:{DB:env.DB}}),d=await r.json();
 assert.equal(d.enabled,false);assert.equal(d.site_key,null);
 assert.equal((await onRequestPost({request:req(good),env:{DB:env.DB}})).status,403);
});
test('same-origin and controlled report categories required before Turnstile',async()=>{
 assert.equal((await onRequestPost({request:req(good,'https://attacker.example'),env})).status,403);
 assert.equal((await onRequestPost({request:req({...good,kind:'other'}),env})).status,400);
 assert.equal((await onRequestPost({request:req({...good,details:'john@example.com beschreibt den Fehler'}),env})).status,400);
 assert.equal((await onRequestPost({request:req({...good,details:'Link https://not-trusted.example failed'}),env})).status,400);
});
test('Turnstile must bind hostname and action; only then D1 inserts',async()=>{
 const original=globalThis.fetch;let insertCount=0,verifiedCalls=0;
 const safeEnv={...env,DB:{prepare(sql){return {bind(){return {async first(){return {n:0}},
 async run(){if(sql.startsWith('INSERT'))insertCount++;return {meta:{changes:1}}}}}}}}};
 try{
  globalThis.fetch=async()=>{verifiedCalls++;return new Response(JSON.stringify({success:true,hostname:'evil.example',action:'gewinnradar_report'}),{status:200})};
  assert.equal((await onRequestPost({env:safeEnv,request:req(good)})).status,403);
  globalThis.fetch=async()=>{verifiedCalls++;return new Response(JSON.stringify({success:true,hostname:'gewinnradar.pages.dev',action:'wrong'}),{status:200})};
  assert.equal((await onRequestPost({env:safeEnv,request:req(good)})).status,403);
  globalThis.fetch=async()=>{verifiedCalls++;return new Response(JSON.stringify({success:true,hostname:'gewinnradar.pages.dev',action:'gewinnradar_report'}),{status:200})};
  assert.equal((await onRequestPost({env:safeEnv,request:req(good)})).status,201);
  assert.equal(insertCount,1);assert.equal(verifiedCalls,3);
 }finally{globalThis.fetch=original}
});

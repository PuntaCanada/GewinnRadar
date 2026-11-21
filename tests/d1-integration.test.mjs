import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hash} from '../functions/_lib/core.js';
import {onRequestPost as addContest,onRequestGet as listAdmin} from '../functions/api/admin/contests.js';
import {onRequestPost as review} from '../functions/api/admin/review.js';
import {onRequestGet as games} from '../functions/api/games.js';
import {onRequestPost as progress} from '../functions/api/progress.js';
import {onRequestGet as previewLogin,onRequestPost as verifyLogin} from '../functions/api/verify.js';
import {onRequestPost as login} from '../functions/api/login.js';

function dbAdapter(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'])
   sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 return {
  sqlite,
  db: {prepare(sql) {
   const stmt=sqlite.prepare(sql);
   return {bind(...values) {
    return {
     first:async()=>stmt.get(...values)??null,
     all:async()=>({results:stmt.all(...values)}),
     run:async()=>{const r=stmt.run(...values);return {meta:{changes:Number(r.changes)}}}
    };
   }};
  }}
 };
}
const address='https://gewinnradar.example';
function request(path,method='GET',body,session){
 const headers={origin:address};
 if(body!==undefined)headers['content-type']='application/json';
 if(session)headers.cookie='gr_session='+session;
 return new Request(address+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
}
const candidate=()=>({id:'advent-2026-check',organizer:'Bekannter deutscher Sender',title:'Adventskalender Testaktion',prize:'Technikpaket',url:'https://www.br.de/gewinnspiel',terms_url:'https://www.br.de/teilnahmebedingungen',privacy_url:'https://www.br.de/datenschutz',starts_at:'2026-01-01T00:00:00Z',ends_at:'2099-12-24T23:59:59Z',daily:true,required_data:'E-Mail und Name'});
const approval=()=>({id:'advent-2026-check',action:'approve',note:'Originalveranstalter, aktuelles Gewinnspiel und Werbefreiheit nachgeprüft.',checked_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),original_checked:true,terms_checked:true,privacy_checked:true,germany_eligible:true,no_mandatory_marketing:true,no_payment_required:true,human_verified:true});
test('D1-shaped SQLite: admin approval, strict catalogue gate, separate users and daily completion',async()=>{
 const {db,sqlite}=dbAdapter();
 sqlite.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES(?,?,?,?,1)").run('admin','admin@example.invalid','Admin','admin');
 sqlite.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES(?,?,?,?,1)").run('mother','mom@example.invalid','Mama','member');
 sqlite.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES(?,?,?,?,1)").run('other','other@example.invalid','Other','member');
 for(const [id,token] of [['admin','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],['mother','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'],['other','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd']])sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),id,'2099-01-01T00:00:00Z');
 const call=(handler,path,method,body,session)=>handler({request:request(path,method,body,session),env:{DB:db}});
 assert.equal((await listAdmin({request:request('/api/admin/contests','GET',undefined,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'),env:{DB:db}})).status,403);
 assert.equal((await call(addContest,'/api/admin/contests','POST',candidate(),'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).status,403);
 const added=await call(addContest,'/api/admin/contests','POST',candidate(),'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
 assert.equal(added.status,201);
 assert.equal(sqlite.prepare('SELECT status FROM games').get().status,'review');
 assert.equal((await (await call(games,'/api/games','GET',undefined,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).json()).games.length,0);
 const incomplete=approval();incomplete.privacy_checked=false;
 assert.equal((await call(review,'/api/admin/review','POST',incomplete,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).status,400);
 assert.equal(sqlite.prepare('SELECT status FROM games').get().status,'review');
 assert.equal((await call(review,'/api/admin/review','POST',approval(),'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).status,409,'No live-form proof must block approval');
 sqlite.prepare("INSERT INTO form_verifications(game_id,reviewer_id,checked_at,form_url,privacy_url,required_fields,form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict,notes) VALUES (?,?,?,?,?,?,1,1,1,1,1,1,1,?)").run('advent-2026-check','admin',new Date().toISOString(),'https://www.br.de/gewinnspiel','https://www.br.de/datenschutz','Name, E-Mail','Live-Formular 2026 und Pflichtdaten nachgewiesen');
 assert.equal((await call(review,'/api/admin/review','POST',approval(),'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).status,200);
 assert.equal(sqlite.prepare('SELECT status FROM games').get().status,'verified');
 assert.equal((await (await call(games,'/api/games','GET',undefined,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).json()).games.length,0,'Unknown link should not appear');
 sqlite.prepare("UPDATE games SET link_state='ok' WHERE id=?").run('advent-2026-check');
 assert.equal((await (await call(games,'/api/games','GET',undefined,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).json()).games.length,1);
 // A stale or revoked form review must immediately hide the contest from guests and members,
 // and must also block progress changes, even when status and link_state still say verified.
 const guest=async()=>(await (await call(games,'/api/games','GET')).json()).games.length;
 assert.equal(await guest(),1);
 sqlite.prepare("UPDATE form_verifications SET no_marketing_required=0 WHERE game_id=?").run('advent-2026-check');
 assert.equal(await guest(),0,'Revoked marketing compliance must remove public listing');
 assert.equal((await call(progress,'/api/progress','POST',{id:'advent-2026-check',action:'favorite',value:true},'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).status,404);
 sqlite.prepare("UPDATE form_verifications SET no_marketing_required=1,checked_at='2020-01-01T00:00:00Z' WHERE game_id=?").run('advent-2026-check');
 assert.equal(await guest(),0,'Stale live form proof must fail closed');
 sqlite.prepare("UPDATE form_verifications SET checked_at=? WHERE game_id=?").run(new Date().toISOString(),'advent-2026-check');
 assert.equal(await guest(),1,'Current verified form restores visibility without changing admin status');
 sqlite.prepare("UPDATE form_verifications SET checked_at=? WHERE game_id=?").run(new Date(Date.now()-26*3600000).toISOString(),'advent-2026-check');
 assert.equal(await guest(),0,'Previous-day door must not stay public');
 sqlite.prepare("UPDATE form_verifications SET checked_at=? WHERE game_id=?").run(new Date().toISOString(),'advent-2026-check');
 assert.equal(await guest(),1,'Fresh same-day check restores visibility');
 sqlite.prepare("UPDATE contest_evidence SET privacy_checked=0 WHERE game_id=?").run('advent-2026-check');
 assert.equal(await guest(),0,'Revoked human privacy evidence must fail closed');
 sqlite.prepare("UPDATE contest_evidence SET privacy_checked=1 WHERE game_id=?").run('advent-2026-check');
 assert.equal(await guest(),1);

 assert.equal((await call(progress,'/api/progress','POST',{id:'advent-2026-check',action:'completed',value:true},'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).status,200);
 assert.equal((await (await call(games,'/api/games','GET',undefined,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).json()).games[0].completed,1);
 assert.equal((await (await call(games,'/api/games','GET',undefined,'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')).json()).games[0].completed,0);
 assert.equal(sqlite.prepare('SELECT count(*) AS count FROM admin_audit').get().count,1);
 sqlite.prepare("UPDATE games SET ends_at='2000-01-01T00:00:00Z'").run();
 assert.equal((await (await call(games,'/api/games','GET',undefined,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).json()).games.length,0);
 assert.equal((await call(progress,'/api/progress','POST',{id:'advent-2026-check',action:'completed',value:true},'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')).status,404);
 sqlite.close();
});
test('one-time magic link: consumed atomically and cannot be reused',async()=>{
 const {db,sqlite}=dbAdapter();
 sqlite.prepare("INSERT INTO users(id,email,display_name,role) VALUES('mother','mom@example.invalid','Mama','member')").run();
 const token='a'.repeat(64);
 sqlite.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'mother','2099-01-01T00:00:00Z');
 const ctx={request:request('/api/verify?token='+token),env:{DB:db}};
 const preview=await previewLogin(ctx);
 assert.equal(preview.status,200);
 assert.equal(sqlite.prepare('SELECT used_at FROM login_tokens').get().used_at,null);
 const confirm=()=>({request:new Request(address+'/api/verify',{method:'POST',headers:{origin:address,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})}),env:{DB:db}});
 const first=await verifyLogin(confirm());
 assert.equal(first.status,303);
 assert.match(first.headers.get('set-cookie')||'',/HttpOnly; Secure; SameSite=Lax/);
 assert.equal(sqlite.prepare('SELECT email_verified FROM users').get().email_verified,1);
 const replay=await verifyLogin(confirm());
 assert.equal(replay.status,303);
 assert.match(replay.headers.get('location'),/login=invalid/);
 assert.equal(sqlite.prepare('SELECT count(*) AS count FROM sessions').get().count,1);
 sqlite.close();
});
test('login opt-in disabled: cannot send emails even with database and account',async()=>{
 const {db,sqlite}=dbAdapter();
 let called=0;
 const old=globalThis.fetch;
 globalThis.fetch=()=>{called++;throw Error('must not send')};
 try{
  const result=await login({request:request('/api/login','POST',{email:'mom@example.invalid'}),env:{DB:db,LOGIN_MAIL_ENABLED:'false'}});
  assert.equal(result.status,503);
  assert.equal(called,0);
 }finally{globalThis.fetch=old;sqlite.close()}
});

test('rate-limited magic link requests: maximum three emails per user/hour',async()=>{
 const {db,sqlite}=dbAdapter();
 sqlite.prepare("INSERT INTO users(id,email,display_name,role) VALUES('mother','mom@example.invalid','Mama','member')").run();
 const old=globalThis.fetch;
 let sends=0;
 globalThis.fetch=async(url,opts)=>{assert.equal(String(url),'https://api.brevo.com/v3/smtp/email');sends++;const payload=JSON.parse(opts.body);assert.equal(payload.to[0].email,'mom@example.invalid');return new Response(JSON.stringify({messageId:'test-'+sends}),{status:201,headers:{'content-type':'application/json'}})};
 const env={DB:db,LOGIN_MAIL_ENABLED:'true',LOGIN_RATE_SALT:'s'.repeat(48),BREVO_API_KEY:'mock-only-not-a-real-key',SENDER_EMAIL:'test@example.invalid'};
 try{
  for(let i=0;i<5;i++){
   const response=await login({request:request('/api/login','POST',{email:'mom@example.invalid'}),env});
   assert.equal(response.status,200);
   assert.match((await response.json()).message,/Falls ein freigeschaltetes Konto/);
  }
  assert.equal(sends,3);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM login_tokens').get().n,3);
  const unknown=await login({request:request('/api/login','POST',{email:'nonexistent@example.invalid'}),env});
  assert.equal(unknown.status,200);
  assert.equal(sends,3);
 } finally{globalThis.fetch=old;sqlite.close()}
});

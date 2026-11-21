import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hash} from '../functions/_lib/core.js';
import {onRequestPost as addContest,onRequestGet as listAdmin} from '../functions/api/admin/contests.js';
import {onRequestPost as review} from '../functions/api/admin/review.js';
import {onRequestGet as games} from '../functions/api/games.js';
import {onRequestPost as progress} from '../functions/api/progress.js';
import {onRequestGet as verifyLogin} from '../functions/api/verify.js';
import {onRequestPost as login} from '../functions/api/login.js';

function dbAdapter(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_initial.sql','0002_review_security.sql'])
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
 for(const [id,token] of [['admin','sessionAdmin'],['mother','sessionMom'],['other','sessionOther']])sqlite.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),id,'2099-01-01T00:00:00Z');
 const call=(handler,path,method,body,session)=>handler({request:request(path,method,body,session),env:{DB:db}});
 assert.equal((await listAdmin({request:request('/api/admin/contests','GET',undefined,'sessionMom'),env:{DB:db}})).status,403);
 assert.equal((await call(addContest,'/api/admin/contests','POST',candidate(),'sessionMom')).status,403);
 const added=await call(addContest,'/api/admin/contests','POST',candidate(),'sessionAdmin');
 assert.equal(added.status,201);
 assert.equal(sqlite.prepare('SELECT status FROM games').get().status,'review');
 assert.equal((await (await call(games,'/api/games','GET',undefined,'sessionMom')).json()).games.length,0);
 const incomplete=approval();incomplete.privacy_checked=false;
 assert.equal((await call(review,'/api/admin/review','POST',incomplete,'sessionAdmin')).status,400);
 assert.equal(sqlite.prepare('SELECT status FROM games').get().status,'review');
 assert.equal((await call(review,'/api/admin/review','POST',approval(),'sessionAdmin')).status,200);
 assert.equal(sqlite.prepare('SELECT status FROM games').get().status,'verified');
 assert.equal((await (await call(games,'/api/games','GET',undefined,'sessionMom')).json()).games.length,0,'Unknown link should not appear');
 sqlite.prepare("UPDATE games SET link_state='ok' WHERE id=?").run('advent-2026-check');
 assert.equal((await (await call(games,'/api/games','GET',undefined,'sessionMom')).json()).games.length,1);
 assert.equal((await call(progress,'/api/progress','POST',{id:'advent-2026-check',action:'completed',value:true},'sessionMom')).status,200);
 assert.equal((await (await call(games,'/api/games','GET',undefined,'sessionMom')).json()).games[0].completed,1);
 assert.equal((await (await call(games,'/api/games','GET',undefined,'sessionOther')).json()).games[0].completed,0);
 assert.equal(sqlite.prepare('SELECT count(*) AS count FROM admin_audit').get().count,1);
 sqlite.prepare("UPDATE games SET ends_at='2000-01-01T00:00:00Z'").run();
 assert.equal((await (await call(games,'/api/games','GET',undefined,'sessionMom')).json()).games.length,0);
 assert.equal((await call(progress,'/api/progress','POST',{id:'advent-2026-check',action:'completed',value:true},'sessionMom')).status,404);
 sqlite.close();
});
test('one-time magic link: consumed atomically and cannot be reused',async()=>{
 const {db,sqlite}=dbAdapter();
 sqlite.prepare("INSERT INTO users(id,email,display_name,role) VALUES('mother','mom@example.invalid','Mama','member')").run();
 const token='a'.repeat(64);
 sqlite.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'mother','2099-01-01T00:00:00Z');
 const ctx={request:request('/api/verify?token='+token),env:{DB:db}};
 const first=await verifyLogin(ctx);
 assert.equal(first.status,303);
 assert.match(first.headers.get('set-cookie')||'',/HttpOnly; Secure; SameSite=Lax/);
 assert.equal(sqlite.prepare('SELECT email_verified FROM users').get().email_verified,1);
 const replay=await verifyLogin(ctx);
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

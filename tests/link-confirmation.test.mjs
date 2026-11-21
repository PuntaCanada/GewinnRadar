import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hash} from '../functions/_lib/core.js';
import {onRequestPost as confirmLink} from '../functions/api/admin/link-confirmation.js';
import {onRequestPost as approve} from '../functions/api/admin/review.js';
import {onRequestGet as publicGames} from '../functions/api/games.js';

function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'])
  sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const db={prepare(q){return {bind(...args){return {
  first:async()=>sql.prepare(q).get(...args)??null,
  all:async()=>({results:sql.prepare(q).all(...args)}),
  run:async()=>{const x=sql.prepare(q).run(...args);return {meta:{changes:Number(x.changes)}}},
  _q:q,_args:args
 }}}},async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>{const x=sql.prepare(s._q).run(...s._args);return{meta:{changes:Number(x.changes)}}});sql.exec('COMMIT');return out}catch(error){sql.exec('ROLLBACK');throw error}}};
 return {sql,db};
}
test('manual original-link confirmation: unauthorized, forged, stale and incomplete reviews fail; valid proof alone cannot publish',async()=>{
 const {sql,db}=setup();
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES('a','admin@example.invalid','Admin','admin',1)").run();
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES('m','member@example.invalid','Member','member',1)").run();
 const adminToken='a'.repeat(64),memberToken='b'.repeat(64);
 for(const [id,t] of [['a',adminToken],['m',memberToken]])sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(t),id,'2099-01-01T00:00:00Z');
 sql.prepare("INSERT INTO games(id,organizer,title,prize,url,terms_url,privacy_url,starts_at,ends_at,daily,required_data,status) VALUES('mosel-test','Official host','Mosel Test','Two prizes','https://www.deinmoment-deinwein.de/weine-aus-rheinland-pfalz/mosel/gewinnspiel','https://www.deinmoment-deinwein.de/teilnahmebedingungen/mosel','https://www.deinmoment-deinwein.de/datenschutzerklaerung','2026-11-01T00:00:00Z','2099-01-01T00:00:00Z',0,'Name and e-mail','review')").run();
 const req=(path,method='GET',body,token,origin='https://gewinnradar.example')=>new Request('https://gewinnradar.example'+path,{method,headers:{origin,'content-type':'application/json',...(token?{cookie:'gr_session='+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const entry={game_id:'mosel-test',original_url:'https://www.deinmoment-deinwein.de/weine-aus-rheinland-pfalz/mosel/gewinnspiel',note:'Original-Link mit aktuellem sichtbarem Teilnahmeformular und den Datenschutzangaben geprüft.',opened_original:true,checked_no_redirect:true,checked_live_entry:true};
 const send=(body,token=adminToken,origin)=>confirmLink({request:req('/api/admin/link-confirmation','POST',body,token,origin),env:{DB:db}});
 assert.equal((await send(entry,null)).status,403);
 assert.equal((await send(entry,memberToken)).status,403);
 assert.equal((await send(entry,adminToken,'https://attacker.invalid')).status,403);
 assert.equal((await send({...entry,original_url:'https://evil.example.org/advent'})).status,409);
 assert.equal((await send({...entry,checked_live_entry:false})).status,400);
 assert.equal((await send(entry)).status,409,'No completed form-review record must block link confirmation');
 sql.prepare("INSERT INTO form_verifications(game_id,reviewer_id,checked_at,form_url,privacy_url,required_fields,form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict,notes) VALUES(?,?,?,?,?,?,1,1,1,1,1,1,1,?)")
  .run('mosel-test','a',new Date(Date.now()-8*86400000).toISOString(),entry.original_url,'https://www.deinmoment-deinwein.de/datenschutzerklaerung','Name, email, quiz','Actual original form and mandatory fields observed with optional marketing');
 assert.equal((await send(entry)).status,409,'Stale proof must never unlock public link');
 sql.prepare("UPDATE form_verifications SET checked_at=? WHERE game_id='mosel-test'").run(new Date().toISOString());
 const ok=await send(entry);
 assert.equal(ok.status,201);assert.equal((await ok.json()).contest_approved,false);
 assert.deepEqual(sql.prepare("SELECT link_state,status FROM games WHERE id='mosel-test'").get(),{link_state:'ok',status:'review'});
 const logged=sql.prepare("SELECT result,http_status,note FROM link_checks WHERE game_id='mosel-test'").get();
 assert.equal(logged.result,'ok');assert.equal(logged.http_status,null);assert.match(logged.note,/Manuelle Original-Link-Prüfung/);
 let publicResponse=await publicGames({request:req('/api/games'),env:{DB:db}});
 assert.equal((await publicResponse.json()).games.length,0,'Manual proof alone may not publish');
 const decision={id:'mosel-test',action:'approve',note:'Live original participation details and all required legal conditions manually reviewed.',checked_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),original_checked:true,terms_checked:true,privacy_checked:true,germany_eligible:true,no_mandatory_marketing:true,no_payment_required:true,human_verified:true};
 const approval=await approve({request:req('/api/admin/review','POST',decision,adminToken),env:{DB:db}});
 assert.equal(approval.status,200);
 publicResponse=await publicGames({request:req('/api/games'),env:{DB:db}});
 assert.equal((await publicResponse.json()).games.length,1,'Only after distinct manual link, form, editorial checks and approval');
 sql.close();
});

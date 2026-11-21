import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet as publicStatus} from '../functions/api/catalog-status.js';
import {onRequestGet as publicGames} from '../functions/api/games.js';

const request=new Request('https://gewinnradar.pages.dev/api/catalog-status');
function fixtures(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('PRAGMA foreign_keys=ON');
 for(const name of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'])
  sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const DB={prepare(q){return{bind(...args){return{
  first:async()=>sql.prepare(q).get(...args)??null,
  all:async()=>({results:sql.prepare(q).all(...args)})
 }}}}};
 return {sql,DB};
}
test('public status has no dependence on admin login and fails safely without production D1',async()=>{
 const missing=await publicStatus({request,env:{}});
 assert.equal(missing.status,503);
 assert.deepEqual(await missing.json(),{status:'unavailable',visible_games:null});
});
test('public status reflects EXACT public SQL publication gate, not research candidates or private audit',async()=>{
 const {sql,DB}=fixtures();
 const get=async()=>{const res=await publicStatus({request,env:{DB}});return {status:res.status,payload:await res.json()};};
 let state=await get();
 assert.equal(state.status,200);assert.equal(state.payload.visible_games,0);
 assert.equal(state.payload.database_connected,true);
 assert.equal(state.payload.catalog_limit,500);
 assert.ok(!('database_id' in state.payload));
 assert.ok(!('research_candidates' in state.payload));
 sql.prepare("INSERT INTO research_candidates(id,year,canonical_key,organizer,title,prize,url,terms_url,source_url,starts_on,ends_on,cadence,required_data,privacy_tier,review_note,research_state) VALUES('pfalz-test',2026,'2026:https://dwi.example/','DWI','Pfalz','Reise','https://dwi.example/','https://dwi.example/terms','https://dwi.example/terms','2026-11-01','2026-12-31','single','Name','medium','Original recherchiert','candidate')").run();
 state=await get();assert.equal(state.payload.visible_games,0,'staging may never count as public');
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES('a','admin@example.invalid','Admin','admin',1)").run();
 sql.prepare("INSERT INTO games(id,organizer,title,prize,url,terms_url,privacy_url,starts_at,ends_at,daily,required_data,status,link_state,verified_at) VALUES('pfalz-game','DWI','Pfalz','Reise','https://dwi.example/','https://dwi.example/terms','https://dwi.example/privacy','2026-01-01T00:00:00Z','2099-12-31T23:59:59Z',0,'Name','verified','unknown',?)").run(new Date().toISOString());
 state=await get();assert.equal(state.payload.visible_games,0,'verified status alone must not publish');
 sql.prepare("INSERT INTO contest_evidence(game_id,reviewer_id,checked_at,note,original_checked,terms_checked,privacy_checked,germany_eligible,no_mandatory_marketing,no_payment_required,human_verified) VALUES('pfalz-game','a',?,'checked',1,1,1,1,1,1,1)").run(new Date().toISOString());
 sql.prepare("INSERT INTO form_verifications(game_id,reviewer_id,checked_at,form_url,privacy_url,required_fields,form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict,notes) VALUES('pfalz-game','a',?,'https://dwi.example/','https://dwi.example/privacy','Name, E-Mail',1,1,1,1,1,1,1,'form checked')").run(new Date().toISOString());
 state=await get();assert.equal(state.payload.visible_games,0,'unknown original link remains blocked');
 sql.prepare("UPDATE games SET link_state='ok' WHERE id='pfalz-game'").run();
 state=await get();assert.equal(state.payload.visible_games,1);
 const actual=await publicGames({request:new Request('https://gewinnradar.pages.dev/api/games'),env:{DB}});
 assert.equal((await actual.json()).games.length,state.payload.visible_games,'D1 health must exactly match visible public API');
 sql.prepare("UPDATE form_verifications SET no_marketing_required=0 WHERE game_id='pfalz-game'").run();
 state=await get();assert.equal(state.payload.visible_games,0,'revoked safety approval must immediately hide');
 sql.close();
});

test('public games fail closed with consistent 503 if D1 is missing or queries fail',async()=>{
 const missing=await publicGames({request:new Request('https://gewinnradar.pages.dev/api/games'),env:{}});
 assert.equal(missing.status,503);
 assert.match((await missing.json()).error,/Datenbank/);
 const brokenDB={prepare(){throw Error('Sensitive internal D1 binding error')}};
 const failed=await publicGames({request:new Request('https://gewinnradar.pages.dev/api/games'),env:{DB:brokenDB}});
 assert.equal(failed.status,503);
 const body=await failed.json();
 assert.match(body.error,/vorübergehend nicht verfügbar/);
 assert.ok(!JSON.stringify(body).includes('Sensitive internal D1'));
 assert.equal('games' in body,false,'D1 failure must not masquerade as an empty catalog');
});

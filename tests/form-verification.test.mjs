import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {hash} from '../functions/_lib/core.js';import {onRequestPost as formPost} from '../functions/api/admin/form-verification.js';
function setup(){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));return sql}
test('form review requires separate authenticated admin and all seven live checks',async()=>{
 const sql=setup();sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES ('a','admin@example.invalid','Admin','admin',1)").run();
 const token='e'.repeat(64);sql.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(await hash(token),'a','2099-01-01T00:00:00Z');
 sql.prepare("INSERT INTO games(id,organizer,title,prize,url,terms_url,privacy_url,starts_at,ends_at,daily,required_data,status) VALUES ('test','Example','Test Calendar','Prize','https://www.br.de/g','https://www.br.de/terms','https://www.br.de/privacy','2026-01-01T00:00:00Z','2099-01-01T00:00:00Z',1,'email','review')").run();
 const db={
  prepare(query){
   return {bind(...args){
    return {
     first:async()=>sql.prepare(query).get(...args)||null,
     run:async()=>{const x=sql.prepare(query).run(...args);return{meta:{changes:Number(x.changes)}}}
    };
   }};
  }
 };
 const body={game_id:'test',form_url:'https://www.br.de/g',privacy_url:'https://www.br.de/privacy',required_fields:'Email address only',notes:'Confirmed the real 2026 entry form without required marketing consent.',form_observed:true,correct_year:true,german_residents:true,no_marketing_required:true,no_purchase_required:true,no_account_or_app_obligation:true,no_unresolved_deadline_conflict:true};
 const send=async(data,authenticated=true)=>formPost({request:new Request('https://example.org/api/admin/form-verification',{method:'POST',headers:{origin:'https://example.org','content-type':'application/json',...(authenticated?{cookie:'gr_session='+token}:{})},body:JSON.stringify(data)}),env:{DB:db}});
 assert.equal((await send(body,false)).status,403);
 assert.equal((await send({...body,no_marketing_required:false})).status,409);
 assert.equal((await send({...body,privacy_url:'https://evil.example/pp'})).status,400);
 assert.equal((await send({...body,form_url:'https://www.br.de/adventskalender-2025'})).status,409,'explicit wrong-year URL must not pass');
 assert.equal(sql.prepare('SELECT count(*) AS n FROM form_verifications').get().n,0);
 assert.equal((await send(body)).status,201);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM form_verifications').get().n,1);
 sql.prepare("UPDATE games SET status='verified' WHERE id='test'").run();
 sql.prepare("UPDATE form_verifications SET checked_at='2026-12-01T08:00:00Z' WHERE game_id='test'").run();
 const rereview=await send({...body,notes:'Today\'s different 2026 door form was checked again; no mandatory consent.'});
 assert.equal(rereview.status,201,'approved daily calendar must be re-reviewable');
 assert.equal((await rereview.json()).previously_approved,true);
 assert.notEqual(sql.prepare("SELECT checked_at FROM form_verifications WHERE game_id='test'").get().checked_at,'2026-12-01T08:00:00Z');
 assert.equal(sql.prepare("SELECT status FROM games WHERE id='test'").get().status,'verified','recheck must not mutate approval status');
 sql.prepare("UPDATE games SET status='rejected' WHERE id='test'").run();
 assert.equal((await send(body)).status,409,'rejected candidate cannot be reapproved via form review');

 assert.equal(sql.prepare("SELECT count(*) AS n FROM games WHERE status='verified'").get().n,0);
 sql.close();
});

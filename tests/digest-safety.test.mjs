import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hash} from '../functions/_lib/core.js';
import {sendDigest,berlin} from '../worker/index.js';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql','0004_source_evidence.sql','0005_form_and_reminders.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const db={prepare(query){return{bind(...args){return{
  first:async()=>sql.prepare(query).get(...args)||null,
  all:async()=>({results:sql.prepare(query).all(...args)}),
  run:async()=>{const r=sql.prepare(query).run(...args);return{meta:{changes:Number(r.changes)}}}
 }}}}};
 return {sql,db};
}
test('real SQLite digest: no family reminders without independent approved daily window',async()=>{
 const {sql,db}=setup(),old=globalThis.fetch;
 let requests=0;globalThis.fetch=async(url)=>{
  assert.equal(String(url),'https://api.brevo.com/v3/smtp/email');
  requests++;return new Response(JSON.stringify({messageId:'mock-only'}),{status:201,headers:{'content-type':'application/json'}});
 };
 try{
  const user='u',game='g';
  sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified,daily_email,consent_at) VALUES(?,?,?,'member',1,1,?)").run(user,'test@example.invalid','Test',new Date().toISOString());
  sql.prepare("INSERT INTO games(id,organizer,title,prize,url,terms_url,privacy_url,starts_at,ends_at,daily,status,required_data,link_state,verified_at) VALUES(?,?,?,?,?,?,?,?,?,1,'verified','email','ok',?)")
    .run(game,'Original','Test calendar','Prize','https://www.br.de/g','https://www.br.de/terms','https://www.br.de/privacy','2020-01-01T00:00:00Z','2099-01-01T00:00:00Z',new Date().toISOString());
  sql.prepare("INSERT INTO favorites(user_id,game_id) VALUES(?,?)").run(user,game);
  const env={DB:db,MAIL_ENABLED:'false',BREVO_API_KEY:'mock-not-real',SENDER_EMAIL:'test@example.invalid',PUBLIC_BASE_URL:'https://example.invalid/'};
  assert.deepEqual(await sendDigest(env),{skipped:'disabled'});
  env.MAIL_ENABLED='true';
  assert.equal((await sendDigest(env)).sent,0);
  assert.equal(requests,0,'Without verified form or approved time window never send');
  sql.prepare("INSERT INTO form_verifications(game_id,reviewer_id,checked_at,form_url,privacy_url,required_fields,form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict,notes) VALUES(?,?,?,?,?,?,1,1,1,1,1,1,1,?)")
    .run(game,user,new Date().toISOString(),'https://www.br.de/g','https://www.br.de/privacy','email','Mocked form proof for offline test only');
  assert.equal((await sendDigest(env)).sent,0);
  assert.equal(requests,0,'Form review alone is not enough');
  const now=Date.now();
  sql.prepare("INSERT INTO reminder_windows(game_id,day,start_utc,end_utc,review_state,original_source,note) VALUES(?,?,?,?,'pending',?,?)")
    .run(game,berlin(),new Date(now-3600000).toISOString(),new Date(now+3600000).toISOString(),'https://www.br.de/terms','Mocked reminder day awaiting explicit release');
  assert.equal((await sendDigest(env)).sent,0);
  sql.prepare("UPDATE reminder_windows SET review_state='approved' WHERE game_id=?").run(game);
  assert.equal((await sendDigest(env)).sent,1);
  assert.equal(requests,1);
  assert.equal((await sendDigest(env)).sent,0,'Idempotent per user/day');
  assert.equal(requests,1);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM email_log').get().n,1);
 }finally{globalThis.fetch=old;sql.close()}
});

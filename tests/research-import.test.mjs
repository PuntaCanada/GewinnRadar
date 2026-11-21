import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestPost as importResearch,onRequestGet as readResearch} from '../functions/api/admin/research-import.js';
import {hash} from '../functions/_lib/core.js';
import {DatabaseSync} from 'node:sqlite';
const entries=JSON.parse(readFileSync(new URL('../catalog/research-2026.json',import.meta.url),'utf8')).entries;
function localDB(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const n of ['0001_initial.sql','0002_review_security.sql','0003_catalog_staging.sql'])sql.exec(readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8'));
 const d={prepare(query){return{bind(...args){return {first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>{const r=sql.prepare(query).run(...args);return{meta:{changes:Number(r.changes)}}},_sql:query,_args:args}}}},async batch(stmts){const rs=[];sql.exec('BEGIN');try{for(const s of stmts){const r=sql.prepare(s._sql).run(...s._args);rs.push({meta:{changes:Number(r.changes)}})}sql.exec('COMMIT');return rs}catch(e){sql.exec('ROLLBACK');throw e}}};
 return{sql,d};
}
test('real SQLite-backed admin dry-run, import dedupe and isolation from public games',async()=>{
 const {sql,d}=localDB();
 sql.prepare("INSERT INTO users(id,email,display_name,role,email_verified) VALUES('a','admin@example.invalid','Admin','admin',1)").run();
 const token='f'.repeat(64);
 sql.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(await hash(token),'a','2099-01-01T00:00:00Z');
 const call=async(data)=>importResearch({request:new Request('https://example.org/api/admin/research-import',{method:'POST',headers:{origin:'https://example.org','content-type':'application/json',cookie:'gr_session='+token},body:JSON.stringify(data)}),env:{DB:d}});
 let r=await call({entries});assert.equal(r.status,200);assert.equal((await r.json()).dry_run,true);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM research_candidates').get().n,0);
 r=await call({entries,commit:true});assert.equal(r.status,200);
 assert.equal((await r.json()).accepted,entries.length);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM games').get().n,0);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM research_candidates').get().n,entries.length);
 r=await call({entries,commit:true});assert.equal((await r.json()).duplicates,entries.length);
 const unauthorized=await importResearch({request:new Request('https://example.org/api/admin/research-import',{method:'POST',headers:{origin:'https://example.org','content-type':'application/json'},body:JSON.stringify({entries,commit:true})}),env:{DB:d}});
 assert.equal(unauthorized.status,403);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM games').get().n,0);
 sql.close();
});

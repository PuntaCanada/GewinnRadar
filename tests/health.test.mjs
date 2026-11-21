import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/health.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

test('read-only production health requires actual D1 tables but leaks no user data',async()=>{
  assert.equal((await onRequestGet({env:{}})).status,503);
  const sql=new DatabaseSync(':memory:');
  const db={prepare(query){return{all:async()=>({results:sql.prepare(query).all()})}}};
  assert.equal((await onRequestGet({env:{DB:db}})).status,503);
  sql.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  const r=await onRequestGet({env:{DB:db}});
  assert.equal(r.status,200);
  const data=await r.json();
  assert.deepEqual(data,{ok:true,db_ready:true});
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(JSON.stringify(data).includes('@'),false);
  sql.close();
});

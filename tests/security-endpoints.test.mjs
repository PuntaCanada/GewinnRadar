import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as login} from '../functions/api/login.js';
import {onRequestPost as approve} from '../functions/api/admin/review.js';
import {onRequestGet as adminGet} from '../functions/api/admin/contests.js';
import {onRequestGet as gamesGet} from '../functions/api/games.js';
const request=(path,method='POST',origin='https://example.pages.dev')=>new Request('https://example.pages.dev'+path,{method,headers:{origin,'content-type':'application/json'},body:method==='POST'?'{}':undefined});
const ctx=(req)=>({request:req,env:{}});
test('login completely disabled without explicit opt-in and does not use mail',async()=>{
 const r=await login(ctx(request('/api/login')));
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/noch nicht freigeschaltet/);
});
test('cross-origin mutations are denied without touching database',async()=>{
 const r=await approve(ctx(request('/api/admin/review','POST','https://evil.example')));
 assert.equal(r.status,403);
});
test('nonadmins cannot access admin listings',async()=>{
 const r=await adminGet(ctx(request('/api/admin/contests','GET')));
 assert.equal(r.status,403);
});
test('anonymous guests can read only public approved contests with no personal data',async()=>{
 let statement='', bindings=[];
 const db={prepare(sql){statement=sql;return {bind(...args){bindings=args;return {async all(){return {results:[]}}}}}}};
 const r=await gamesGet({request:request('/api/games','GET'),env:{DB:db}});
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).games,[]);
 assert.match(statement,/human_verified=1/);
 assert.match(statement,/g.status='verified'/);
 assert.doesNotMatch(statement,/favorites|participations|sessions/);
 assert.equal(bindings.length,2);
});

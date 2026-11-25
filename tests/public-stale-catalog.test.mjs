import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('public guest catalogue fails closed and discards stale approved entries',()=>{
 assert.match(script,/games=\[\];lastLoadedAt=0;lastLoadedDay='';render\(\)/);
 assert.match(script,/Aktuelle Gewinnspiele konnten nicht geprüft werden/);
 assert.match(script,/if\(!Array\.isArray\(r\.games\)\)/);
});
test('returning visitor checks Berlin daily boundary, without background polling or mail',()=>{
 assert.match(script,/Europe\/Berlin/);
 assert.match(script,/visibilitychange',refreshOnResume/);
 assert.match(script,/focus',refreshOnResume/);
 assert.match(script,/berlinDay\(\)!==lastLoadedDay/);
 assert.doesNotMatch(script,/setInterval|sendBrevo|BREVO_API_KEY/);
});

import vm from 'node:vm';
test('cross-midnight catalogue responses are discarded and retried once',async()=>{
 const source=script.slice(script.indexOf('function refresh(){'),script.indexOf('function render(){'));
 let day='2026-11-30',calls=0;const rendered=[];
 const ctx=vm.createContext({games:[],lastLoadedAt:0,lastLoadedDay:'',inflight:null,berlinDay:()=>day,api:async()=>{calls++;if(calls===1){day='2026-12-01';return {games:[{id:'old'}]}}return {games:[{id:'new'}]}},render:()=>rendered.push(JSON.stringify(ctx.games)),Date,document:{visibilityState:'visible'}});
 vm.runInContext(source,ctx);await ctx.refresh();
 assert.equal(calls,2);assert.equal(ctx.lastLoadedDay,'2026-12-01');assert.deepEqual(rendered,['[]','[{"id":"new"}]']);
});
test('browser history restoration checks catalogue freshness',()=>{assert.match(script,/pageshow',refreshOnResume/);});
test('second crossing fails closed instead of retrying indefinitely',async()=>{
 const source=script.slice(script.indexOf('function refresh(){'),script.indexOf('function render(){'));
 let day=0,calls=0;const ctx=vm.createContext({games:[{id:'old'}],lastLoadedAt:1,lastLoadedDay:'old',inflight:null,berlinDay:()=>String(day),api:async()=>{calls++;day++;return {games:[{id:'stale'}]}},render:()=>{},$:()=>({replaceChildren(){}}),el:()=>({}),Date,document:{visibilityState:'visible'}});
 vm.runInContext(source,ctx);await ctx.refresh();assert.equal(calls,2);assert.equal(ctx.games.length,0);assert.equal(ctx.lastLoadedDay,'');
});

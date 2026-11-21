import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditResearch,canonicalContestUrl,catalogKey,validateResearch,eligibleToday} from '../functions/_lib/catalog.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/research-2026.json',import.meta.url),'utf8'));
test('all researched 2026 sources uniquely tracked and unapproved',()=>{
 const audit=auditResearch(catalog.entries);
 assert.equal(audit.ok,true,JSON.stringify(audit.errors));
 assert.ok(audit.total>=8);
 assert.ok(catalog.entries.every(x=>x.human_approved===false&&x.allowed_for_reminders===false&&x.verified_at===null));
});
test('tracking params, fragments, trailing slash normalize and duplicate by original URL/year',()=>{
 assert.equal(canonicalContestUrl('https://www.br.de/abc/?utm_source=share&fbclid=123#form'),'https://www.br.de/abc');
 const e=catalog.entries[0];
 assert.equal(catalogKey(e),catalogKey({...e,url:e.url+'?utm_campaign=x'}));
 assert.equal(auditResearch([e,{...e,id:'another-candidate'}]).ok,false);
});
test('reject marketing, invalid URLs and fake approval flags',()=>{
 const e=catalog.entries[0];
 for(const patch of [{human_approved:true},{allowed_for_reminders:true},{verified_at:'2026-11-21'},{url:'http://127.0.0.1/'},{privacy_tier:'blocked'},{ends_on:'2026-01-01'}]) assert.ok(validateResearch({...e,...patch}).error,JSON.stringify(patch));
});
test('exclude marketing/member actions and only include specified days',()=>{
 const pilot=catalog.entries.find(e=>e.id==='pilot-2026');
 assert.equal(eligibleToday(pilot,'2026-12-01'),true);
 assert.equal(eligibleToday(pilot,'2026-12-22'),false);
 assert.equal(eligibleToday(pilot,'2026-12-24'),true);
 assert.equal(eligibleToday(pilot,'2026-12-25'),false);
 assert.equal(eligibleToday(catalog.entries.find(e=>e.id==='openexperience-2026'),'2026-12-01'),false);
});

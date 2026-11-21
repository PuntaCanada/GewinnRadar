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

test('year-round source wave: real organizer evidence but zero automatic public approvals',()=>{
 const wave=catalog.entries.filter(e=>['kala-art-giesspulver-2026','bergzeit-la-sportiva-2026','mosel-weinwochenende-2026','braut-saal-gutschein-2026','prosafecon-quiz-2026','lidl-weihnachtsaktion-2026','elamo-wunschwochen-2026','gesund-app-registrierung-2026','stryve-social-comment-2026','stihl-herbstprospekt-2026','fellinora-newsletterbox-2026'].includes(e.id));
 assert.equal(wave.length,11);
 assert.equal(wave.filter(e=>e.state==='candidate').length,5);
 assert.equal(wave.filter(e=>e.state==='excluded').length,6);
 assert.equal(wave.filter(e=>e.human_approved||e.allowed_for_reminders||e.verified_at!==null).length,0);
 assert.ok(wave.every(e=>e.cadence==='single'&&e.source_url.startsWith('https://')&&e.review_note.length>=50));
 assert.ok(wave.filter(e=>e.state==='candidate').every(e=>/noch|nicht|prüfen|Freigabe/i.test(e.review_note)));
 assert.equal(eligibleToday(wave.find(e=>e.id==='elamo-wunschwochen-2026'),'2026-11-22'),false,'mandatory marketing cannot be published as eligible');
 assert.equal(eligibleToday(wave.find(e=>e.id==='prosafecon-quiz-2026'),'2026-11-22'),false,'future one-time action cannot be marked open');
});

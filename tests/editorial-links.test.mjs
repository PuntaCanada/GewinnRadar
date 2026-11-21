import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleEditorialLinks,editorialDeadline,readGuestCompleted,writeGuestCompleted} from '../public/editorial-links.js';
const data=JSON.parse(readFileSync(new URL('../public/editorial-links-2026.json',import.meta.url),'utf8'));
test('public source links are genuine separately reviewed entries, no D1 approval',()=>{
 assert.equal(data.schema_version,1);
 assert.equal(data.active.length,11);
 assert.equal(data.preview.length,3);
 assert.equal(new Set([...data.active,...data.preview].map(x=>x.id)).size,14);
 for(const e of [...data.active,...data.preview]){
  for(const k of ['url','terms_url'])assert.equal(new URL(e[k]).protocol,'https:');
 }
 assert.equal(data.active[0].privacy_url,'https://www.bayerndigitalradio.de/datenschutz/');
});
test('live link expires automatically and previews never become clickable participation cards',()=>{
 const before=eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00'));
 assert.equal(before.live.length,11);
 assert.equal(before.future.length,3);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-26T00:00:00+01:00')).live.length,8)
 assert.equal(eligibleEditorialLinks(data,new Date('2027-01-01T00:00:00+01:00')).live.length,0);
 assert.equal(eligibleEditorialLinks(data,new Date('2027-01-01T00:00:00+01:00')).future.length,0);
});
test('unverified or malformed source entries cannot appear as active',()=>{
 const mutated=structuredClone(data);
 mutated.active[0].privacy_url='http://not-secure.invalid';
 assert.equal(eligibleEditorialLinks(mutated,new Date('2026-11-21T12:00:00+01:00')).live.length,10);
 mutated.active[0].privacy_url=data.active[0].privacy_url;
 mutated.active[0].reviewed_on='unknown';
 assert.equal(eligibleEditorialLinks(mutated,new Date('2026-11-21T12:00:00+01:00')).live.length,10);
});

test('deadline shows the last eligible date, not exclusive expiry or review date',()=>{
 assert.match(editorialDeadline('2026-11-26T00:00:00+01:00'),/25\.11\.2026.*23:59/);
 assert.match(editorialDeadline('2027-01-01T00:00:00+01:00'),/31\.12\.2026.*23:59/);
 assert.equal(editorialDeadline('invalid'),null);
});
test('a future daily research review is allowed, but stale or future-dated evidence is rejected',()=>{
 const next=structuredClone(data);next.active[0].reviewed_on='2026-11-23';
 assert.equal(eligibleEditorialLinks(next,new Date('2026-11-23T12:00:00+01:00')).live.length,11);
 assert.equal(eligibleEditorialLinks(next,new Date('2026-11-22T12:00:00+01:00')).live.length,10);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-12-02T12:00:00+01:00')).live.length,0);
});

test('user report is not proof: only evidence-confirmed blacklist entries block the targeted game',()=>{
 const now=new Date('2026-11-21T12:00:00+01:00');
 const safe=structuredClone(data);
 safe.blacklist=[{id:'bergzeit-la-sportiva-2026',verified:false,reason:'user reported'}];
 assert.equal(eligibleEditorialLinks(safe,now).live.length,11);
 safe.blacklist[0].verified=true;
 assert.equal(eligibleEditorialLinks(safe,now).live.length,10);
 assert.ok(!eligibleEditorialLinks(safe,now).live.some(g=>g.id==='bergzeit-la-sportiva-2026'));
 assert.equal(data.review_candidates.length,3);
});

test('social and messenger draws carry distinct disclosure metadata and still expire',()=>{
 const social=data.active.filter(g=>g.participation_type&&g.participation_type!=='web_form');
 assert.equal(social.length,4);
 for(const item of social){
  assert.ok(['instagram','social','whatsapp_email'].includes(item.participation_type));
  assert.match(item.marketing_requirements,/Konto|WhatsApp|Instagram|Social/);
  assert.ok(item.required_data.length>45);
  assert.ok(item.note.includes('nicht')||item.note.includes('Keine'));
 }
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-25T00:00:00+01:00')).live.some(g=>g.id==='partner-wera-social-2026'),false);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-26T00:00:00+01:00')).live.some(g=>g.id==='cloetta-candyking-instagram-2026'),false);
});

test('FALKEN bike giveaway has a verified cutoff of precisely 18:00 and no tire purchase',()=>{
 const game=data.active.find(x=>x.id==='falken-bulls-bikes-2026');
 assert.ok(game);
 assert.equal(game.deadline_label,'30.11.2026 · 18:00 Uhr');
 assert.equal(game.ends_at,'2026-11-30T18:00:00+01:00');
 assert.match(game.marketing_requirements,/Kein Kauf/);
 assert.match(game.note,/Zusatzgewinnspiel/);
 // Isolate the deadline from the independent eight-day re-verification guard.
 const rechecked=structuredClone(data);
 rechecked.active.find(x=>x.id===game.id).reviewed_on='2026-11-30';
 assert.equal(eligibleEditorialLinks(rechecked,new Date('2026-11-30T17:59:59+01:00')).live.some(x=>x.id===game.id),true);
 assert.equal(eligibleEditorialLinks(rechecked,new Date('2026-11-30T18:00:00+01:00')).live.some(x=>x.id===game.id),false);
});

test('live actions show nearest deadlines first, independent of source order',()=>{
 const when=new Date('2026-11-21T12:00:00+01:00');
 const list=structuredClone(data);
 list.active.reverse();
 const ordered=eligibleEditorialLinks(list,when).live;
 assert.equal(ordered.length,11);
 const endTimes=ordered.map(g=>Date.parse(g.ends_at));
 assert.deepEqual(endTimes,[...endTimes].sort((a,b)=>a-b));
 assert.equal(ordered[0].id,'partner-wera-social-2026'); // 24 Nov
 assert.equal(ordered[1].id,'bayern-digitalradio-2026'); // tie on 25 Nov, title A-Z
 assert.equal(ordered[2].id,'cloetta-candyking-instagram-2026');
 assert.equal(ordered[3].id,'stilbruch-registration-2026'); // 29 Nov
 assert.equal(ordered[4].id,'falken-bulls-bikes-2026'); // 30 Nov 18:00
 // A distinct draw ending earlier on the same date outranks a later one.
 const withSameDay=structuredClone(list);
 withSameDay.active.find(g=>g.id==='stryve-christmas-social-2026').ends_at='2026-11-30T17:00:00+01:00';
 const different=eligibleEditorialLinks(withSameDay,when).live.map(g=>g.id);
 assert.ok(different.indexOf('stryve-christmas-social-2026')<different.indexOf('falken-bulls-bikes-2026'));
});

test('STRYVE social draw has stated conditions and expires after 15 Dec',()=>{
 const g=data.active.find(x=>x.id==='stryve-christmas-social-2026');
 assert.ok(g);
 assert.equal(g.participation_type,'social');
 assert.equal(g.ends_at,'2026-12-16T00:00:00+01:00');
 assert.match(g.marketing_requirements,/Kein Kauf/);
 assert.match(g.note,/nicht separat geöffnet/);
});

test('guest participation marks persist independently per prize draw and can be removed',()=>{
 const m=new Map();
 const store={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 assert.equal(readGuestCompleted(store,'partner-wera-social-2026'),false);
 assert.equal(writeGuestCompleted(store,'partner-wera-social-2026',true),true);
 assert.equal(readGuestCompleted(store,'partner-wera-social-2026'),true);
 assert.equal(readGuestCompleted(store,'cloetta-candyking-instagram-2026'),false);
 assert.equal(writeGuestCompleted(store,'partner-wera-social-2026',false),true);
 assert.equal(readGuestCompleted(store,'partner-wera-social-2026'),false);
 assert.equal(m.size,0);
});
test('guest marks do not create arbitrary localStorage keys or throw if storage disabled',()=>{
 const m=new Map();
 const store={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 assert.equal(writeGuestCompleted(store,'../../api/admin',true),false);
 assert.equal(readGuestCompleted(store,'../../api/admin'),false);
 assert.equal(m.size,0);
 const disabled={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 assert.equal(writeGuestCompleted(disabled,'guest-fallback-2026',true),false);
 assert.equal(readGuestCompleted(disabled,'guest-fallback-2026'),true);
 assert.equal(writeGuestCompleted(disabled,'guest-fallback-2026',false),false);
 assert.equal(readGuestCompleted(disabled,'guest-fallback-2026'),false);
});

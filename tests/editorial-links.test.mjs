import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleEditorialLinks,editorialDeadline,readGuestCompleted,writeGuestCompleted} from '../public/editorial-links.js';
const data=JSON.parse(readFileSync(new URL('../public/editorial-links-2026.json',import.meta.url),'utf8'));
test('all 16 previously limited sources have a fresh, source-specific attempt without inventing a new reviewed_on',()=>{
 const limitedIds=["cloetta-candyking-instagram-2026","falken-bulls-bikes-2026","gesundde-register-win-2026","smyths-wishlist-2026","avermedia-elena-console-2026","wed2b-black-friday-dress-2026","radio-brocken-familienquiz-2026","steinbach-simple-spa-2026","edeka-kuhlmann-ps5-reel-2026","suelzle-wimmelbild-ballonfahrt-2027","robby-bubble-spiel-dich-schlau-2027","deg-heimspiel-tickets-2027","topps-match-attax-cl-finale-2027","littlejohnbikes-cannondale-newsletter-2026","sommer-ipad-newsletter-2027","techniktipp-finde-den-fehler-2026"];
 for(const id of limitedIds){
  const g=data.active.find(x=>x.id===id);
  assert.ok(g&&g.source_audit?.attempt_on==='2026-11-21',id);
  assert.ok(g.source_audit.attempt_url.startsWith('https://'),id);
  assert.ok(g.source_audit.summary.length>45,id);
  assert.equal(g.reviewed_on,'2026-11-21',id);
 }
 const counts=Object.fromEntries(['confirmed','partial','blocked','unconfirmed'].map(status=>[status,data.active.filter(g=>g.source_audit?.status===status).length]));
 assert.deepEqual(counts,{confirmed:29,partial:10,blocked:2,unconfirmed:1});
});

test('public source links are genuine separately reviewed entries, no D1 approval',()=>{
 assert.equal(data.schema_version,1);
 assert.equal(data.active.length,42);
 assert.ok(data.active.every(g=>g.source_audit?.checked_on==='2026-11-21'&&new URL(g.source_audit?.evidence_url).protocol==='https:'));
 assert.deepEqual(new Set(data.active.map(g=>g.source_audit.status)),new Set(['confirmed','partial','blocked','unconfirmed']));
 assert.ok(data.active.every(g=>g.reviewed_on==='2026-11-21'),'historische Prüfdatumsangaben bleiben unverändert');
 assert.equal(data.preview.length,4);
 assert.equal(data.preview.filter(g=>g.promoted_to).length,3,'Original-Vorschauen bleiben als historische Prüfnachweise erhalten');
 const bingo=data.preview.find(x=>x.id==='great-body-xmas-bingo-2026');
 assert.ok(bingo&&bingo.starts_on==='2026-12-01'&&bingo.ends_on==='2026-12-24');
 assert.match(bingo.note,/ohne Kauf ausschließlich im Great Body Store/);
 assert.equal(data.active.some(x=>x.id===bingo.id),false);
 assert.equal(new Set([...data.active,...data.preview].map(x=>x.id)).size,46);
 for(const e of [...data.active,...data.preview]){
  for(const k of ['url','terms_url'])assert.equal(new URL(e[k]).protocol,'https:');
 }
 assert.equal(data.active[0].privacy_url,'https://www.bayerndigitalradio.de/datenschutz/');
});
test('live link expires automatically and previews never become clickable participation cards',()=>{
 const before=eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00'));
 assert.equal(before.live.length,42);
 assert.equal(before.future.length,1);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-26T00:00:00+01:00')).live.length,38)
 assert.equal(eligibleEditorialLinks(data,new Date('2027-01-01T00:00:00+01:00')).live.length,0);
 assert.equal(eligibleEditorialLinks(data,new Date('2027-01-01T00:00:00+01:00')).future.length,0);
});
test('unverified or malformed source entries cannot appear as active',()=>{
 const mutated=structuredClone(data);
 mutated.active[0].privacy_url='http://not-secure.invalid';
 assert.equal(eligibleEditorialLinks(mutated,new Date('2026-11-21T12:00:00+01:00')).live.length,41);
 mutated.active[0].privacy_url=data.active[0].privacy_url;
 mutated.active[0].reviewed_on='unknown';
 assert.equal(eligibleEditorialLinks(mutated,new Date('2026-11-21T12:00:00+01:00')).live.length,41);
});

test('deadline shows the last eligible date, not exclusive expiry or review date',()=>{
 assert.match(editorialDeadline('2026-11-26T00:00:00+01:00'),/25\.11\.2026.*23:59/);
 assert.match(editorialDeadline('2027-01-01T00:00:00+01:00'),/31\.12\.2026.*23:59/);
 assert.equal(editorialDeadline('invalid'),null);
});
test('a future daily research review is allowed, but stale or future-dated evidence is rejected',()=>{
 const next=structuredClone(data);next.active[0].reviewed_on='2026-11-23';
 assert.equal(eligibleEditorialLinks(next,new Date('2026-11-23T12:00:00+01:00')).live.length,42);
 assert.equal(eligibleEditorialLinks(next,new Date('2026-11-22T12:00:00+01:00')).live.length,41);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-12-02T12:00:00+01:00')).live.length,0);
});

test('user report is not proof: only evidence-confirmed blacklist entries block the targeted game',()=>{
 const now=new Date('2026-11-21T12:00:00+01:00');
 const safe=structuredClone(data);
 safe.blacklist=[{id:'bergzeit-la-sportiva-2026',verified:false,reason:'user reported'}];
 assert.equal(eligibleEditorialLinks(safe,now).live.length,42);
 safe.blacklist[0].verified=true;
 assert.equal(eligibleEditorialLinks(safe,now).live.length,41);
 assert.ok(!eligibleEditorialLinks(safe,now).live.some(g=>g.id==='bergzeit-la-sportiva-2026'));
 assert.equal(data.review_candidates.length,5);
});

test('social and messenger draws carry distinct disclosure metadata and still expire',()=>{
 const social=data.active.filter(g=>['instagram','social','whatsapp_email','instagram_tiktok'].includes(g.participation_type));
 assert.equal(social.length,9);
 for(const item of social){
  assert.ok(['instagram','social','whatsapp_email','instagram_tiktok'].includes(item.participation_type));
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
 assert.equal(ordered.length,42);
 const endTimes=ordered.map(g=>Date.parse(g.ends_at));
 assert.deepEqual(endTimes,[...endTimes].sort((a,b)=>a-b));
 assert.equal(ordered[0].id,'partner-wera-social-2026'); // 24 Nov
 assert.equal(ordered[1].id,'bayern-digitalradio-2026'); // tie on 25 Nov, title A-Z
 assert.equal(ordered[2].id,'cloetta-candyking-instagram-2026');
 assert.equal(ordered[3].id,'gesundde-register-win-2026'); // 25 Nov
 assert.equal(ordered[4].id,'kanzi-power-search-2026'); // 28 Nov
 assert.equal(ordered[5].id,'stilbruch-registration-2026'); // 29 Nov
 assert.equal(ordered[6].id,'smyths-wishlist-2026'); // 29 Nov
 assert.equal(ordered[7].id,'falken-bulls-bikes-2026'); // 30 Nov 18:00
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

test('new November account actions disclose mandatory steps, consent and real deadline',()=>{
 const app=data.active.find(g=>g.id==='gesundde-register-win-2026');
 const list=data.active.find(g=>g.id==='smyths-wishlist-2026');
 assert.equal(app.participation_type,'app_account');
 assert.equal(list.participation_type,'account');
 assert.match(app.marketing_requirements,/freiwillig/);
 assert.match(list.required_data,/EXAKTEM Titel/);
 assert.equal(app.ends_at,'2026-11-26T00:00:00+01:00');
 assert.equal(list.ends_at,'2026-11-30T00:00:00+01:00');
 assert.match(app.note,/nicht durchgeführt/);
 assert.match(list.note,/nicht ausgeführt/);
});

test('AIDA and DB official forms and conditions supply distinct, time-bound entries',()=>{
 const aida=data.active.find(x=>x.id==='aida-november-cruise-2026');
 const db=data.active.find(x=>x.id==='db-bibi-tina-musical-2026');
 assert.ok(aida&&db);
 assert.equal(aida.ends_at,'2026-12-01T00:00:00+01:00');
 assert.equal(db.ends_at,'2026-12-04T00:00:00+01:00');
 assert.equal(aida.participation_type,'web_form');
 assert.equal(db.participation_type,'web_form');
 assert.match(aida.marketing_requirements,/Newsletter-Einwilligung.*separat/);
 assert.match(db.note,/nicht genannt/);
 assert.match(db.note,/NICHT nachgewiesen/);
 assert.match(db.marketing_requirements,/kein/i);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00')).live.filter(x=>[aida.id,db.id].includes(x.id)).length,2);
});

test('official AVerMedia and wed2b actions retain exact timezone and honest verification notes',()=>{
 const a=data.active.find(g=>g.id==='avermedia-elena-console-2026');
 const w=data.active.find(g=>g.id==='wed2b-black-friday-dress-2026');
 assert.ok(a&&w);
 assert.equal(a.ends_at,'2026-12-03T17:00:00+01:00');
 assert.equal(w.ends_at,'2026-12-01T01:00:00+01:00');
 assert.match(a.deadline_label,/16:59 Uhr/);
 assert.match(w.deadline_label,/00:59 Uhr/);
 assert.equal(a.participation_type,'external_form');
 assert.equal(w.participation_type,'instagram');
 assert.match(a.note,/nicht unabhängig sichtbar/);
 assert.match(w.note,/nicht unabhängig geöffnet/);
 assert.ok(eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00')).live.some(g=>g.id===a.id));
});

test('three new December entries disclose mandatory participation and precise/unknown end time',()=>{
 const k=data.active.find(g=>g.id==='kreiller-advent-instagram-2026');
 const e=data.active.find(g=>g.id==='evh-halplus-christmas-lights-2026');
 const t=data.active.find(g=>g.id==='radio-brocken-familienquiz-2026');
 assert.ok(k&&e&&t);
 assert.equal(k.ends_at,'2026-12-15T14:00:00+01:00');
 assert.match(k.deadline_label,/13:59 Uhr/);
 assert.equal(k.participation_type,'instagram');
 assert.match(k.marketing_requirements,/freiwillig/i);
 assert.equal(e.ends_at,'2026-12-15T00:00:00+01:00');
 assert.match(e.marketing_requirements,/unbeschränkte Bildnutzungsrechte/);
 assert.match(e.required_data,/Kindes/);
 assert.equal(t.ends_at,'2026-12-15T18:00:00+01:00');
 assert.match(t.marketing_requirements,/aufgezeichnete/);
 assert.match(t.note,/drei Fragen in 30 Sekunden/);
 const ranked=eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00')).live;
 const times=ranked.map(g=>Date.parse(g.ends_at));
 assert.deepEqual(times,[...times].sort((a,b)=>a-b));
});

test('five late-2026 source entries have explicit privacy disclosures and eligibility limits',()=>{
 const ids=['pilot-frixion-monthly-2026','world-of-dice-winterscene-2026','steinbach-simple-spa-2026','edeka-kuhlmann-ps5-reel-2026','kanzi-power-search-2026'];
 const entries=ids.map(id=>data.active.find(g=>g.id===id));
 assert.ok(entries.every(Boolean));
 for(const g of entries){
  assert.ok(g.marketing_requirements.length>40);
  assert.ok(g.required_data.length>50);
  assert.ok(g.note.length>90);
  assert.equal(new URL(g.terms_url).protocol,'https:');
  assert.equal(new URL(g.privacy_url).protocol,'https:');
 }
 assert.match(entries[0].marketing_requirements,/Newsletter.*separat/);
 assert.equal(entries[0].ends_at,'2027-01-01T00:00:00+01:00');
 assert.match(entries[1].note,/keine tägliche Türchen|Keine tägliche Türchen/i);
 assert.equal(entries[1].ends_at,'2027-01-01T00:00:00+01:00');
 assert.equal(entries[2].ends_at,'2026-12-04T12:00:00+01:00');
 assert.match(entries[2].required_data,/weitere Person markieren/);
 assert.match(entries[3].marketing_requirements,/KEIN Versand/);
 assert.equal(entries[3].ends_at,'2026-12-16T00:00:00+01:00');
 assert.match(entries[4].note,/Quellenabweichung/);
 assert.equal(entries[4].ends_at,'2026-11-29T00:00:00+01:00');
 const pre=eligibleEditorialLinks(data,new Date('2026-11-28T23:59:59+01:00')).live;
 assert.ok(pre.some(g=>g.id==='kanzi-power-search-2026'));
 const post=eligibleEditorialLinks(data,new Date('2026-11-29T00:00:00+01:00')).live;
 assert.ok(!post.some(g=>g.id==='kanzi-power-search-2026'));
});

test('longer-running 2027 prize draws disclose app/payment, user account and privacy prerequisites',()=>{
 const balloon=data.active.find(g=>g.id==='suelzle-wimmelbild-ballonfahrt-2027');
 const raclette=data.active.find(g=>g.id==='savencia-le-rustique-raclette-2027');
 const mvg=data.active.find(g=>g.id==='meine-mvg-deutschlandticket-2027');
 assert.ok(balloon&&raclette&&mvg);
 assert.equal(balloon.ends_at,'2027-02-01T00:00:00+01:00');
 assert.equal(raclette.ends_at,'2027-01-04T00:00:00+01:00');
 assert.equal(mvg.ends_at,'2027-04-01T00:00:00+02:00');
 assert.equal(balloon.participation_type,'external_form');
 assert.equal(raclette.participation_type,'account');
 assert.equal(mvg.participation_type,'app_account');
 assert.match(balloon.marketing_requirements,/Fotoveröffentlichung/);
 assert.match(raclette.marketing_requirements,/freiwillig/);
 assert.match(mvg.marketing_requirements,/VERPFLICHTEND/);
 assert.match(mvg.marketing_requirements,/kostenpflichtiges/);
 assert.match(mvg.note,/LETZTE/);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-21T18:00:00+01:00')).live.filter(g=>[balloon.id,raclette.id,mvg.id].includes(g.id)).length,3);
 const stale=structuredClone(data);
 for(const item of stale.active){item.reviewed_on='2026-11-21'}
 assert.equal(eligibleEditorialLinks(stale,new Date('2026-11-30T12:00:00+01:00')).live.length,0,'no invented recheck may bypass freshness window');
});

test('KRONE FISCH and Robby Bubble original-form draws last until January 2027 with explicit privacy requirements',()=>{
 const fish=data.active.find(x=>x.id==='krone-fisch-hurtigruten-2027');
 const family=data.active.find(x=>x.id==='robby-bubble-spiel-dich-schlau-2027');
 assert.ok(fish&&family);
 assert.equal(fish.ends_at,'2027-02-01T00:00:00+01:00');
 assert.equal(family.ends_at,'2027-02-01T00:00:00+01:00');
 assert.equal(fish.participation_type,'web_form');
 assert.equal(family.participation_type,'web_form');
 assert.match(fish.marketing_requirements,/freiwillig/);
 assert.match(fish.note,/Anreise nach Hamburg/);
 assert.match(family.required_data,/Geburtsdatum des Kindes/);
 assert.match(family.deadline_label,/Uhrzeit nicht angegeben/);
 assert.match(family.marketing_requirements,/keine Weitergabe/);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00')).live.filter(x=>[fish.id,family.id].includes(x.id)).length,2);
});

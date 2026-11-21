import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const report=JSON.parse(read('../catalog/source-audit-2026-11-21.json'));
test('reviewed primary-source candidates remain unapproved and mail-free',()=>{
 assert.equal(report.entries.length,2);
 for(const entry of report.entries){
  assert.equal(entry.approval,'pending');
  assert.equal(entry.form_checked,false);
  assert.equal(entry.reminders_enabled,false);
  assert.ok(entry.source_url.startsWith('https://'));
  assert.ok(entry.still_unverified.length>0);
 }
});
test('PILOT newsletter-only date excluded, seven no-newsletter days retained',()=>{
 const pilot=report.entries.find(x=>x.candidate_id==='pilot-2026');
 assert.deepEqual(pilot.eligible_non_newsletter_dates,[1,3,5,9,16,19,24]);
 assert.deepEqual(pilot.excluded_dates,[22]);
});
test('public explanation is visibly research-only and not indexed pending legal approval',()=>{
 const html=read('../public/quellenpruefung.html');
 const index=read('../public/index.html');
 assert.match(html,/noch nicht zur Teilnahme freigegeben/);
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/Ausgeschlossen: 22. Dezember/);
 assert.match(index,/quellenpruefung.html/);
});

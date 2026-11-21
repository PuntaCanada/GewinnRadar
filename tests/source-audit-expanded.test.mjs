import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const audit=JSON.parse(read('../catalog/source-audit-2026-11-21.json'));
test('six 2026 original-source audits never silently approve contests or reminders',()=>{
 assert.equal(audit.entries.length,6);
 assert.equal(new Set(audit.entries.map(e=>e.candidate_id)).size,6);
 for(const entry of audit.entries){
  assert.ok(['pending','blocked_pending_correction'].includes(entry.approval));
  assert.equal(entry.form_checked,false);
  assert.equal(entry.reminders_enabled,false);
  assert.ok(entry.source_url.startsWith('https://'));
  assert.ok(entry.still_unverified.length>0);
 }
});
test('non-raffle, newsletter-only and special expiration exceptions remain explicit',()=>{
 const get=id=>audit.entries.find(e=>e.candidate_id===id);
 assert.deepEqual(get('pilot-2026').excluded_dates,[22]);
 assert.deepEqual(get('stadtgaertner-2026').excluded_non_raffle_dates,[8]);
 assert.equal(get('stadtgaertner-2026').year_conflict_detected,true);
 assert.equal(get('stadtgaertner-2026').approval,'blocked_pending_correction');
 assert.match(get('yellowchair-2026').event_dates,/2026-12-27/);
 assert.match(get('agravis-2026').event_dates,/23:59/);
});
test('research-only disclosure is public but still noindex pending legal signoff',()=>{
 const html=read('../public/quellenpruefung.html');
 assert.match(html,/noindex,nofollow/);
 for(const name of ['Stadtgärtner','Yellowchair','infra Fürth','AGRAVIS'])assert.ok(html.includes(name));
 assert.match(html,/noch nicht zur Teilnahme freigegeben/);
});

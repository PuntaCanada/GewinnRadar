import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('production probe remains credential-free, strictly GET and never changes publication state',()=>{
 const source=readFileSync(new URL('../scripts/production-readonly-probe.mjs',import.meta.url),'utf8');
 assert.match(source,/https:\/\/gewinnradar\.pages\.dev/);
 assert.match(source,/\['\/api\/catalog-status','\/api\/games'\]/);
 assert.match(source,/method:'GET'/);
 assert.match(source,/redirect:'manual'/);
 assert.match(source,/dns_unresolved/);
 assert.match(source,/network_error/);
 assert.match(source,/unexpected_json_shape/);
 assert.match(source,/matching_counts/);
 assert.doesNotMatch(source,/authorization|\bcookie\b|method:'POST'|method:'PUT'|method:'DELETE'|cloudflare\.com\/client\/v4/i);
});
test('real researched FALKEN original displays 18:00 cut-off but legal modal remains unverified',()=>{
 const entries=JSON.parse(readFileSync(new URL('../catalog/research-2026.json',import.meta.url),'utf8')).entries;
 const x=entries.find(e=>e.id==='falken-bulls-bikes-2026');
 assert.equal(x.state,'candidate');
 assert.equal(x.human_approved,false);
 assert.match(x.required_data,/Fahrradtypen/);
 assert.match(x.review_note,/18:00 Uhr/);
 assert.match(x.review_note,/30\.11\.2026/);
 assert.match(x.review_note,/Direktabruf nicht auswertbar/);
 assert.match(x.review_note,/nicht vollständig verifiziert/);
 const records=JSON.parse(readFileSync(new URL('../catalog/evidence-history-2026.json',import.meta.url),'utf8')).records;
 const latest=records.filter(r=>r.candidate_id===x.id).at(-1);
 assert.equal(latest.form_checked,false);
 assert.equal(latest.newsletter_checked,false);
 assert.equal(latest.trust_status,'source_only');
});

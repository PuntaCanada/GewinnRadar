import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleEditorialLinks,editorialDeadline} from '../public/editorial-links.js';
const data=JSON.parse(readFileSync(new URL('../public/editorial-links-2026.json',import.meta.url),'utf8'));
test('public source links are genuine separately reviewed entries, no D1 approval',()=>{
 assert.equal(data.schema_version,1);
 assert.equal(data.active.length,4);
 assert.equal(data.preview.length,3);
 assert.equal(new Set([...data.active,...data.preview].map(x=>x.id)).size,7);
 for(const e of [...data.active,...data.preview]){
  for(const k of ['url','terms_url'])assert.equal(new URL(e[k]).protocol,'https:');
 }
 assert.equal(data.active[0].privacy_url,'https://www.bayerndigitalradio.de/datenschutz/');
});
test('live link expires automatically and previews never become clickable participation cards',()=>{
 const before=eligibleEditorialLinks(data,new Date('2026-11-21T12:00:00+01:00'));
 assert.equal(before.live.length,4);
 assert.equal(before.future.length,3);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-11-26T00:00:00+01:00')).live.length,3)
 assert.equal(eligibleEditorialLinks(data,new Date('2027-01-01T00:00:00+01:00')).live.length,0);
 assert.equal(eligibleEditorialLinks(data,new Date('2027-01-01T00:00:00+01:00')).future.length,0);
});
test('unverified or malformed source entries cannot appear as active',()=>{
 const mutated=structuredClone(data);
 mutated.active[0].privacy_url='http://not-secure.invalid';
 assert.equal(eligibleEditorialLinks(mutated,new Date('2026-11-21T12:00:00+01:00')).live.length,3);
 mutated.active[0].privacy_url=data.active[0].privacy_url;
 mutated.active[0].reviewed_on='unknown';
 assert.equal(eligibleEditorialLinks(mutated,new Date('2026-11-21T12:00:00+01:00')).live.length,3);
});

test('deadline shows the last eligible date, not exclusive expiry or review date',()=>{
 assert.match(editorialDeadline('2026-11-26T00:00:00+01:00'),/25\.11\.2026.*23:59/);
 assert.match(editorialDeadline('2027-01-01T00:00:00+01:00'),/31\.12\.2026.*23:59/);
 assert.equal(editorialDeadline('invalid'),null);
});
test('a future daily research review is allowed, but stale or future-dated evidence is rejected',()=>{
 const next=structuredClone(data);next.active[0].reviewed_on='2026-11-23';
 assert.equal(eligibleEditorialLinks(next,new Date('2026-11-23T12:00:00+01:00')).live.length,4);
 assert.equal(eligibleEditorialLinks(next,new Date('2026-11-22T12:00:00+01:00')).live.length,3);
 assert.equal(eligibleEditorialLinks(data,new Date('2026-12-02T12:00:00+01:00')).live.length,0);
});

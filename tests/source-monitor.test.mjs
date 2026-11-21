import test from 'node:test';import assert from 'node:assert/strict';
import {classify,eligibleProbe,probe} from '../scripts/source-monitor.mjs';
test('monitor only checks exactly allowlisted genuine HTTPS hosts',()=>{
 assert.equal(eligibleProbe('https://www.agravis.de/de/unternehmen/ueber-uns/adventskalender'),true);
 for(const u of ['http://www.agravis.de/','https://evil-agravis.de/','https://www.agravis.de.evil.org/','https://127.0.0.1/','https://[::1]/']) assert.equal(eligibleProbe(u),false);
});
test('bot blocks and redirects are NOT recorded as expired or scam',()=>{
 assert.equal(classify(200),'reachable');
 assert.equal(classify(302),'redirect-review');
 assert.equal(classify(403),'blocked-or-rate-limited');
 assert.equal(classify(429),'blocked-or-rate-limited');
 assert.equal(classify(404),'missing-review');
 assert.equal(classify(0,true),'inconclusive');
});
test('monitor is non-mutating and never automatically follows redirect',async()=>{
 let called=false;
 const result=await probe('https://www.agravis.de/',async(url,options)=>{
  called=true;assert.equal(options.method,'HEAD');assert.equal(options.redirect,'manual');
  return {status:302,body:null};
 });
 assert.equal(called,true);assert.deepEqual(result,{status:'redirect-review',http_status:302});
 const skipped=await probe('https://evil.example.org',()=>{throw Error('must not run')});
 assert.equal(skipped.status,'skipped-unapproved-host');
});

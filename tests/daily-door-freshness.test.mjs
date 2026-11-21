import test from 'node:test';
import assert from 'node:assert/strict';
import {berlinDayStart,formReviewWindow,verifiedConditions} from '../functions/_lib/publication-gate.js';
test('Berlin winter door cutoff uses 23:00 UTC the previous day',()=>{
 assert.equal(berlinDayStart(new Date('2026-12-02T01:00:00Z')),'2026-12-01T23:00:00.000Z');
});
test('Berlin summer and DST transition days use the correct local midnight',()=>{
 assert.equal(berlinDayStart(new Date('2026-07-01T12:00:00Z')),'2026-06-30T22:00:00.000Z');
 assert.equal(berlinDayStart(new Date('2026-03-29T12:00:00Z')),'2026-03-28T23:00:00.000Z');
 assert.equal(berlinDayStart(new Date('2026-10-25T12:00:00Z')),'2026-10-24T22:00:00.000Z');
});
test('Publication gate only applies the daily requirement to daily contests',()=>{
 const window=formReviewWindow(new Date('2026-12-02T01:00:00Z'));
 assert.equal(window.length,3);
 assert.equal(window[2],'2026-12-01T23:00:00.000Z');
 assert.match(verifiedConditions,/g\.daily=0 OR fv\.checked_at>=\?/);
});

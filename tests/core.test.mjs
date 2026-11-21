import test from 'node:test';import assert from 'node:assert/strict';
import {dayKey,validHttps,escapeText} from '../functions/_lib/core.js';
import {berlin,berlinHour,validUrl} from '../worker/index.js';
test('https URLs only',()=>{assert.equal(validHttps('https://www.br.de/'),true);assert.equal(validHttps('javascript:alert(1)'),false);assert.equal(validHttps('http://example.com'),false);assert.equal(validUrl('https://www.br.de/'),true)});
test('Berlin calendar rollover from UTC',()=>{assert.equal(dayKey(new Date('2026-12-01T00:10:00Z')),'2026-12-01');assert.equal(berlin(new Date('2026-12-01T00:10:00Z')),'2026-12-01')});
test('Cron checks winter/summer 08 local',()=>{assert.equal(berlinHour(new Date('2026-12-01T07:00:00Z')),8);assert.equal(berlinHour(new Date('2027-06-01T06:00:00Z')),8);assert.equal(berlinHour(new Date('2026-12-01T06:00:00Z')),7)});
test('header safety',()=>{assert.equal(escapeText('a\nb'),'a b')});
test('deny private, encoded and unsafe contest links',()=>{
  for(const url of ['https://127.0.0.1/','https://192.168.1.2','https://[::1]/','https://localhost.local/','https://app.internal/','https://example.com@192.168.1.3/','http://www.br.de','https://www.br.de:8443/','https://2130706433/','https://0x7f000001/','https://example.com\\@localhost/']) {
    assert.equal(validHttps(url),false,'should reject '+url);
    assert.equal(validUrl(url),false,'worker should reject '+url);
  }
  assert.equal(validHttps('https://www.br.de/'),true);
  assert.equal(validHttps('https://xn--bcher-kva.de/'),true);
});

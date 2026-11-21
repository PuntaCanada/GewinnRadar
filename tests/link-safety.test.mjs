import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTarget,checkGames} from '../worker/index.js';
import {publicContestUrl} from '../functions/_lib/urls.js';

const host='https://www.br.de/gewinnspiel';
test('link probes are disabled by default',()=>{
 assert.equal(checkTarget(host,{}),false);
 assert.equal(checkTarget(host,{LINK_CHECK_ENABLED:'false',LINK_CHECK_ALLOWED_HOSTS:'www.br.de'}),false);
 assert.equal(checkTarget(host,{LINK_CHECK_ENABLED:'true'}),false);
});
test('only exact independently approved public HTTPS host accepted',()=>{
 const env={LINK_CHECK_ENABLED:'true',LINK_CHECK_ALLOWED_HOSTS:'www.br.de, www.zdf.de'};
 assert.equal(checkTarget(host,env),true);
 assert.equal(checkTarget('https://www.zdf.de/a',env),true);
 for(const url of [
  'https://evil-www.br.de/a','https://www.br.de.evil.com/a',
  'http://www.br.de/a','https://www.br.de@127.0.0.1/a',
  'https://127.0.0.1/a','https://[::1]/a','https://www.br.de:444/a',
  'https://localhost/a','https://www.br.de%5c@localhost/a'
 ])assert.equal(checkTarget(url,env),false,'invalid '+url);
 assert.equal(publicContestUrl('https://www.br.de/a'),true);
});
test('disabled checker performs no external network requests',async()=>{
 let calls=0;
 const old=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;throw Error('unexpected fetch')};
 try {
  let updates=0;
  const env={LINK_CHECK_ENABLED:'false',DB:{prepare(sql){updates++;return {bind(){return {run:async()=>({meta:{changes:0}})}}}}}};
  const result=await checkGames(env);
  assert.deepEqual(result,{skipped:'disabled'});
  assert.equal(calls,0);
  assert.equal(updates,1,'Only expiry maintenance is allowed');
 }finally{globalThis.fetch=old}
});

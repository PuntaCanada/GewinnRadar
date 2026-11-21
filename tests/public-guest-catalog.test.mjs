import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet} from '../functions/api/games.js';

test('anonymous guests see only reviewed, active, verified public contests; no private joins', async () => {
 let query='', params=[];
 const DB={prepare(sql){query=sql;return {bind(...values){params=values;return {async all(){return {results:[{id:'approved',title:'Geprüft',url:'https://example.org'}]}}}}}}};
 const request=new Request('https://gewinnradar.pages.dev/api/games');
 const response=await onRequestGet({request,env:{DB}});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.games[0].id,'approved');
 assert.equal(body.games[0].favorite,undefined);
 assert.equal(body.games[0].completed,undefined);
 assert.match(query,/human_verified=1/);
 assert.match(query,/g.status='verified'/);
 assert.match(query,/g.link_state='ok'/);
 assert.match(query,/g.verified_at IS NOT NULL/);
 assert.doesNotMatch(query,/favorites|participations|users|sessions/i);
 assert.equal(params.length,5);
 assert.match(query,/form_verifications/);
 assert.match(query,/e.privacy_checked=1/);
 assert.match(query,/fv.no_marketing_required=1/);
 assert.match(query,/fv.checked_at>=\\?/);
 assert.match(query,/g.daily=0 OR fv.checked_at>=/);
});
test('homepage exposes catalogue without login while preserving account-only controls',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(html,/<section id="dashboard">/);
 assert.match(html,/Freiwilliges Konto/);
 assert.match(html,/personalOnly hidden/);
 assert.match(js,/if\(user\)\{const doneLabel/);
 assert.match(js,/if\(!user\)refresh\(\)/);
});
test('all private writes and administrator routes still require authentication',()=>{
 for(const file of ['../functions/api/progress.js','../functions/api/settings.js','../functions/api/admin/contests.js']){
  const code=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(code,/viewer\(ctx\)/);
 }
});

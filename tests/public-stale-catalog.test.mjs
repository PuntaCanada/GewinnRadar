import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('public guest catalogue fails closed and discards stale approved entries',()=>{
 assert.match(script,/games=\[\];lastLoadedAt=0;lastLoadedDay='';render\(\)/);
 assert.match(script,/Aktuelle Gewinnspiele konnten nicht geprüft werden/);
 assert.match(script,/if\(!Array\.isArray\(r\.games\)\)/);
});
test('returning visitor checks Berlin daily boundary, without background polling or mail',()=>{
 assert.match(script,/Europe\/Berlin/);
 assert.match(script,/visibilitychange',refreshOnResume/);
 assert.match(script,/focus',refreshOnResume/);
 assert.match(script,/berlinDay\(\)!==lastLoadedDay/);
 assert.doesNotMatch(script,/setInterval|sendBrevo|BREVO_API_KEY/);
});

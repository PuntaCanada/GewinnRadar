import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('daily calendars disclose overall calendar end vs possibly earlier door deadline',()=>{
 assert.match(ui,/Kalender-Ende:/);
 assert.match(ui,/Die Frist für das heutige Türchen kann früher liegen/);
 assert.match(ui,/heutige Teilnahmeberechtigung/);
 assert.match(ui,/Tagesaktion – heutiges Türchen prüfen/);
});
test('single contests still show their own close time, with no fabricated daily deadline',()=>{
 assert.match(ui,/Teilnahmeschluss:/);
 assert.doesNotMatch(ui,/g\.daily\?[^\n]*23:59/);
});

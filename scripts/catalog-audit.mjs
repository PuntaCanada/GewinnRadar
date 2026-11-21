import {readFileSync} from 'node:fs';
import {auditResearch,eligibleToday} from '../functions/_lib/catalog.js';
const json=JSON.parse(readFileSync(new URL('../catalog/research-2026.json',import.meta.url),'utf8'));
const result=auditResearch(json.entries);
if(!result.ok){console.error(result);process.exitCode=1}
else{
 console.log('2026 research candidate audit:',JSON.stringify(result));
 console.log('Playable candidates on 2026-12-01:',json.entries.filter(e=>eligibleToday(e,'2026-12-01')).length);
 console.log('Approved/live entries automatically imported: 0');
}

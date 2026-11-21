import {readFileSync} from 'node:fs';
const entries=JSON.parse(readFileSync(new URL('../catalog/research-2026.json',import.meta.url),'utf8')).entries;
const history=JSON.parse(readFileSync(new URL('../catalog/evidence-history-2026.json',import.meta.url),'utf8'));
const ids=new Set(entries.map(e=>e.id));
const counts=new Map();const errors=[];
for(const e of history.records){
 if(!ids.has(e.candidate_id))errors.push('Orphan evidence '+e.candidate_id);
 counts.set(e.candidate_id,(counts.get(e.candidate_id)||0)+1);
 if(e.observed_on!=='2026-11-21')errors.push('Date unsupported '+e.candidate_id);
 if(e.form_checked!==false||e.newsletter_checked!==false||e.germany_eligible_checked!==false)errors.push('Unverified form marked checked '+e.candidate_id);
 if(!['original_2026_page_seen','prior_catalog_unreverified'].includes(e.evidence_kind))errors.push('Evidence classification not supported');
}
for(const id of ids)if(!counts.has(id))errors.push('Missing evidence '+id);
if(errors.length){console.error(errors);process.exit(1)}
console.log('Source evidence history coverage:',ids.size,'candidates; finalized approval:',0,'forms verified:',0);

import {readFileSync} from 'node:fs';
const read=path=>JSON.parse(readFileSync(new URL('../catalog/'+path,import.meta.url),'utf8'));
const research=read('research-2026.json'),review=read('editorial-review-2026.json'),schedule=read('reminder-rules-2026.json');
const errors=[],seen=new Set();
for(const r of review.entries){
 if(seen.has(r.id))errors.push('Duplicate review '+r.id);
 seen.add(r.id);
 const x=research.entries.find(e=>e.id===r.id);
 if(!x)errors.push('Orphan review '+r.id);
 if(x?.state==='excluded'&&r.review_state!=='excluded')errors.push('Excluded item not flagged '+r.id);
 if(r.live_form_verified!==false||r.reminder_approved!==false)errors.push('Unproven form/reminder approval '+r.id);
}
for(const r of research.entries)if(!seen.has(r.id))errors.push('Unreviewed '+r.id);
for(const r of schedule.entries){
 if(!seen.has(r.id))errors.push('Unknown reminder schedule '+r.id);
 if(r.reminders_allowed!==false)errors.push('Unapproved reminder '+r.id);
 if(r.conflict&&r.rule!==null)errors.push('Conflicting schedule must have no times '+r.id);
}
if(errors.length){console.error(errors);process.exit(1)}
console.log(JSON.stringify({research:research.entries.length,pending:research.entries.filter(x=>x.state==='candidate').length,excluded:research.entries.filter(x=>x.state==='excluded').length,verified_live_forms:0,enabled_reminders:0,review_coverage:seen.size,explicit_schedule_rules:schedule.entries.length}));

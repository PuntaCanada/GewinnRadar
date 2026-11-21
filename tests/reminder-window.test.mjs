import test from 'node:test';import assert from 'node:assert/strict';
import {berlinToUTC,dayWindows,dueReminders,validateUserReminderWindow} from '../functions/_lib/reminder-window.js';
import {readFileSync} from 'node:fs';
const schedule=JSON.parse(readFileSync(new URL('../catalog/reminder-rules-2026.json',import.meta.url),'utf8')).entries;
const get=id=>schedule.find(x=>x.id===id);
test('real December CET and DST switch are converted without guessing',()=>{
 assert.equal(berlinToUTC('2026-12-01','08:00'),'2026-12-01T07:00:00.000Z');
 assert.equal(berlinToUTC('2026-07-01','08:00'),'2026-07-01T06:00:00.000Z');
 assert.equal(berlinToUTC('2026-03-29','02:30'),null,'DST skip');
 assert.equal(berlinToUTC('2026-10-25','02:30'),null,'DST double time');
});
test('all research schedules must be explicitly approved before any reminder',()=>{
 for(const item of schedule)assert.deepEqual(dayWindows(item,'2026-12-01'),[]);
});
test('PILOT only seven newsletter-free days; newsletter day excluded',()=>{
 const p={...get('pilot-2026'),reminders_allowed:true};
 assert.equal(dayWindows(p,'2026-12-01').length,1);
 assert.equal(dayWindows(p,'2026-12-22').length,0);
 assert.equal(dayWindows(p,'2026-12-24').length,1);
 assert.equal(dueReminders(p,new Date('2026-12-01T07:30:00Z')).length,1);
 assert.equal(dueReminders(p,new Date('2026-12-01T08:30:00Z')).length,0,'Only configured 08 local hour');
 assert.equal(dueReminders(p,new Date('2026-12-01T23:30:00Z')).length,0,'Closed door cannot be sent after midnight');
});
test('ALDI app-only days and contradictions must never make morning mail',()=>{
 const a={...get('aldi-nord-2026'),reminders_allowed:true};
 assert.equal(dayWindows(a,'2026-12-05').length,1);
 for(const day of [6,13,20])assert.equal(dayWindows(a,'2026-12-'+String(day).padStart(2,'0')).length,0);
 const u={...get('urlaubsguru-2026'),reminders_allowed:true};
 assert.equal(dayWindows(u,'2026-12-01').length,0);
});
test('deadline boundaries and malformed data fail closed',()=>{
 const pilot={...get('pilot-2026'),reminders_allowed:true},w=dayWindows(pilot,'2026-12-01')[0];
 assert.equal(validateUserReminderWindow(w,new Date(w.start)),true);
 assert.equal(validateUserReminderWindow(w,new Date(w.end)),false);
 assert.equal(validateUserReminderWindow({start:'garbage',end:'2026-12-01T10:00:00Z'}),false);
});

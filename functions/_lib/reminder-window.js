// A conservative, testable local-time planner. This module never sends mail.
// Clock ambiguity, missing conditions, 2025 leftovers and uncertain cutoffs fail closed.
const validTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
function berlinParts(date){
 const fields=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const o=Object.fromEntries(fields.filter(f=>f.type!=='literal').map(f=>[f.type,f.value]));
 return {day:o.year+'-'+o.month+'-'+o.day,minute:Number(o.hour)*60+Number(o.minute)};
}
export function berlinToUTC(day,time) {
 if(typeof day!=='string'||!/^\d{4}-\d\d-\d\d$/.test(day)||!validTime(time))return null;
 const nominal=Date.parse(day+'T'+time+':00Z');if(!Number.isFinite(nominal))return null;
 const actual=[];
 // DST can make a local time non-existent or ambiguous: reject rather than guess.
 for(let delta=-180;delta<=180;delta+=30) {
  const stamp=new Date(nominal+delta*60000);
  const parts=berlinParts(stamp);
  if(parts.day===day && parts.minute===Number(time.slice(0,2))*60+Number(time.slice(3)))actual.push(stamp.toISOString());
 }
 return actual.length===1?actual[0]:null;
}
function plusDays(day,offset){
 const t=Date.parse(day+'T12:00:00Z');if(!Number.isFinite(t))return null;
 return new Date(t+offset*86400000).toISOString().slice(0,10);
}
export function dayWindows(item,day) {
 if(item?.year!==2026||item.status!=='conditions_checked'||item.conflict===true||item.reminders_allowed!==true)return [];
 if(!/^\d{4}-\d\d-\d\d$/.test(day)||day<'2026-12-01'||day>'2026-12-31')return [];
 const rule=item.rule;
 if(!rule||!validTime(rule.open)||!validTime(rule.close))return [];
 if(rule.days!==undefined && (!Array.isArray(rule.days)||!rule.days.includes(Number(day.slice(-2)))))return [];
 if(Array.isArray(rule.skip_days)&&rule.skip_days.includes(Number(day.slice(-2))))return [];
 const closeDay=plusDays(day,Number(rule.close_day_offset||0));
 const start=berlinToUTC(day,rule.open),end=closeDay?berlinToUTC(closeDay,rule.close):null;
 if(!start||!end||Date.parse(end)<=Date.parse(start))return [];
 return [{id:item.id,day,start,end}];
}
export function dueReminders(item,at=new Date(),preferredHour=8){
 if(!Number.isFinite(at.getTime())||!Number.isInteger(preferredHour)||preferredHour<0||preferredHour>23)return [];
 const local=berlinParts(at);
 if(Math.floor(local.minute/60)!==preferredHour)return [];
 const date=local.day;
 return [date,plusDays(date,-1)].flatMap(day=>dayWindows(item,day)).filter(w=>Date.parse(w.start)<=at.getTime()&&at.getTime()<Date.parse(w.end));
}
export function validateUserReminderWindow(win,now=new Date()){
 if(!win||!Number.isFinite(Date.parse(win.start))||!Number.isFinite(Date.parse(win.end))||Date.parse(win.start)>=Date.parse(win.end))return false;
 return now.getTime()>=Date.parse(win.start)&&now.getTime()<Date.parse(win.end);
}

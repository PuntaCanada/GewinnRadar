// Advent 2026 is separate from regular prize draws and from D1.
// Checkmarks are browser-local and isolated by calendar ID AND Berlin date.
const DAY_PREFIX='gewinnradar:advent:completed:v1:';
const fallback=new Set();
const safeId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{2,99}$/.test(id);
export const berlinDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const validDay=day=>typeof day==='string'&&/^2026-12-(0[1-9]|1[0-9]|2[0-4])$/.test(day);
const key=(id,day)=>safeId(id)&&validDay(day)?DAY_PREFIX+id+':'+day:null;
export function readDayDone(storage,id,day){
 const k=key(id,day);if(!k)return false;
 try{return storage.getItem(k)==='1'}catch{return fallback.has(k)}
}
export function writeDayDone(storage,id,day,done){
 const k=key(id,day);if(!k)return false;
 try{if(done)storage.setItem(k,'1');else storage.removeItem(k);if(done)fallback.add(k);else fallback.delete(k);return true}
 catch{if(done)fallback.add(k);else fallback.delete(k);return false}
}
function berlinDateTime(day,time){
 // All Advent events are in CET in December; explicit offsets avoid browser-local clock shifts.
 return new Date(day+'T'+time+':00+01:00').getTime();
}
export function dailyState(game,now=new Date()){
 const day=berlinDay(now);
 if(!validDay(day)||game.starts_on>day||game.ends_on<day)return 'outside';
 const d=game.daily_deadline||{};
 if(d.type==='same_day'&&d.time&& /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(d.time)){
  if(now.getTime()>berlinDateTime(day,d.time))return 'deadline-passed';
 }
 return 'today';
}
export function todayAdventCalendars(data,now=new Date()){
 if(!data||data.schema_version!==1||!Array.isArray(data.confirmed))throw Error('Adventliste ungültig');
 const day=berlinDay(now);
 return data.confirmed.filter(g=>safeId(g.id)&&g.source_audit?.status==='confirmed'&&g.starts_on<=day&&g.ends_on>=day&&
  [g.url,g.terms_url].every(u=>{try{return new URL(u).protocol==='https:'}catch{return false}}))
  .map(g=>({...g,today_state:dailyState(g,now)}));
}
const byId=id=>document.getElementById(id);
function storage(){
 try{return window.localStorage}catch{return {getItem(){throw Error('disabled')},setItem(){throw Error('disabled')},removeItem(){throw Error('disabled')}}}
}
const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!=null)x.textContent=value;if(cls)x.className=cls;return x};
function link(text,url){const a=el('a',text,'btn');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a}
let cache=null;
function paint(now=new Date()){
 const root=byId('adventToday'),status=byId('adventTodayStatus'),count=byId('adventTodayCount'),candidate=byId('adventCandidates');
 if(!root||!status||!count||!cache)return;
 const day=berlinDay(now),active=todayAdventCalendars(cache,now),isDec=validDay(day),onlyOpen=byId('adventOnlyOpen')?.checked;
 const today=active.filter(g=>g.today_state==='today'),done=today.filter(g=>readDayDone(storage(),g.id,day)).length;
 count.textContent=isDec?done+' von '+today.length+' heute offenen Kalendern erledigt':'Bereits '+cache.confirmed.length+' bestätigte Kalender für Dezember 2026';
 root.replaceChildren();
 for(const g of (isDec?active:cache.confirmed)){
  const doneMark=isDec&&readDayDone(storage(),g.id,day);
  if(isDec&&onlyOpen&&(doneMark||g.today_state!=='today'))continue;
  const card=el('article',null,'game advent-card');
  const tag=g.today_state==='deadline-passed'?'Heutige Standardfrist vorbei':isDec?'Heute beim Veranstalter prüfen':'Bestätigt für Dezember 2026 · noch nicht offen';
  card.append(el('span',tag,'pill'),el('h3',g.title),el('p',g.organizer+' · '+g.requirements));
  const deadline=g.daily_deadline||{};
  let msg='Tagesfrist nicht unabhängig bestätigt – auf Originalseite prüfen';
  if(deadline.type==='next_day')msg='Tagesfrist laut Veranstalter in der Regel Folgetag '+deadline.time+' Uhr – am Türchen bestätigen';
  else if(deadline.time)msg='Reguläre Tagesfrist '+deadline.time+' Uhr'+(deadline.certainty==='confirmed'?'':' – mögliche Abweichung im Originalbeitrag');
  card.append(el('p',msg,'meta'),el('p',g.note,'notes'));
  const links=el('div',null,'action');links.append(link('Türchen beim Veranstalter öffnen',g.url),link('Regeln und Datenschutz prüfen',g.terms_url));card.append(links);
  if(isDec&&g.today_state==='today'){
   const lab=el('label',null,'guest-checkrow');
   const input=document.createElement('input');input.type='checkbox';input.dataset.adventDay=g.id;input.checked=doneMark;
   lab.append(input,el('span','Heute teilgenommen – nur auf diesem Gerät merken'));
   input.addEventListener('change',()=>{
    if(!writeDayDone(storage(),g.id,day,input.checked))byId('adventStorageStatus').textContent='Lokales Speichern blockiert: Häkchen können beim Neuladen verloren gehen.';
    paint(new Date());
   });card.append(lab);
  }
  root.append(card);
 }
 if(!root.children.length)root.append(el('p',isDec?'Für heute sind hier keine weiteren bestätigten, offenen Türchen übrig.':'Die 2026er Tageskalender starten am 1. Dezember.','small'));
 status.textContent=isDec?'Heute: '+day+' (Europe/Berlin). Tagesangebote und Ausnahmen stets beim Veranstalter prüfen. Häkchen wechseln automatisch zum nächsten Tag.':'Vorschau: Noch keine heutige Teilnahme. 2025er Kalender und ungeprüfte Kandidaten werden nicht als bestätigt gezählt.';
 if(candidate){
  candidate.replaceChildren();
  for(const g of cache.review_candidates||[]){
   const card=el('article',null,'game');card.append(el('span','Noch nicht als Tagesgewinnspiel bestätigt','pill warn'),el('h3',g.title),el('p',g.reason,'notes'),link('Originalseite prüfen',g.url));candidate.append(card);
  }
 }
}
export async function loadAdvent(){
 try{
  const r=await fetch('/advent-calendars-2026.json',{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  cache=await r.json();paint();
 }catch{
  const s=byId('adventTodayStatus');if(s)s.textContent='Advent-Quellen momentan nicht erreichbar; keine alten Links als aktuell bestätigt.';
 }
}
if(typeof document!=='undefined'&&byId('adventToday')){
 byId('adventOnlyOpen')?.addEventListener('change',()=>paint());
 loadAdvent();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadAdvent()});
}

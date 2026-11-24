// Advent 2026 is separate from regular prize draws and from D1.
// Checkmarks are browser-local and isolated by calendar ID AND Berlin date.
const DAY_PREFIX='gewinnradar:advent:completed:v1:';
const fallback=new Set();
const HIDDEN_PREFIX='gewinnradar:advent:hidden:v1:';
const hiddenFallback=new Map();
export function readAdventHidden(store,id){
 if(!safeId(id))return false;
 try{const value=store.getItem(HIDDEN_PREFIX+id);return value==='1'}catch{return hiddenFallback.get(id)===true}
}
export function writeAdventHidden(store,id,hidden){
 if(!safeId(id))return false;
 hiddenFallback.set(id,Boolean(hidden));
 try{if(hidden)store.setItem(HIDDEN_PREFIX+id,'1');else store.removeItem(HIDDEN_PREFIX+id);return true}catch{return false}
}
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
 if(Array.isArray(game.participation_days)&&!game.participation_days.includes(Number(day.slice(-2))))return 'outside';
 const d=game.daily_deadline||{};
 if(game.open_time&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(game.open_time)&&now.getTime()<berlinDateTime(day,game.open_time))return 'not-open-yet';
 if(d.type==='same_day'&&d.time&& /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(d.time)){
  if(d.certainty!=='not_verified'&&now.getTime()>=(berlinDateTime(day,d.time)+(d.exclusive===true?0:60000)))return 'deadline-passed';
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
 const day=berlinDay(now),active=todayAdventCalendars(cache,now),isDec=validDay(day),onlyOpen=byId('adventOnlyOpen')?.checked,onlyToday=byId('adventOnlyToday')?.checked;
 const visible=cache.confirmed.filter(g=>!readAdventHidden(storage(),g.id));
 const hiddenCount=cache.confirmed.length-visible.length;
 const showHidden=byId('adventShowHidden')?.checked;
 const hiddenInfo=byId('adventHiddenCount');
 if(hiddenInfo)hiddenInfo.textContent=hiddenCount+' Kalender ausgeblendet'+(hiddenCount?' · jederzeit wieder einblendbar':'');
 const today=active.filter(g=>g.today_state==='today'&&!readAdventHidden(storage(),g.id)),done=today.filter(g=>readDayDone(storage(),g.id,day)).length;
 count.textContent=isDec?done+' von '+today.length+' heute offenen Kalendern erledigt':'Bereits '+cache.confirmed.length+' bestätigte Kalender für Dezember 2026';
 const dates=Array.from({length:24},(_,i)=>'2026-12-'+String(i+1).padStart(2,'0'));
 const monthDone=visible.reduce((n,g)=>n+dates.filter(d=>readDayDone(storage(),g.id,d)).length,0);
 const monthCount=byId('adventMonthCount');if(monthCount)monthCount.textContent='Dein Dezember-Fortschritt: '+monthDone+' von '+(visible.length*24)+' Tagesfeldern markiert (ausgeblendete Kalender nicht mitgezählt).';
 root.replaceChildren();
 for(const g of (isDec?(showHidden?cache.confirmed.map(g=>({...g,today_state:dailyState(g,now)})):active):cache.confirmed)){
  const hidden=readAdventHidden(storage(),g.id);
  if(hidden&&!showHidden)continue;
  const doneMark=isDec&&readDayDone(storage(),g.id,day);
  if(isDec&&!hidden&&onlyToday&&g.today_state!=='today')continue;
  if(isDec&&!hidden&&onlyOpen&&doneMark)continue;
  const card=el('article',null,'game advent-card');
  if(hidden)card.classList.add('advent-hidden-card');
  const hideButton=el('button',hidden?'Wieder einblenden':'Ausblenden','secondary');
  hideButton.type='button';
  hideButton.setAttribute('aria-label',(hidden?'Kalender wieder einblenden: ':'Kalender ausblenden: ')+g.title);
  hideButton.addEventListener('click',()=>{
   if(!writeAdventHidden(storage(),g.id,!hidden)){
    const warning=byId('adventStorageStatus');if(warning)warning.textContent='Lokales Speichern blockiert: Ausgeblendete Kalender können beim Neuladen wieder erscheinen.';
   }
   paint(new Date());
   if(hidden){
    const restored=Array.from(root.querySelectorAll('.advent-card button[aria-label]'))
     .find(button=>button.getAttribute('aria-label')==='Kalender ausblenden: '+g.title);
    restored?.focus({preventScroll:true});
   }else{
    byId('adventShowHidden')?.focus({preventScroll:true});
   }
  });
  const hideRow=el('div',null,'action');hideRow.append(hideButton);
  card.append(hideRow);
  const tag=g.today_state==='deadline-passed'?'Heutige Standardfrist vorbei':g.today_state==='not-open-yet'?'Heutiges Türchen noch nicht geöffnet':isDec?'Heute beim Veranstalter prüfen':'Bestätigt für Dezember 2026 · noch nicht offen';
  card.append(el('span',tag,'pill'),el('h3',g.title),el('p',g.organizer+' · '+g.requirements));
  const deadline=g.daily_deadline||{};
  let msg='Tagesfrist nicht unabhängig bestätigt – auf Originalseite prüfen';
  if(deadline.type==='next_day')msg='Tagesfrist laut Veranstalter in der Regel Folgetag '+deadline.time+' Uhr – am Türchen bestätigen';
  else if(deadline.time&&deadline.certainty!=='not_verified')msg='Reguläre Tagesfrist '+deadline.time+' Uhr'+(deadline.certainty==='confirmed'?'':' – mögliche Abweichung im Originalbeitrag');
  if(Array.isArray(g.participation_days))msg='Nur am '+g.participation_days.map(d=>String(d).padStart(2,'0')+'.12.').join(', ')+' · '+msg;
  card.append(el('p',msg,'meta'),el('p',g.note,'notes'));
  if(/newsletter|werbe|marketing/i.test(g.requirements+' '+g.note))card.append(el('p','Werbe-/Newsletter-Bedingungen im Hinweis unbedingt beachten.','notes'));
  if(g.today_state==='outside'&&isDec)card.append(el('p','Heute keine Verlosung bei diesem Veranstalter.','meta'));

  const links=el('div',null,'action');links.append(link('Türchen beim Veranstalter öffnen',g.url),link('Regeln und Datenschutz prüfen',g.terms_url));card.append(links);
  if(isDec&&g.today_state==='today'){
   const lab=el('label',null,'guest-checkrow');
   const input=document.createElement('input');input.type='checkbox';input.dataset.adventDay=g.id;input.checked=doneMark;
   lab.append(input,el('span','Heute teilgenommen – nur auf diesem Gerät merken'));
   input.addEventListener('change',()=>{
    if(!writeDayDone(storage(),g.id,day,input.checked))byId('adventStorageStatus').textContent='Lokales Speichern blockiert: Häkchen können beim Neuladen verloren gehen.';
    paint(new Date());
    const next=root.querySelector('input[data-advent-day="'+g.id+'"]');
    if(next)next.focus({preventScroll:true});
    else byId('adventOnlyOpen')?.focus({preventScroll:true});
   });card.append(lab);
  }
  const dates=Array.from({length:24},(_,i)=>'2026-12-'+String(i+1).padStart(2,'0'));
  const doneDays=dates.filter(d=>readDayDone(storage(),g.id,d)).length;
  const heading=el('p','Dein Dezember: '+doneDays+' von 24 Tagen markiert','advent-day-summary');
  const grid=el('div',null,'advent-day-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Teilnahmetage für '+g.title);
  for(const date of dates){const n=Number(date.slice(-2)),lab=el('label',null,'advent-day-cell'),check=document.createElement('input');check.type='checkbox';check.checked=readDayDone(storage(),g.id,date);check.setAttribute('aria-label',n+'. Dezember 2026: Teilnahme bei '+g.title+' markieren');lab.append(el('span',String(n).padStart(2,'0')),check);check.addEventListener('change',()=>{if(!writeDayDone(storage(),g.id,date,check.checked)){const warning=byId('adventStorageStatus');if(warning)warning.textContent='Lokales Speichern blockiert: Häkchen können beim Neuladen verloren gehen.';}paint(new Date());const refreshed=Array.from(root.querySelectorAll('.advent-card')).find(card=>card.querySelector('input[aria-label="'+check.getAttribute('aria-label')+'"]'));refreshed?.querySelector('input[aria-label="'+check.getAttribute('aria-label')+'"]')?.focus({preventScroll:true})});grid.append(lab)}
  card.append(heading,grid);
  root.append(card);
 }
 if(!root.children.length){
  const filtered=isDec&&(onlyToday||onlyOpen||hiddenCount>0);
  root.append(el('p',filtered?'Keine Kalender mit diesen Filtern sichtbar. Entferne einen Filter oder aktiviere „Ausgeblendete anzeigen“, um weitere Kalender zu sehen.':isDec?'Für heute sind keine bestätigten Kalender verfügbar.':'Die 2026er Tageskalender starten am 1. Dezember.','small'));
 }
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

// A single visitor-controlled disclosure covers both daily Advent and previews.
// Explicit user preference wins over the December default, including on reload.
const ADVENT_DISCLOSURE_KEY='gewinnradar:advent:expanded:v1';
export function updateAdventDisclosure(now=new Date()){
 const day=berlinDay(now);
 const active=day>='2026-12-01'&&day<='2026-12-24';
 const details=byId('adventAllDetails');
 if(!details)return;
 if(details.dataset.adventInitialized!=='1'){
  let preference=null;
  try{preference=window.localStorage.getItem(ADVENT_DISCLOSURE_KEY)}catch{}
  details.open=preference==='1'?true:preference==='0'?false:active;
  details.dataset.adventInitialized='1';
  // A summary click is an explicit visitor decision. Persist the next state
  // synchronously before navigation/reload; native toggle events may be delayed.
  details.querySelector('summary')?.addEventListener('click',()=>{
   try{window.localStorage.setItem(ADVENT_DISCLOSURE_KEY,details.open?'0':'1')}catch{}
  });
 }
 const summary=byId('adventAllHeading');
 if(summary)summary.textContent=details.open?'🎄 Adventskalender 2026 – zum Einklappen klicken':'🎄 Adventskalender 2026 – eingeklappt · zum Anzeigen klicken';
 // The summary text follows both user clicks and seasonal defaults.
 if(details.dataset.adventSummaryBound!=='1'){
  details.addEventListener('toggle',()=>{const heading=byId('adventAllHeading');if(heading)heading.textContent=details.open?'🎄 Adventskalender 2026 – zum Einklappen klicken':'🎄 Adventskalender 2026 – eingeklappt · zum Anzeigen klicken'});
  details.dataset.adventSummaryBound='1';
 }
}

if(typeof document!=='undefined'&&byId('adventToday')){
 updateAdventDisclosure();
 byId('adventOnlyOpen')?.addEventListener('change',()=>paint());
 byId('adventOnlyToday')?.addEventListener('change',()=>paint());
 byId('adventShowHidden')?.addEventListener('change',()=>paint());
 loadAdvent();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){updateAdventDisclosure();loadAdvent()}});
 setInterval(()=>{if(document.visibilityState==='visible'){updateAdventDisclosure();paint(new Date())}},60000);
}

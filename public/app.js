import {visibleGames} from './filters.js';
const $=id=>document.getElementById(id);let user=null;let games=[];let lastLoadedAt=0;let lastLoadedDay='';let inflight=null;
const berlinDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function api(path,options){const r=await fetch('/api/'+path,{credentials:'same-origin',...options});const v=await r.json();if(!r.ok)throw Error(v.error||'Verbindung fehlgeschlagen');return v}
function el(tag,text,className){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e}
function loadDashboard(){document.body.classList.toggle('senior',Boolean(user.senior_mode));$('loginPanel').classList.add('hidden');$('logout').classList.remove('hidden');document.querySelectorAll('.personalOnly').forEach(n=>n.classList.remove('hidden'));$('greeting').textContent='Willkommen, '+user.display_name+'! 🍀';$('daily').checked=Boolean(user.daily_email);$('senior').checked=Boolean(user.senior_mode);refresh()}
function refresh(){
 if(inflight)return inflight;
 inflight=(async()=>{
  try{
   const r=await api('games');
   if(!Array.isArray(r.games))throw Error('Ungültiger Katalog');
   games=r.games;lastLoadedAt=Date.now();lastLoadedDay=berlinDay();render();
  }catch(e){
   // Fail closed: yesterday's verified door must not remain clickable after network failure.
   games=[];lastLoadedAt=0;lastLoadedDay='';render();
   $('resultCount').textContent='Aktuelle Gewinnspiele konnten nicht geprüft werden.';
   $('cards').replaceChildren(el('p','Verbindung fehlgeschlagen: '+e.message+' · Bitte erneut aktualisieren.','panel'));
  }
 })().finally(()=>{inflight=null});
 return inflight;
}
function refreshOnResume(){
 if(document.visibilityState==='hidden')return;
 if(!lastLoadedAt||berlinDay()!==lastLoadedDay||Date.now()-lastLoadedAt>5*60*1000)refresh();
}
function render(){let filter=$('filter').value;let list=visibleGames(games,{status:filter,dailyOnly:$('dailyOnly').checked,simpleOnly:$('simpleOnly').checked,query:$('searchGames').value,sort:$('sortGames').value});const completed=games.filter(g=>g.completed).length;
const reviewedLinks=Number(document.body.dataset.editorialLiveCount||0);
$('counter').textContent=user?completed+' von '+games.length+' D1-Einträgen erledigt':(games.length+reviewedLinks)+' geprüfte Aktionen (davon '+games.length+' D1)';
const progress=document.querySelector('#progressBar');
if(progress){progress.max=Math.max(games.length,1);progress.value=completed;progress.setAttribute('aria-label',completed+' von '+games.length+' Gewinnspielen erledigt')}
const hint=document.querySelector('#progressHint');
if(hint)hint.textContent=games.length===0?'Noch keine freigegebenen Gewinnspiele vorhanden.':(games.length-completed)+' Gewinnspiele sind noch offen.';$('resultCount').textContent=list.length+' von '+games.length+' Gewinnspielen angezeigt';const root=$('cards');root.replaceChildren();if(!list.length){const empty=el('div',null,'panel');empty.append(el('p',games.length?'Keine Treffer für diese Suche oder Filter.':'Aktuell sind noch keine freigegebenen Gewinnspiele eingetragen.'));if(games.length){const reset=el('button','Suche und Filter zurücksetzen','secondary');reset.type='button';reset.onclick=()=>{$('searchGames').value='';$('filter').value='all';$('sortGames').value='deadline';$('dailyOnly').checked=false;$('simpleOnly').checked=false;render()};empty.append(reset)}root.append(empty);return}for(const g of list){const c=el('article',null,'game');c.append(el('span',g.daily?'Tagesaktion – heutiges Türchen prüfen':'Einmalige Teilnahme','pill'));c.append(el('h2',g.title));c.append(el('p','Veranstalter: '+g.organizer+' · Gewinn: '+g.prize));c.append(el('p',(g.daily?'Kalender-Ende: ':'Teilnahmeschluss: ')+new Date(g.ends_at).toLocaleString('de-DE')+' · Benötigte Angaben: '+(g.required_data||'Siehe Teilnahmebedingungen'),'meta'));if(g.daily)c.append(el('p','Die Frist für das heutige Türchen kann früher liegen. Tagesgewinn, heutige Teilnahmeberechtigung und genaue Frist unbedingt auf der Originalseite kontrollieren.','meta'));if(g.solution)c.append(el('p','Recherchierte Lösung: '+g.solution));const actions=el('div',null,'action');const link=el('a','Jetzt am Gewinnspiel teilnehmen ↗','btn');link.href=g.url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);if(user){const doneLabel=el('label',null,'checkrow'),done=document.createElement('input');done.type='checkbox';done.checked=Boolean(g.completed);done.setAttribute('aria-label','Teilnahme als erledigt markieren: '+g.title);doneLabel.append(done,el('span','Ich habe teilgenommen'));done.onchange=()=>toggle(g,'completed',done.checked,done);actions.append(doneLabel);const favLabel=el('label',null,'checkrow'),fav=document.createElement('input');fav.type='checkbox';fav.checked=Boolean(g.favorite);fav.setAttribute('aria-label','Für tägliche Erinnerungen merken: '+g.title);favLabel.append(fav,el('span','Für Erinnerung merken ⭐'));fav.onchange=()=>toggle(g,'favorite',fav.checked,fav);actions.append(favLabel)}const entry=typeof g.email_entry==='string'&&g.email_entry.startsWith('EMAIL_ENTRY_V1:')?(()=>{try{return JSON.parse(g.email_entry.slice(15))}catch{return null}})():null;
if(entry&&typeof entry.to==='string'&&typeof entry.subject==='string'&&typeof entry.fields==='string'){
 c.append(el('p','Manuelle E-Mail-Teilnahme: An '+entry.to+' · Betreff: '+entry.subject+' · Benötigte Angaben: '+entry.fields,'meta'));
}
c.append(actions);const notes=el('p',null,'notes'),terms=el('a','Teilnahmebedingungen');terms.href=g.terms_url;terms.target='_blank';terms.rel='noopener noreferrer';const privacy=el('a','Datenschutz');privacy.href=g.privacy_url;privacy.target='_blank';privacy.rel='noopener noreferrer';notes.append(terms,document.createTextNode(' · '),privacy,document.createTextNode(' · Zuletzt geprüft: '+(g.verified_at?new Date(g.verified_at).toLocaleDateString('de-DE'):'unbekannt')));c.append(notes);root.append(c)}}
async function toggle(g,action,value,input){input.disabled=true;try{await api('progress',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:g.id,action,value})});g[action]=+value;render()}catch(e){const msg=$('actionMessage');if(msg){msg.textContent='Änderung nicht gespeichert: '+e.message;msg.focus()}input.checked=!value;refresh()}finally{input.disabled=false}}
$('searchGames').addEventListener('input',render);$('sortGames').addEventListener('change',render);$('filter').addEventListener('change',render);$('dailyOnly').addEventListener('change',render);$('simpleOnly').addEventListener('change',render);$('refresh').onclick=refresh;
document.addEventListener('editorialLinksUpdated',render);
document.addEventListener('visibilitychange',refreshOnResume);
window.addEventListener('focus',refreshOnResume);
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginMessage').textContent='Prüfe deine Anfrage …';try{let d=await api('login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:$('email').value})});$('loginMessage').textContent=d.message}catch(err){$('loginMessage').textContent=err.message}};
$('saveSettings').onclick=async()=>{try{await api('settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({daily_email:$('daily').checked,senior_mode:$('senior').checked})});user.daily_email=+$('daily').checked;user.senior_mode=+$('senior').checked;document.body.classList.toggle('senior',Boolean(user.senior_mode));$('settingsMessage').textContent='Gespeichert ✓'}catch(err){$('settingsMessage').textContent=err.message}};
$('logout').onclick=async()=>{await api('logout',{method:'POST'});location.reload()};
(async()=>{if(new URLSearchParams(location.search).get('login')==='invalid')$('loginMessage').textContent='Anmeldelink ungültig oder abgelaufen.';try{let data=await api('me');if(data.user){user=data.user;loadDashboard()}}catch{} if(!user)refresh()})();

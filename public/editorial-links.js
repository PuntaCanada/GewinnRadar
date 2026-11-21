// Public, independently source-reviewed outbound links; separate from D1's
// account-based publication gate, favorites, reminders and participation.
const $=id=>document.getElementById(id);
const line=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n};
function outbound(label,url,primary=false){
 const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';if(primary)a.className='btn';return a;
}
function issueLink(game,category='verdacht'){
 // GitHub's public issue form requires a GitHub login; never collect reports
 // directly on GewinnRadar without storage/abuse and privacy protections.
 const u=new URL('https://github.com/PuntaCanada/GewinnRadar/issues/new');
 u.searchParams.set('template','gewinnspiel-melden.yml');
 u.searchParams.set('title',(category==='freigabe'?'Prüfvorschlag: ':'Verdachtsmeldung: ')+String(game.title||game.id).slice(0,95));
 return u.href;
}
function sourceUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.username===''&&u.password===''?u.href:null}catch{return null}
}
// Public editorial cards use browser-local participation marks, not D1 or login.
// The value is deliberately a boolean rather than any personal information.
const JOIN_KEY='gewinnradar:guest:completed:v1:';
const fallbackCompleted=new Set();
function safeId(id){return typeof id==='string'&&/^[a-z0-9][a-z0-9-]{2,99}$/.test(id)}
export function readGuestCompleted(storage,id){
 if(!safeId(id))return false;
 try{return storage.getItem(JOIN_KEY+id)==='1'}catch{return fallbackCompleted.has(id)}
}
export function writeGuestCompleted(storage,id,completed){
 if(!safeId(id))return false;
 try{
  if(completed)storage.setItem(JOIN_KEY+id,'1');
  else storage.removeItem(JOIN_KEY+id);
  if(completed)fallbackCompleted.add(id);else fallbackCompleted.delete(id);
  return true;
 }catch{
  if(completed)fallbackCompleted.add(id);else fallbackCompleted.delete(id);
  return false;
 }
}
function guestStorage(){
 try{return window.localStorage}catch{return {getItem(){throw Error('storage blocked')},setItem(){throw Error('storage blocked')},removeItem(){throw Error('storage blocked')}}}
}
function updateGuestProgress(){
 const boxes=[...document.querySelectorAll('#editorialLive input[data-joined-contest]')];
 const count=boxes.filter(b=>b.checked).length;
 const summary=$('editorialProgress');
 if(summary)summary.textContent=count+' von '+boxes.length+' aktuellen Gewinnspielen als teilgenommen markiert';
 const hideDone=$('editorialOnlyOpen')?.checked||false;
 for(const input of boxes){
  const card=input.closest('.game');
  if(card){
   card.classList.toggle('joined-completed',input.checked);
   card.classList.toggle('hidden',hideDone&&input.checked);
  }
 }
}
export function editorialDeadline(exclusiveEnd){
 const instant=Date.parse(exclusiveEnd);
 if(!Number.isFinite(instant))return null;
 // JSON end timestamps are exclusive: midnight 01.01 means 31.12, 23:59.
 const minute=new Date(instant-1);
 return minute.toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',', ' ·')+' Uhr';
}
export function eligibleEditorialLinks(data,now=new Date()){
 if(!data||data.schema_version!==1||!Array.isArray(data.active)||!Array.isArray(data.preview))throw Error('Ungültige Quellenliste');
 // A blocked ID or exact HTTPS URL is never shown as an active action.
 const blocked=new Set(Array.isArray(data.blacklist)?data.blacklist.filter(b=>b&&b.verified===true).flatMap(b=>[b.id,b.url].filter(Boolean)):[]);
 const live=data.active.filter(g=>{
  const start=Date.parse(g.starts_at),end=Date.parse(g.ends_at);
  return !blocked.has(g.id)&&!blocked.has(g.url)&&Number.isFinite(start)&&Number.isFinite(end)&&start<=now.getTime()&&now.getTime()<end&&
    /^\d{4}-\d{2}-\d{2}$/.test(g.reviewed_on)&&
    Date.parse(g.reviewed_on+'T00:00:00Z')<=now.getTime()&&
    now.getTime()-Date.parse(g.reviewed_on+'T00:00:00Z')<=8*86400000&&
    [g.url,g.terms_url,g.privacy_url].every(sourceUrl);
 }).sort((a,b)=>Date.parse(a.ends_at)-Date.parse(b.ends_at)||a.title.localeCompare(b.title,'de')||a.id.localeCompare(b.id));
 const future=data.preview.filter(g=>!blocked.has(g.id)&&!blocked.has(g.url)&&g.starts_on&&g.ends_on&&g.ends_on>=now.toISOString().slice(0,10)&&
  [g.url,g.terms_url].every(sourceUrl));
 return {live,future};
}
export function renderEditorialLinks(data,now=new Date()){
 const liveRoot=$('editorialLive'),futureRoot=$('adventPreview'),status=$('editorialStatus');
 if(!liveRoot||!futureRoot||!status)return;
 const {live,future}=eligibleEditorialLinks(data,now);
 document.body.dataset.editorialLiveCount=String(live.length);
 document.body.dataset.editorialConfirmedCount=String(live.filter(g=>g.source_audit?.status==='confirmed').length);
 document.dispatchEvent(new Event('editorialLinksUpdated'));
 liveRoot.replaceChildren();futureRoot.replaceChildren();
 $('editorialCount').textContent=live.length+' recherchierte Originalaktion'+(live.length===1?'':'en')+' · '+live.filter(g=>g.source_audit?.status==='confirmed').length+' anhand der Bedingungen bestätigt';
 for(const g of live){
  const card=line('article',null,'game');
  const type=g.participation_type||'web_form';
  const kinds={web_form:'Onlineformular',external_form:'Externes Formular – noch selbst prüfen',instagram:'Instagram-Konto erforderlich',social:'Facebook oder Instagram erforderlich',whatsapp_email:'WhatsApp-Kanal + eigene E-Mail',instagram_tiktok:'Instagram oder TikTok erforderlich',newsletter:'Werbe-Newsletter verpflichtend',offline_qr:'QR-Code im Geschäft erforderlich',email_photo:'Eigenes Foto und E-Mail erforderlich',postal_newsletter:'Postkarte oder Newsletter + Code',email:'Eigene E-Mail erforderlich',app_account:'App und neues Konto erforderlich',account:'Kostenloses Kundenkonto erforderlich'};
  card.append(line('span',kinds[type]||'Teilnahmeweg prüfen','pill'));
  const audit=g.source_audit;
  const auditNames={confirmed:'Teilnahmebedingungen bestätigt',partial:'Teilweise prüfbar',blocked:'Zugriff gesperrt',unconfirmed:'Aktuell nicht bestätigt'};
  if(audit){card.append(line('p','Quellenstatus: '+(auditNames[audit.status]||'Unbekannt')+' · '+audit.checked_on,'meta'));card.append(line('p',audit.summary,'notes'));}
  card.append(line('p','Teilnahmeschluss: '+(g.deadline_label||editorialDeadline(g.ends_at)),'meta'));
  card.append(line('p','Zuletzt geprüft: '+new Date(g.reviewed_on+'T12:00:00Z').toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'}),'meta'));
  card.append(line('h2',g.title),line('p','Veranstalter: '+g.organizer+' · Gewinne: '+g.prize));
  card.append(line('p','Benötigt: '+g.required_data,'meta'));
  if(g.marketing_requirements)card.append(line('p','Werbung & Datenschutz: '+g.marketing_requirements,'notes'));
  card.append(line('p',g.note,'notes'));
  const links=line('div',null,'action');
  links.append(outbound(type==='web_form'&&audit?.status==='confirmed'?'Jetzt beim Veranstalter teilnehmen':'Offiziellen Teilnahmeweg prüfen',g.url,true),outbound('Teilnahmebedingungen',g.terms_url),outbound('Datenschutz',g.privacy_url));
  card.append(links);
  const joinedLabel=line('label',null,'guest-checkrow');
  const joinedBox=document.createElement('input');
  joinedBox.type='checkbox';joinedBox.dataset.joinedContest=g.id;
  joinedBox.checked=readGuestCompleted(guestStorage(),g.id);
  const joinedText=line('span','Ich habe teilgenommen');
  joinedLabel.append(joinedBox,joinedText);
  joinedBox.addEventListener('change',()=>{
   const persisted=writeGuestCompleted(guestStorage(),g.id,joinedBox.checked);
   const info=$('editorialStorageStatus');
   if(info&&!persisted)info.textContent='Hinweis: Dein Browser blockiert die lokale Speicherung. Die Häkchen können nach einem Neuladen verloren gehen.';
   updateGuestProgress();
  });
  card.append(joinedLabel);
  const report=outbound('Problem oder Betrugsverdacht melden','/melden/?id='+encodeURIComponent(g.id));
  report.className='small';card.append(report);liveRoot.append(card);
 }
 updateGuestProgress();
 if(!live.length)liveRoot.append(line('p','Derzeit kein noch laufender, separat geprüfter Direktlink. Neue Aktionen werden nach Einzelprüfung ergänzt.','small'));
 for(const g of future){
  const card=line('article',null,'game');
  card.append(line('span','Vorschau – nicht zur Teilnahme freigegeben','pill warn'));
  card.append(line('h2',g.title),line('p','Veranstalter: '+g.organizer));
  card.append(line('p','Geplanter Start: '+new Date(g.starts_on+'T12:00:00Z').toLocaleDateString('de-DE')+' · geplantes Ende: '+new Date(g.ends_on+'T12:00:00Z').toLocaleDateString('de-DE'),'meta'),line('p',g.note,'notes'));
  const links=line('div',null,'action');links.append(outbound('Offizielle Informationsseite',g.url),outbound('Teilnahmebedingungen',g.terms_url));
  card.append(links);futureRoot.append(card);
 }
 const reviewRoot=$('editorialReview');
 if(reviewRoot){
  reviewRoot.replaceChildren();
  const all=Array.isArray(data.review_candidates)?data.review_candidates:[];
  const blocked=new Set(Array.isArray(data.blacklist)?data.blacklist.filter(b=>b&&b.verified===true).map(b=>b.id):[]);
  for(const g of all.filter(e=>!blocked.has(e.id))){
   const box=line('article',null,'game');
   box.append(line('span','Noch nicht zur Teilnahme freigegeben','pill warn'));
   box.append(line('h3',g.title),line('p','Veranstalter: '+g.organizer));
   box.append(line('p','Prüfgrund: '+g.reason,'notes'));
   const actions=line('div',null,'action');
   actions.append(outbound('Offizielle Bedingungen prüfen',g.terms_url));
   actions.append(outbound('Prüfung/Freigabe vorschlagen','/melden/?id='+encodeURIComponent(g.id)));
   box.append(actions);reviewRoot.append(box);
  }
 }
 status.textContent='Zuletzt anhand der Originalquellen recherchiert: '+data.reviewed_on+
  '. Direkte Links sind keine D1-Administratorenfreigaben. Tagesaktionen müssen bei Öffnung erneut geprüft werden.';
}
export async function loadEditorialLinks(){
 const status=$('editorialStatus');
 try{
  const res=await fetch('/editorial-links-2026.json',{cache:'no-store'});
  if(!res.ok)throw Error('Quellenliste vorübergehend nicht verfügbar');
  renderEditorialLinks(await res.json());
 }catch{
  $('editorialLive')?.replaceChildren();$('adventPreview')?.replaceChildren();$('editorialReview')?.replaceChildren();
  document.body.dataset.editorialLiveCount='0';
  document.body.dataset.editorialConfirmedCount='0';
  document.dispatchEvent(new Event('editorialLinksUpdated'));
  if($('editorialCount'))$('editorialCount').textContent='0 derzeit überprüfbare Direktlinks';
  if(status)status.textContent='Quellenliste derzeit nicht verfügbar. Alte Links wurden aus Sicherheitsgründen ausgeblendet.';
 }
}
if(typeof document!=='undefined'&&$('editorialLive')){
 $('editorialOnlyOpen')?.addEventListener('change',updateGuestProgress);
 loadEditorialLinks();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadEditorialLinks()});
}

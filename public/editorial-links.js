// Public, independently source-reviewed outbound links; separate from D1's
// account-based publication gate, favorites, reminders and participation.
const $=id=>document.getElementById(id);
const line=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n};
function outbound(label,url,primary=false){
 const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';if(primary)a.className='btn';return a;
}
function sourceUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.username===''&&u.password===''?u.href:null}catch{return null}
}
export function eligibleEditorialLinks(data,now=new Date()){
 if(!data||data.schema_version!==1||!Array.isArray(data.active)||!Array.isArray(data.preview))throw Error('Ungültige Quellenliste');
 const live=data.active.filter(g=>{
  const start=Date.parse(g.starts_at),end=Date.parse(g.ends_at);
  return Number.isFinite(start)&&Number.isFinite(end)&&start<=now.getTime()&&now.getTime()<end&&
    g.reviewed_on==='2026-11-21'&&[g.url,g.terms_url,g.privacy_url].every(sourceUrl);
 });
 const future=data.preview.filter(g=>g.starts_on&&g.ends_on&&g.ends_on>=now.toISOString().slice(0,10)&&
  [g.url,g.terms_url].every(sourceUrl));
 return {live,future};
}
export function renderEditorialLinks(data,now=new Date()){
 const liveRoot=$('editorialLive'),futureRoot=$('adventPreview'),status=$('editorialStatus');
 if(!liveRoot||!futureRoot||!status)return;
 const {live,future}=eligibleEditorialLinks(data,now);
 document.body.dataset.editorialLiveCount=String(live.length);
 document.dispatchEvent(new Event('editorialLinksUpdated'));
 liveRoot.replaceChildren();futureRoot.replaceChildren();
 $('editorialCount').textContent=live.length+' aktuell geprüfte Originalaktion'+(live.length===1?'':'en');
 for(const g of live){
  const card=line('article',null,'game');
  card.append(line('span','Originalquelle und Teilnahmeformular geprüft · '+new Date(g.ends_at).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'}),'pill'));
  card.append(line('h2',g.title),line('p','Veranstalter: '+g.organizer+' · Gewinne: '+g.prize));
  card.append(line('p','Benötigt: '+g.required_data,'meta'));
  card.append(line('p',g.note,'notes'));
  const links=line('div',null,'action');
  links.append(outbound('Jetzt beim Veranstalter teilnehmen',g.url,true),outbound('Teilnahmebedingungen',g.terms_url),outbound('Datenschutz',g.privacy_url));
  card.append(links);liveRoot.append(card);
 }
 if(!live.length)liveRoot.append(line('p','Derzeit kein noch laufender, separat geprüfter Direktlink. Neue Aktionen werden nach Einzelprüfung ergänzt.','small'));
 for(const g of future){
  const card=line('article',null,'game');
  card.append(line('span','Vorschau – nicht zur Teilnahme freigegeben','pill warn'));
  card.append(line('h2',g.title),line('p','Veranstalter: '+g.organizer));
  card.append(line('p','Geplanter Zeitraum: '+g.starts_on+' bis '+g.ends_on,'meta'),line('p',g.note,'notes'));
  const links=line('div',null,'action');links.append(outbound('Offizielle Informationsseite',g.url),outbound('Teilnahmebedingungen',g.terms_url));
  card.append(links);futureRoot.append(card);
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
  $('editorialLive')?.replaceChildren();$('adventPreview')?.replaceChildren();
  document.body.dataset.editorialLiveCount='0';
  document.dispatchEvent(new Event('editorialLinksUpdated'));
  if($('editorialCount'))$('editorialCount').textContent='0 derzeit überprüfbare Direktlinks';
  if(status)status.textContent='Quellenliste derzeit nicht verfügbar. Alte Links wurden aus Sicherheitsgründen ausgeblendet.';
 }
}
if(typeof document!=='undefined'&&$('editorialLive')){
 loadEditorialLinks();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadEditorialLinks()});
}

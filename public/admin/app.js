const status=document.querySelector('#status'),list=document.querySelector('#list');
function msg(t){status.textContent=t}
async function api(path,options){const r=await fetch('/api/admin/'+path,{credentials:'same-origin',...options});const j=await r.json();if(!r.ok)throw Error(j.error||'Fehler');return j}
function node(tag,txt){const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n}
async function reload(){
 try {
  const data=await api('contests');
  list.replaceChildren();
  if(!data.contests.length){list.append(node('p','Noch keine Kandidaten.'));return}
  for(const g of data.contests){
   const card=node('article');card.className='game';
   const title=node('h2',g.title+' ('+g.status+')');card.append(title);
   const prize=node('p',g.organizer+' · '+g.prize);card.append(prize);
   const urls=node('p');for(const [label,url] of [['Original',g.url],['Bedingungen',g.terms_url],['Datenschutz',g.privacy_url]]){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';urls.append(a,document.createTextNode(' · '))}card.append(urls);
   card.append(node('p','Ende: '+g.ends_at+' · Linkstatus: '+g.link_state));
   const form=node('form');
   const checks=[
    ['original_checked','Originalveranstalter und Post geprüft'],
    ['terms_checked','Teilnahmebedingungen 2026 geprüft'],
    ['privacy_checked','Datenschutz geprüft'],
    ['germany_eligible','In Deutschland teilnahmeberechtigt'],
    ['no_mandatory_marketing','Keine Pflichtwerbung/Datenweitergabe'],
    ['no_payment_required','Keine Zahlung/Kauf-/Abopflicht'],
    ['human_verified','Persönlich und bewusst geprüft']
   ];
   for(const [key,label] of checks){const l=node('label');l.className='toggle';const box=node('input');box.type='checkbox';box.name=key;l.append(box,document.createTextNode(' '+label));form.append(l)}
   const noteLabel=node('label','Dokumentierter Prüfnachweis (mindestens 20 Zeichen)');const note=node('textarea');note.name='note';note.required=true;note.rows=3;note.style.width='100%';noteLabel.append(node('div'));noteLabel.append(note);form.append(noteLabel);
   for(const action of ['approve','review','reject']){const b=node('button',action==='approve'?'Freigeben':action==='review'?'Zur Prüfung zurück':'Ablehnen');b.type='button';b.className=action==='approve'?'':'secondary';b.style.margin='4px';b.onclick=async()=>{const data={id:g.id,action,note:note.value,checked_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')};for(const [key] of checks)data[key]=form.elements.namedItem(key).checked;b.disabled=true;try{await api('review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});msg('Entscheidung gespeichert');await reload()}catch(e){msg(e.message)}finally{b.disabled=false}};form.append(b)}
   card.append(form);list.append(card)
  }
 }catch(e){msg('Keine Admin-Berechtigung oder Fehler: '+e.message);list.replaceChildren()}
}
document.querySelector('#newForm').onsubmit=async event=>{
 event.preventDefault();const f=event.currentTarget,fd=new FormData(f),obj=Object.fromEntries(fd.entries());obj.daily=fd.has('daily');
 try{await api('contests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(obj)});f.reset();msg('Kandidat angelegt – noch NICHT veröffentlicht.');await reload()}catch(e){msg(e.message)}
};
reload();

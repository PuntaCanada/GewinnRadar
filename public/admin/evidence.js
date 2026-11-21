const $=id=>document.getElementById(id);
const status=$('evidenceStatus'),events=$('evidenceEvents');
async function request(url,options){
 const response=await fetch(url,{credentials:'same-origin',...options});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Anfrage abgelehnt');
 return data;
}
function item(text){const li=document.createElement('li');li.textContent=text;return li}
async function history(){
 events.replaceChildren();
 const id=$('evidenceCandidate').value.trim();
 if(!id){status.textContent='Bitte zuerst Kandidaten-ID eingeben.';return;}
 try{
  const result=await request('/api/admin/source-evidence?id='+encodeURIComponent(id));
  status.textContent=result.events.length+' dokumentierte Prüfungen (neueste zuerst).';
  if(!result.events.length){events.append(item('Noch kein protokollierter Prüfbeleg.'));return}
  for(const e of result.events){
   events.append(item((e.observed_at||'Ohne Datum')+' · '+e.evidence_kind+' · '+e.verdict+' · '+e.finding+' · Original: '+e.source_url));
  }
 }catch(e){status.textContent=e.message}
}
$('evidenceHistory').onclick=history;
$('evidenceForm').onsubmit=async e=>{
 e.preventDefault();
 const fd=new FormData(e.currentTarget);
 const payload={
  candidate_id:String(fd.get('candidate_id')||'').trim(),
  source_url:String(fd.get('source_url')||'').trim(),
  source_year:2026,
  evidence_kind:fd.get('evidence_kind'),
  verdict:fd.get('verdict'),
  finding:String(fd.get('finding')||'').trim()
 };
 const submit=$('evidenceSave');submit.disabled=true;
 try{
  const result=await request('/api/admin/source-evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  await history();
  status.textContent=result.approved===false?'Quellenbeleg gespeichert. Gewinnspiel bleibt ungeprüft und wird nicht versendet.':'Prüfergebnis gespeichert.';
 }catch(err){status.textContent=err.message}finally{submit.disabled=false}
};

const form=document.getElementById('verifiedForm');
const out=document.getElementById('verifiedStatus');
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 const data=new FormData(form);
 const payload={
  game_id:String(data.get('game_id')||'').trim(),
  form_url:String(data.get('form_url')||'').trim(),
  privacy_url:String(data.get('privacy_url')||'').trim(),
  required_fields:String(data.get('required_fields')||'').trim(),
  notes:String(data.get('notes')||'').trim()
 };
 for(const key of ['form_observed','correct_year','german_residents','no_marketing_required','no_purchase_required','no_account_or_app_obligation','no_unresolved_deadline_conflict'])payload[key]=data.get(key)==='on';
 const save=document.getElementById('verifiedSave');
 save.disabled=true;out.textContent='Nachweis wird geprüft …';
 try{
  const response=await fetch('/api/admin/form-verification',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Formularprüfung nicht gespeichert');
  out.textContent='Formularprüfung gespeichert. Noch keine Gewinnspiel-Freigabe und keine Erinnerungen.';
 }catch(error){out.textContent='Nicht gespeichert: '+error.message}
 finally{save.disabled=false}
});

const form=document.getElementById('linkConfirmationForm');
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 const data=new FormData(form);
 const payload={
  game_id:String(data.get('game_id')||'').trim(),
  original_url:String(data.get('original_url')||'').trim(),
  note:String(data.get('note')||'').trim(),
  opened_original:data.get('opened_original')==='on',
  checked_no_redirect:data.get('checked_no_redirect')==='on',
  checked_live_entry:data.get('checked_live_entry')==='on'
 };
 const btn=document.getElementById('linkConfirmSave'),out=document.getElementById('linkConfirmStatus');
 btn.disabled=true;out.textContent='Prüfe gespeicherten Formularnachweis …';
 try{
  const response=await fetch('/api/admin/link-confirmation',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Link-Nachweis nicht gespeichert');
  out.textContent='Original-Link bestätigt und protokolliert; das Gewinnspiel wird dadurch nicht freigegeben.';
 }catch(error){out.textContent='Nicht gespeichert: '+error.message}
 finally{btn.disabled=false}
});

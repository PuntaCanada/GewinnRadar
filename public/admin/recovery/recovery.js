const form=document.getElementById('adminRecoveryForm');
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 const key=String(new FormData(form).get('recovery_secret')||'');
 const button=document.getElementById('recoverySubmit');
 const status=document.getElementById('recoveryStatus');
 button.disabled=true;status.textContent='Wiederherstellungsfreigabe wird geprüft …';
 try{
  const response=await fetch('/api/admin/recover',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({recovery_secret:key})
  });
  const result=await response.json();
  if(!response.ok||result.recovered_existing_admin!==true)throw Error('Nicht berechtigt');
  form.reset();status.textContent='Admin-Sitzung für das vorhandene Konto eingerichtet.';
  location.assign('/admin/');
 }catch{
  status.textContent='Wiederherstellung verweigert. Cloudflare-Schalter, eindeutiges vorhandenes Konto, Migration und Schlüssel privat prüfen.';
 }finally{form.reset();button.disabled=false}
});
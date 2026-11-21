const form=document.getElementById('bootstrapForm');
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 const secret=String(new FormData(form).get('setup_secret')||'');
 const button=document.getElementById('setupSubmit'),out=document.getElementById('setupStatus');
 button.disabled=true;out.textContent='Einmalige Berechtigung wird geprüft …';
 try{
  const response=await fetch('/api/admin/bootstrap',{method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json'},body:JSON.stringify({setup_secret:secret})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Ersteinrichtung nicht möglich');
  form.reset();
  out.textContent='Admin-Sitzung eingerichtet. Weiter zur Redaktion …';
  location.assign('/admin/');
 }catch{
  // Do not repeat a supplied key or server details on screen.
  out.textContent='Einrichtung nicht möglich. Prüfe Cloudflare-Freigabe, Schlüssel und D1-Migration; der Zugang könnte bereits eingerichtet sein.';
 }finally{form.reset();button.disabled=false}
});

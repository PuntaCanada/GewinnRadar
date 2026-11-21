const form=document.querySelector('#testForm'),message=document.querySelector('#message'),code=document.querySelector('#testCode');
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const value=code.value;
 code.value='';
 form.querySelector('button').disabled=true;
 message.textContent='Prüfe einmalige Freigabe …';
 try {
  const response=await fetch('/api/admin-login-test',{method:'POST',
   headers:{'content-type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({code:value}),credentials:'same-origin'});
  const result=await response.json();
  message.textContent=result.message||result.error||'Keine Bestätigung verfügbar.';
 }catch{message.textContent='Verbindung fehlgeschlagen. Die Freigabe nicht ohne Prüfung erneut versuchen.'}
 finally{form.querySelector('button').disabled=false}
});
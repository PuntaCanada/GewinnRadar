const button=document.getElementById('readinessRefresh');
const summary=document.getElementById('readinessSummary');
const list=document.getElementById('readinessList');
button?.addEventListener('click',async()=>{
 button.disabled=true;summary.textContent='Prüfe gespeicherte Gewinnspiele …';list.replaceChildren();
 try{
  const response=await fetch('/api/admin/readiness',{credentials:'same-origin'});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Keine Admin-Berechtigung');
  summary.textContent=result.ready+' freigabereif · '+result.blocked+' mit offenen Voraussetzungen. Keine automatische Veröffentlichung.';
  for(const game of result.contests){
   const item=document.createElement('li'),strong=document.createElement('strong');
   strong.textContent=game.title+' – '+(game.ready?'alle Freigabekriterien erfüllt':'noch gesperrt');
   item.append(strong);
   if(game.reasons.length){const details=document.createElement('ul');for(const reason of game.reasons){const li=document.createElement('li');li.textContent=reason;details.append(li)}item.append(details)}
   list.append(item);
  }
 }catch(e){summary.textContent='Nicht verfügbar: '+e.message}
 finally{button.disabled=false}
});

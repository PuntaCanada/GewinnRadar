const button=document.getElementById('readinessRefresh');
const summary=document.getElementById('readinessSummary');
const list=document.getElementById('readinessList');
button?.addEventListener('click',async()=>{
 button.disabled=true;summary.textContent='Prüfe gespeicherte Gewinnspiele …';list.replaceChildren();
 try{
  const response=await fetch('/api/admin/readiness',{credentials:'same-origin'});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Keine Admin-Berechtigung');
  const research=result.research;
  summary.textContent=result.ready+' öffentlich sichtbar · '+result.blocked+' nicht öffentlich sichtbar. '
   +'D1-Gewinnspiele: '+result.total+'. '
   +(research?'Recherche separat: '+research.candidates+' Kandidaten, '+research.excluded+' ausgeschlossen. ':'')
   +'Keine automatische Veröffentlichung.'
   +(result.truncated?' Achtung: nur '+result.shown+' von '+result.total+' D1-Gewinnspielen einzeln angezeigt.':'');
  if(research && result.total===0 && research.candidates>0){
   const notice=document.createElement('li');
   notice.textContent='Recherchekandidaten liegen nur im Vorprüfbestand, nicht in der öffentlichen games-Tabelle. Erst geprüfte Kandidaten mit vollständigen Nachweisen redaktionell übernehmen.';
   list.append(notice);
  }
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

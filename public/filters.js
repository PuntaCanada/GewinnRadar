// Advisory display filters only. Never treat these as a fraud/privacy certification.
export function simpleParticipation(game){
 const data=String(game?.required_data||'').toLowerCase();
 if(!data)return false;
 if(/telefon|handy|mobile|phone|anschrift|adresse|address|konto|account|app|instagram|facebook|whatsapp|social|registrierung|ausweis|zahlung/.test(data))return false;
 return /(e-mail|email|mail|name|formular)/.test(data);
}
export function visibleGames(games,{status='all',dailyOnly=false,simpleOnly=false,query='',sort='deadline'}={}){
 const needle=String(query).trim().toLocaleLowerCase('de-DE');
 const matching=games.filter(g=>{
  if(needle&&!['title','organizer','prize'].some(field=>String(g[field]||'').toLocaleLowerCase('de-DE').includes(needle)))return false;
  if(status==='favorite'&&!g.favorite)return false;
  if(status==='todo'&&g.completed)return false;
  if(status==='done'&&!g.completed)return false;
  if(dailyOnly&&!g.daily)return false;
  if(simpleOnly&&!simpleParticipation(g))return false;
  return true;
 });
 if(sort==='title')return matching.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'de-DE'));
 return matching.sort((a,b)=>String(a.ends_at||'').localeCompare(String(b.ends_at||'')));
}

// Advisory display filters only. Never treat these as a fraud/privacy certification.
export function simpleParticipation(game){
 const data=String(game?.required_data||'').toLowerCase();
 if(!data)return false;
 if(/telefon|handy|mobile|phone|anschrift|adresse|address|konto|account|app|instagram|facebook|whatsapp|social|registrierung|ausweis|zahlung/.test(data))return false;
 return /(e-mail|email|mail|name|formular)/.test(data);
}
export function visibleGames(games,{status='all',dailyOnly=false,simpleOnly=false}={}){
 return games.filter(g=>{
  if(status==='favorite'&&!g.favorite)return false;
  if(status==='todo'&&g.completed)return false;
  if(status==='done'&&!g.completed)return false;
  if(dailyOnly&&!g.daily)return false;
  if(simpleOnly&&!simpleParticipation(g))return false;
  return true;
 });
}

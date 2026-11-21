import {json,viewer,dayKey,protectMutation} from '../_lib/core.js';
export async function onRequestPost(ctx){
 if(!protectMutation(ctx.request))return json({error:'Ungültiger Ursprung'},403);
 const u=await viewer(ctx);if(!u)return json({error:'Bitte anmelden'},401);
 let data;try{data=await ctx.request.json()}catch{return json({error:'Ungültige Anfrage'},400)}
 if(!data||typeof data.id!=='string'||!['favorite','completed'].includes(data.action)||typeof data.value!=='boolean')return json({error:'Ungültige Eingabe'},400);
 const now=new Date().toISOString();
 const g=await ctx.env.DB.prepare("SELECT g.id,g.daily FROM games g JOIN contest_evidence e ON e.game_id=g.id AND e.human_verified=1 WHERE g.id=? AND g.status='verified' AND g.link_state='ok' AND g.starts_at<=? AND g.ends_at>?")
 .bind(data.id,now,now).first();
 if(!g)return json({error:'Nicht verfügbar'},404);
 const day=g.daily?dayKey():'once';
 if(data.action==='favorite'){
  if(data.value)await ctx.env.DB.prepare('INSERT OR IGNORE INTO favorites(user_id,game_id) VALUES(?,?)').bind(u.id,g.id).run();
  else await ctx.env.DB.prepare('DELETE FROM favorites WHERE user_id=? AND game_id=?').bind(u.id,g.id).run();
 }else{
  if(data.value)await ctx.env.DB.prepare('INSERT OR IGNORE INTO participations(user_id,game_id,day) VALUES(?,?,?)').bind(u.id,g.id,day).run();
  else await ctx.env.DB.prepare('DELETE FROM participations WHERE user_id=? AND game_id=? AND day=?').bind(u.id,g.id,day).run();
 }
 return json({ok:true});
}

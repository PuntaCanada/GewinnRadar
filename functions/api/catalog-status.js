import {json,dayKey} from '../_lib/core.js';
import {verifiedJoins,verifiedConditions,formReviewWindow} from '../_lib/publication-gate.js';

// A public, READ-ONLY diagnostic. Report only what the public catalogue can
// actually show; never disclose pending names, private reviews or database IDs.
export async function onRequestGet(ctx){
 if(!ctx.env?.DB?.prepare)return json({status:'unavailable',visible_games:null},503);
 const now=new Date(),stamp=now.toISOString();
 const [from,until,dayStart]=formReviewWindow(now);
 const sql="SELECT COUNT(*) AS n FROM (SELECT g.id FROM games g"+verifiedJoins+
  " WHERE g.starts_at<=? AND g.ends_at>? AND "+verifiedConditions+
  " ORDER BY g.ends_at ASC LIMIT 500)";
 try{
  const row=await ctx.env.DB.prepare(sql).bind(stamp,stamp,from,until,dayStart).first();
  if(!row||!Number.isSafeInteger(Number(row.n)))throw Error('invalid public count');
  return json({status:'ok',database_connected:true,visible_games:Number(row.n),day:dayKey(now),catalog_limit:500});
 }catch{
  return json({status:'unavailable',database_connected:false,visible_games:null},503);
 }
}

import {json,viewer,dayKey} from '../_lib/core.js';
export async function onRequestGet(ctx){
 const u=await viewer(ctx);
 if(!u)return json({error:'Bitte anmelden'},401);
 const now=new Date().toISOString(),day=dayKey();
 const rows=await ctx.env.DB.prepare("SELECT g.id,g.organizer,g.title,g.prize,g.url,g.terms_url,g.privacy_url,g.starts_at,g.ends_at,g.daily,g.required_data,g.solution,g.verified_at,g.link_state,g.verification_note, CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS favorite, CASE WHEN p.user_id IS NULL THEN 0 ELSE 1 END AS completed FROM games g JOIN contest_evidence e ON e.game_id=g.id AND e.human_verified=1 LEFT JOIN favorites f ON f.user_id=? AND f.game_id=g.id LEFT JOIN participations p ON p.user_id=? AND p.game_id=g.id AND p.day=CASE WHEN g.daily=1 THEN ? ELSE 'once' END WHERE g.status='verified' AND g.starts_at<=? AND g.ends_at>? AND g.link_state='ok' AND g.verified_at IS NOT NULL ORDER BY favorite DESC,g.ends_at ASC LIMIT 500")
 .bind(u.id,u.id,day,now,now).all();
 return json({games:rows.results||[],day});
}

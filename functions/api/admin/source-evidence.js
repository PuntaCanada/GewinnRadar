import {json,viewer,protectMutation} from '../../_lib/core.js';
import {safeAdmin} from '../../_lib/contest-review.js';
import {canonicalContestUrl} from '../../_lib/catalog.js';
const allowed=new Set(['original_2026_page_seen','terms_checked','privacy_checked','form_checked','recheck_needed','excluded']);
const verdicts=new Set(['source_only','pending','excluded','needs_review']);
export async function onRequestGet(ctx){
 const user=await viewer(ctx);if(!safeAdmin(user))return json({error:'Nicht erlaubt'},403);
 const id=new URL(ctx.request.url).searchParams.get('id');
 if(!id||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id))return json({error:'ID erforderlich'},400);
 const r=await ctx.env.DB.prepare("SELECT e.id,e.candidate_id,e.source_url,e.observed_at,e.evidence_kind,e.finding,e.verdict,e.source_year FROM source_evidence_history e WHERE e.candidate_id=? ORDER BY e.id DESC LIMIT 100").bind(id).all();
 return json({events:r.results||[]});
}
export async function onRequestPost(ctx){
 if(!protectMutation(ctx.request))return json({error:'Ungültiger Ursprung'},403);
 const user=await viewer(ctx);if(!safeAdmin(user))return json({error:'Nicht erlaubt'},403);
 let body;try{body=await ctx.request.json()}catch{return json({error:'Ungültiges JSON'},400)}
 if(!body||typeof body!=='object'||!allowed.has(body.evidence_kind)||!verdicts.has(body.verdict)||!Number.isInteger(body.source_year)||body.source_year!==2026||typeof body.finding!=='string'||body.finding.trim().length<20||body.finding.length>1500||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(body.candidate_id||''))return json({error:'Beleg unvollständig'},400);
 const record=await ctx.env.DB.prepare('SELECT id,year,url,terms_url,source_url FROM research_candidates WHERE id=?').bind(body.candidate_id).first();
 if(!record||record.year!==body.source_year)return json({error:'Kein passender 2026-Kandidat'},404);
 const url=canonicalContestUrl(body.source_url);
 if(!url||![record.url,record.terms_url,record.source_url].some(x=>canonicalContestUrl(x)===url))return json({error:'Quelle gehört nicht zum Kandidaten'},400);
 if(body.evidence_kind==='excluded'&&body.verdict!=='excluded')return json({error:'Widersprüchliche Auswertung'},400);
 await ctx.env.DB.prepare('INSERT INTO source_evidence_history(candidate_id,actor_id,source_url,evidence_kind,finding,verdict,source_year) VALUES(?,?,?,?,?,?,?)').bind(body.candidate_id,user.id,body.source_url,body.evidence_kind,body.finding.trim(),body.verdict,body.source_year).run();
 return json({ok:true,approved:false,reminders_enabled:false},201);
}

import {json,viewer,protectMutation} from '../../_lib/core.js';
import {safeAdmin} from '../../_lib/contest-review.js';
import {canonicalContestUrl} from '../../_lib/catalog.js';
import {formReviewWindow} from '../../_lib/publication-gate.js';

// A genuinely manual alternative when the optional link checker is not deployed.
// This verifies the admin's evidence, NOT that an HTTP status was observed.
export async function onRequestPost(ctx){
 if(!protectMutation(ctx.request))return json({error:'Ungültiger Ursprung'},403);
 const u=await viewer(ctx);
 if(!safeAdmin(u))return json({error:'Nicht erlaubt'},403);
 let b;try{b=await ctx.request.json()}catch{return json({error:'Ungültiges JSON'},400)}
 if(!b||typeof b.game_id!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(b.game_id)||
  typeof b.original_url!=='string'||typeof b.note!=='string'||b.note.trim().length<40||
  b.note.length>1200||b.opened_original!==true||b.checked_no_redirect!==true||
  b.checked_live_entry!==true)return json({error:'Original-Link-Nachweis unvollständig'},400);
 const game=await ctx.env.DB.prepare("SELECT id,url,privacy_url,starts_at,ends_at,daily,status FROM games WHERE id=?").bind(b.game_id).first();
 if(!game||!['review','verified'].includes(game.status)||game.ends_at<=new Date().toISOString())
  return json({error:'Gewinnspiel nicht freigabefähig'},409);
 if(!canonicalContestUrl(b.original_url)||canonicalContestUrl(b.original_url)!==canonicalContestUrl(game.url))
  return json({error:'Nur die gespeicherte Original-Teilnahmeadresse darf bestätigt werden'},409);
 const f=await ctx.env.DB.prepare("SELECT checked_at,privacy_url,form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict FROM form_verifications WHERE game_id=?").bind(game.id).first();
 const now=new Date(),[from,until,dayStart]=formReviewWindow(now);
 if(!f||!f.checked_at||f.checked_at<from||f.checked_at>until||
   (game.daily===1&&(game.starts_at>now.toISOString()||f.checked_at<dayStart))||
   f.privacy_url!==game.privacy_url||
   ['form_observed','correct_year','german_residents','no_marketing_required','no_purchase_required','no_account_or_app_obligation','no_unresolved_deadline_conflict'].some(k=>f[k]!==1))
  return json({error:'Aktueller vollständiger Formularnachweis fehlt'},409);
 // Record provenance and state together, without claiming an HTTP 200.
 const note='Manuelle Original-Link-Prüfung durch Admin '+u.id+': '+b.note.trim();
 await ctx.env.DB.batch([
  ctx.env.DB.prepare("INSERT INTO link_checks(game_id,result,http_status,note) VALUES(?,'ok',NULL,?)").bind(game.id,note),
  ctx.env.DB.prepare("UPDATE games SET link_state='ok',last_checked_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(now.toISOString(),game.id)
 ]);
 return json({ok:true,link_confirmed:true,contest_approved:false,reminder_approved:false,method:'manual_original_review'},201);
}

import {json,viewer,protectMutation} from '../../_lib/core.js';
import {safeAdmin} from '../../_lib/contest-review.js';
import {publicContestUrl} from '../../_lib/urls.js';
import {canonicalContestUrl} from '../../_lib/catalog.js';
const yearsInPath=(url)=>[...new URL(url).pathname.matchAll(/(?:^|[^0-9])(?:20[12][0-9])(?=[^0-9]|$)/g)].map(match=>Number(match[0].match(/20[12][0-9]/)[0]));
const fields=['form_observed','correct_year','german_residents','no_marketing_required','no_purchase_required','no_account_or_app_obligation','no_unresolved_deadline_conflict'];
export async function onRequestPost(ctx) {
 if(!protectMutation(ctx.request))return json({error:'Ungültiger Ursprung'},403);
 const admin=await viewer(ctx);if(!safeAdmin(admin))return json({error:'Nicht erlaubt'},403);
 let b;try{b=await ctx.request.json()}catch{return json({error:'Ungültiges JSON'},400)}
 if(!b||typeof b.game_id!=='string'||!fields.every(k=>typeof b[k]==='boolean')||!publicContestUrl(b.form_url)||!publicContestUrl(b.privacy_url)||typeof b.required_fields!=='string'||b.required_fields.trim().length<3||b.required_fields.length>500||typeof b.notes!=='string'||b.notes.trim().length<30||b.notes.length>1500)return json({error:'Live-Formularnachweis ist unvollständig'},400);
 const game=await ctx.env.DB.prepare('SELECT id,url,privacy_url,starts_at,ends_at,status FROM games WHERE id=?').bind(b.game_id).first();
 if(!game||!['review','verified'].includes(game.status)||Date.parse(game.ends_at)<=Date.now())return json({error:'Kein laufender oder bereits freigegebener Prüfkandidat'},409);
 if(canonicalContestUrl(game.privacy_url)!==canonicalContestUrl(b.privacy_url)||new URL(game.url).hostname!==new URL(b.form_url).hostname)return json({error:'Formular oder Datenschutz gehören nicht zum geprüften Veranstalter'},400);
 const sourceYear=Number(game.starts_at.slice(0,4));
 const mentionedYears=yearsInPath(b.form_url);
 if(mentionedYears.length && mentionedYears.some(year=>year!==sourceYear))return json({error:'Formular-URL verweist ausdrücklich auf ein anderes Jahr – keine Freigabe'},409);
 if(fields.some(k=>b[k]!==true))return json({error:'Nicht alle Datenschutz-/Formularbedingungen sind erfüllt; Freigabe verweigert'},409);
 const checked=new Date().toISOString();
 await ctx.env.DB.prepare("INSERT INTO form_verifications(game_id,reviewer_id,checked_at,form_url,privacy_url,required_fields,form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict,notes) VALUES(?,?,?,?,?,?,1,1,1,1,1,1,1,?) ON CONFLICT(game_id) DO UPDATE SET reviewer_id=excluded.reviewer_id,checked_at=excluded.checked_at,form_url=excluded.form_url,privacy_url=excluded.privacy_url,required_fields=excluded.required_fields,form_observed=1,correct_year=1,german_residents=1,no_marketing_required=1,no_purchase_required=1,no_account_or_app_obligation=1,no_unresolved_deadline_conflict=1,notes=excluded.notes")
 .bind(game.id,admin.id,checked,b.form_url,b.privacy_url,b.required_fields.trim(),b.notes.trim()).run();
 return json({ok:true,form_review_recorded:true,contest_approved:false,reminder_approved:false,previously_approved:game.status==='verified'},201);
}

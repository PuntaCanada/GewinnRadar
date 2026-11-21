import {json,viewer} from '../../_lib/core.js';
import {safeAdmin} from '../../_lib/contest-review.js';
import {formReviewWindow} from '../../_lib/publication-gate.js';

const human=['original_checked','terms_checked','privacy_checked','germany_eligible','no_mandatory_marketing','no_payment_required','human_verified'];
const live=['form_observed','correct_year','german_residents','no_marketing_required','no_purchase_required','no_account_or_app_obligation','no_unresolved_deadline_conflict'];
export function readinessReasons(g,now=new Date()){
 const reasons=[];
 const stamp=now.toISOString();
 if(g.status!=='verified')reasons.push('Redaktionelle Freigabe fehlt');
 if(g.starts_at>stamp)reasons.push('Aktion hat noch nicht begonnen');
 if(g.ends_at<=stamp)reasons.push('Teilnahmefrist abgelaufen');
 if(g.link_state!=='ok')reasons.push('Original-Link nicht bestätigt');
 if(!g.verified_at)reasons.push('Freigabezeitpunkt fehlt');
 if(human.some(k=>g['e_'+k]!==1))reasons.push('Sieben manuelle Prüfpunkte unvollständig');
 if(live.some(k=>g['f_'+k]!==1))reasons.push('Sieben Live-Formularprüfungen unvollständig');
 if(!g.f_privacy_url||g.f_privacy_url!==g.privacy_url)reasons.push('Datenschutz-Adresse des Formulars nicht bestätigt');
 const [from,until,dayStart]=formReviewWindow(now);
 if(!g.f_checked_at||g.f_checked_at<from||g.f_checked_at>until)reasons.push('Formularprüfung älter als sieben Tage oder ungültig');
 else if(g.daily===1&&g.f_checked_at<dayStart)reasons.push('Aktuelles Adventstürchen heute noch nicht geprüft');
 return reasons;
}
export async function onRequestGet(ctx){
 const u=await viewer(ctx);
 if(!safeAdmin(u))return json({error:'Nicht erlaubt'},403);
 const selects=['g.id','g.title','g.status','g.link_state','g.starts_at','g.ends_at','g.daily','g.verified_at','g.privacy_url',
 ...human.map(k=>'e.'+k+' AS e_'+k),
 ...live.map(k=>'fv.'+k+' AS f_'+k),
 'fv.checked_at AS f_checked_at','fv.privacy_url AS f_privacy_url'];
 const q='SELECT '+selects.join(',')+' FROM games g LEFT JOIN contest_evidence e ON e.game_id=g.id LEFT JOIN form_verifications fv ON fv.game_id=g.id ORDER BY g.updated_at DESC LIMIT 300';
 const result=await ctx.env.DB.prepare(q).all();
 const now=new Date();
 const contests=(result.results||[]).map(g=>{const reasons=readinessReasons(g,now);return {id:g.id,title:g.title,ready:reasons.length===0,reasons};});
 return json({checked_at:now.toISOString(),ready:contests.filter(x=>x.ready).length,blocked:contests.filter(x=>!x.ready).length,contests});
}

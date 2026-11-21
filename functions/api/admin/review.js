import { json, viewer, protectMutation } from '../../_lib/core.js';
import { validateEvidence, safeAdmin } from '../../_lib/contest-review.js';

export async function onRequestPost(ctx) {
  if (!protectMutation(ctx.request)) return json({ error: 'Ungültiger Ursprung' }, 403);
  const u = await viewer(ctx);
  if (!safeAdmin(u)) return json({ error: 'Nicht erlaubt' }, 403);
  let data;
  try { data = await ctx.request.json(); } catch { return json({ error: 'Ungültiges JSON' }, 400); }
  const checked = validateEvidence(data);
  if (checked.error) return json({ error: checked.error },400);
  const v = checked.value;
  const g = await ctx.env.DB.prepare('SELECT id,url,terms_url,privacy_url,ends_at,status FROM games WHERE id=?').bind(v.id).first();
  if (!g) return json({ error: 'Nicht gefunden' },404);
  if (v.action === 'approve' && (Date.parse(g.ends_at) <= Date.now() || !['review','verified'].includes(g.status)))
    return json({ error: 'Abgelaufenes oder abgelehntes Gewinnspiel nicht freigeben' },409);
  if (v.action === 'approve') {
    const form = await ctx.env.DB.prepare("SELECT form_observed,correct_year,german_residents,no_marketing_required,no_purchase_required,no_account_or_app_obligation,no_unresolved_deadline_conflict,checked_at,form_url,privacy_url FROM form_verifications WHERE game_id=?").bind(v.id).first();
    if(!form || [form.form_observed,form.correct_year,form.german_residents,form.no_marketing_required,form.no_purchase_required,form.no_account_or_app_obligation,form.no_unresolved_deadline_conflict].some(x=>x!==1) || Date.now()-Date.parse(form.checked_at)>7*86400000 || !Number.isFinite(Date.parse(form.checked_at)) || form.privacy_url!==g.privacy_url || new URL(form.form_url).hostname!==new URL(g.url).hostname)
      return json({error:'Aktueller und vollständiger Original-Formularnachweis fehlt – keine Freigabe'},409);
    // Explicit human audit does NOT constitute an HTTP link test. Keep unknown until checker confirms.
    await ctx.env.DB.prepare("INSERT INTO contest_evidence (game_id,reviewer_id,checked_at,note,original_checked,terms_checked,privacy_checked,germany_eligible,no_mandatory_marketing,no_payment_required,human_verified) VALUES (?,?,?,?,1,1,1,1,1,1,1) ON CONFLICT(game_id) DO UPDATE SET reviewer_id=excluded.reviewer_id,checked_at=excluded.checked_at,note=excluded.note,original_checked=1,terms_checked=1,privacy_checked=1,germany_eligible=1,no_mandatory_marketing=1,no_payment_required=1,human_verified=1")
      .bind(v.id,u.id,v.checked_at,v.note).run();
    await ctx.env.DB.prepare("UPDATE games SET status='verified',verified_at=?,verified_by=?,verification_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(v.checked_at,u.id,v.note,v.id).run();
  } else {
    await ctx.env.DB.prepare("UPDATE games SET status=?,verification_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(v.action === 'reject'?'rejected':'review',v.note,v.id).run();
  }
  await ctx.env.DB.prepare('INSERT INTO admin_audit (actor_id,game_id,action,note) VALUES (?,?,?,?)').bind(u.id,v.id,v.action,v.note).run();
  return json({ok:true,status:v.action==='approve'?'verified':v.action==='reject'?'rejected':'review'});
}

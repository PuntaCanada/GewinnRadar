import { json, viewer, protectMutation } from '../../_lib/core.js';
import { safeAdmin, validateContest } from '../../_lib/contest-review.js';

export async function onRequestGet(ctx) {
  const u = await viewer(ctx);
  if (!safeAdmin(u)) return json({ error: 'Nicht erlaubt' }, 403);
  const list = await ctx.env.DB.prepare("SELECT g.*, e.checked_at AS evidence_at, e.note AS evidence_note, e.reviewer_id FROM games g LEFT JOIN contest_evidence e ON e.game_id=g.id ORDER BY g.updated_at DESC LIMIT 300").all();
  return json({ contests: list.results ?? [] });
}

export async function onRequestPost(ctx) {
  if (!protectMutation(ctx.request)) return json({ error: 'Ungültiger Ursprung' }, 403);
  const u = await viewer(ctx);
  if (!safeAdmin(u)) return json({ error: 'Nicht erlaubt' }, 403);
  let body;
  try { body = await ctx.request.json(); } catch { return json({ error: 'Ungültiges JSON' }, 400); }
  const checked = validateContest(body);
  if (checked.error) return json({ error: checked.error }, 400);
  const g = checked.value;
  try {
    await ctx.env.DB.prepare("INSERT INTO games (id,organizer,title,prize,url,terms_url,privacy_url,starts_at,ends_at,daily,status,required_data,solution,link_state) VALUES (?,?,?,?,?,?,?,?,?,?,'review',?,?,'unknown')")
      .bind(g.id,g.organizer,g.title,g.prize,g.url,g.terms_url,g.privacy_url,g.starts_at,g.ends_at,g.daily,g.required_data,g.solution).run();
  } catch {
    return json({ error: 'ID bereits vorhanden oder Datenbankfehler' }, 409);
  }
  return json({ ok:true, status:'review', id:g.id },201);
}

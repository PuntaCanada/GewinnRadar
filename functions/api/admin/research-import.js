import {json,viewer,protectMutation} from '../../_lib/core.js';
import {safeAdmin} from '../../_lib/contest-review.js';
import {auditResearch,canonicalContestUrl,catalogKey} from '../../_lib/catalog.js';

const SQL="INSERT OR IGNORE INTO research_candidates(id,year,canonical_key,organizer,title,prize,url,terms_url,source_url,starts_on,ends_on,cadence,eligible_dates,required_data,privacy_tier,review_note,research_state) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
function bindRow(db,e){
 return db.prepare(SQL).bind(e.id,e.year,catalogKey(e),e.organizer,e.title,e.prize,e.url,e.terms_url,e.source_url,e.starts_on,e.ends_on,e.cadence,e.eligible_dates?JSON.stringify(e.eligible_dates):null,e.required_data,e.privacy_tier,e.review_note,e.state);
}
export async function onRequestGet(ctx){
 const user=await viewer(ctx);if(!safeAdmin(user))return json({error:'Nicht erlaubt'},403);
 const rows=await ctx.env.DB.prepare('SELECT id,organizer,title,prize,url,terms_url,starts_on,ends_on,cadence,eligible_dates,required_data,privacy_tier,review_note,research_state,updated_at FROM research_candidates ORDER BY research_state,starts_on,organizer LIMIT 500').all();
 return json({entries:rows.results||[],publicly_visible:0});
}
export async function onRequestPost(ctx){
 if(!protectMutation(ctx.request))return json({error:'Ungültiger Ursprung'},403);
 const user=await viewer(ctx);if(!safeAdmin(user))return json({error:'Nicht erlaubt'},403);
 const bytes=Number(ctx.request.headers.get('content-length')||0);
 if(bytes>200000)return json({error:'Datei zu groß'},413);
 let body;try{body=await ctx.request.json()}catch{return json({error:'Ungültiges JSON'},400)}
 if(!body||!Array.isArray(body.entries)||body.entries.length>100)return json({error:'Maximal 100 Einträge'},400);
 const audit=auditResearch(body.entries);
 if(!audit.ok)return json({error:'Katalogprüfung gescheitert',details:audit.errors.slice(0,20)},400);
 // Preview by default. Only an explicit admin gesture can import research rows.
 if(body.commit!==true)return json({ok:true,dry_run:true,...audit,publicly_visible:0});
 const statements=body.entries.map(e=>bindRow(ctx.env.DB,e));
 // D1.batch executes in one transaction and ensures research never becomes public.
 try{
  const results=await ctx.env.DB.batch(statements);
  const accepted=results.reduce((n,r)=>n+Number(r.meta?.changes||0),0);
  const duplicates=body.entries.length-accepted;
  await ctx.env.DB.prepare("INSERT INTO research_import_log(actor_id,accepted,duplicates,excluded,note) VALUES(?,?,?,?,?)").bind(user.id,accepted,duplicates,audit.excluded,'Manual research staging; never published or approved').run();
  return json({ok:true,accepted,duplicates,excluded:audit.excluded,publicly_visible:0});
 }catch{ return json({error:'Rechercheimport fehlgeschlagen, keine Freigabe erfolgt'},409) }
}

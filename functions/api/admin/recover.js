import {json,hash,randomToken,protectMutation} from '../../_lib/core.js';
import {emailAddress} from '../../_lib/login-safety.js';

// Explicit owner-driven recovery of an EXISTING unverified admin only.
// This endpoint NEVER creates accounts, changes email addresses or sends mail.
// It intentionally cannot use ADMIN_BOOTSTRAP_ENABLED.
export async function onRequestPost(ctx){
 if(!protectMutation(ctx.request))return json({error:'Nicht erlaubt'},403);
 const env=ctx.env||{};
 const email=emailAddress(env.ADMIN_BOOTSTRAP_EMAIL);
 const secret=env.ADMIN_BOOTSTRAP_SECRET;
 if(env.ADMIN_RECOVERY_ENABLED!=='true'||env.ADMIN_BOOTSTRAP_ENABLED!=='false'||
  env.LOGIN_MAIL_ENABLED!=='false'||!email||typeof secret!=='string'||
  !/^[0-9a-f]{64}$/.test(secret)||!env.DB?.batch)
  return json({error:'Admin-Wiederherstellung deaktiviert'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(ctx.request.headers.get('content-type')||''))
  return json({error:'Ungültige Anfrage'},400);
 let body;try{body=await ctx.request.json()}catch{return json({error:'Ungültige Anfrage'},400)}
 const input=body?.recovery_secret;
 if(typeof input!=='string'||!/^[0-9a-f]{64}$/.test(input))return json({error:'Nicht erlaubt'},403);
 const expected=await hash(secret),actual=await hash(input);
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
 if(diff!==0)return json({error:'Nicht erlaubt'},403);
 let admin;
 try{
  const inventory=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").bind().first();
  if(Number(inventory?.n)!==1)return json({error:'Kontobestand nicht eindeutig'},409);
  admin=await env.DB.prepare("SELECT id,role,email_verified FROM users WHERE role='admin' AND email=? COLLATE NOCASE").bind(email).first();
  if(!admin||admin.role!=='admin'||admin.email_verified!==0)return json({error:'Kontozuordnung nicht bestätigt'},409);
  const state=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM admin_bootstrap) AS used,(SELECT COUNT(*) FROM sessions WHERE user_id=?) AS sessions,(SELECT COUNT(*) FROM login_tokens WHERE user_id=?) AS tokens").bind(admin.id,admin.id).first();
  if(Number(state?.used)!==0||Number(state.sessions)!==0||Number(state.tokens)!==0)
   return json({error:'Vorhandene Sitzungen, Token oder bereits verbrauchte Wiederherstellung'},409);
 }catch{return json({error:'Wiederherstellung nicht verfügbar: D1-Struktur prüfen'},503)}
 const claim=randomToken(),token=randomToken(),now=new Date().toISOString();
 const expiry=new Date(Date.now()+30*86400000).toISOString();
 try{
  // D1.batch rolls back on SQL errors, NOT on successful zero-row writes.
  // The final guard deliberately raises a SQLite error if a preceding
  // conditional write was skipped; this prevents committing a partial claim.
  const changes=await env.DB.batch([
   // Claim first: even if another actor changed the account between our
   // read and the batch, no unclaimed email verification can take place.
   env.DB.prepare("INSERT INTO admin_bootstrap(slot,admin_id,claim_id,used_at) SELECT 1,?,?,? WHERE (SELECT COUNT(*) FROM users WHERE role='admin')=1 AND EXISTS(SELECT 1 FROM users WHERE id=? AND email=? COLLATE NOCASE AND role='admin' AND email_verified=0) AND NOT EXISTS(SELECT 1 FROM admin_bootstrap) AND NOT EXISTS(SELECT 1 FROM sessions WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM login_tokens WHERE user_id=?)").bind(admin.id,claim,now,admin.id,email,admin.id,admin.id),
   env.DB.prepare("UPDATE users SET email_verified=1 WHERE id=? AND email=? COLLATE NOCASE AND role='admin' AND email_verified=0 AND EXISTS(SELECT 1 FROM admin_bootstrap WHERE slot=1 AND admin_id=? AND claim_id=?)").bind(admin.id,email,admin.id,claim),
   env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,admin_id,? FROM admin_bootstrap WHERE slot=1 AND admin_id=? AND claim_id=?").bind(await hash(token),expiry,admin.id,claim),
   // SQLite evaluates only the chosen CASE arm. Invalid JSON forces an
   // exception/rollback if *any* expected postcondition is absent.
   env.DB.prepare("SELECT CASE WHEN (SELECT COUNT(*) FROM admin_bootstrap WHERE slot=1 AND admin_id=? AND claim_id=?)=1 AND (SELECT COUNT(*) FROM users WHERE role='admin')=1 AND (SELECT COUNT(*) FROM users WHERE id=? AND email=? COLLATE NOCASE AND role='admin' AND email_verified=1)=1 AND (SELECT COUNT(*) FROM sessions WHERE user_id=? AND token_hash=?)=1 AND (SELECT COUNT(*) FROM sessions WHERE user_id=?)=1 AND (SELECT COUNT(*) FROM login_tokens WHERE user_id=?)=0 THEN 1 ELSE json_extract('invalid-json','
  if(changes.length!==4||changes.slice(0,3).some(x=>Number(x.meta?.changes)!==1))
   return json({error:'Wiederherstellung bereits verwendet oder Zustand geändert'},409);
 }catch{return json({error:'Wiederherstellung abgebrochen: D1-Prüfung fehlgeschlagen'},503)}
 return new Response(JSON.stringify({ok:true,recovered_existing_admin:true,mail_sent:false}),{
  status:201,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store, private',
   'referrer-policy':'no-referrer',
   'x-content-type-options':'nosniff',
   'set-cookie':`gr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
  }
 });
}
) END AS verified").bind(admin.id,claim,admin.id,email,admin.id,await hash(token),admin.id,admin.id)
  ]);
  if(changes.length!==3||changes.some(x=>Number(x.meta?.changes)!==1))
   return json({error:'Wiederherstellung bereits verwendet oder Zustand geändert'},409);
 }catch{return json({error:'Wiederherstellung abgebrochen: D1-Prüfung fehlgeschlagen'},503)}
 return new Response(JSON.stringify({ok:true,recovered_existing_admin:true,mail_sent:false}),{
  status:201,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store, private',
   'referrer-policy':'no-referrer',
   'x-content-type-options':'nosniff',
   'set-cookie':`gr_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
  }
 });
}

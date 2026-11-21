import {json,hash,randomToken,protectMutation} from '../../_lib/core.js';
import {emailAddress} from '../../_lib/login-safety.js';

// Locked by default. Only the deployment owner can enable this by supplying
// all three Cloudflare production variables. No secret or address is in git.
// Requires migration 0006 and an empty first-admin slot.
function config(env){
 const email=emailAddress(env?.ADMIN_BOOTSTRAP_EMAIL);
 const secret=env?.ADMIN_BOOTSTRAP_SECRET;
 if(env?.ADMIN_BOOTSTRAP_ENABLED!=='true'||env?.LOGIN_MAIL_ENABLED==='true'||
  !email||typeof secret!=='string'||!/^[0-9a-f]{64}$/.test(secret))return null;
 return {email,secret};
}
function equalDigest(a,b){
 if(a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export async function onRequestPost(ctx){
 if(!protectMutation(ctx.request))return json({error:'Nicht erlaubt'},403);
 const cfg=config(ctx.env);
 if(!cfg||!ctx.env?.DB?.batch)return json({error:'Ersteinrichtung nicht freigeschaltet'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(ctx.request.headers.get('content-type')||''))
  return json({error:'Ungültige Anfrage'},400);
 let data;try{data=await ctx.request.json()}catch{return json({error:'Ungültige Anfrage'},400)}
 const supplied=data?.setup_secret;
 if(typeof supplied!=='string'||!/^[0-9a-f]{64}$/.test(supplied))return json({error:'Nicht erlaubt'},403);
 if(!equalDigest(await hash(supplied),await hash(cfg.secret)))return json({error:'Nicht erlaubt'},403);
 const adminId='admin-'+randomToken().slice(0,32),claim=randomToken();
 const session=randomToken(),now=new Date().toISOString(),expiry=new Date(Date.now()+30*86400000).toISOString();
 try{
  // D1.batch is atomic. A second concurrent claimant cannot create another
  // admin or session, even with the right setup secret.
  const results=await ctx.env.DB.batch([
   ctx.env.DB.prepare("INSERT INTO users(id,email,display_name,role,email_verified,daily_email) SELECT ?,?,'Redaktion','admin',1,0 WHERE NOT EXISTS(SELECT 1 FROM admin_bootstrap) AND NOT EXISTS(SELECT 1 FROM users WHERE role='admin') AND NOT EXISTS(SELECT 1 FROM users WHERE email=? COLLATE NOCASE)").bind(adminId,cfg.email,cfg.email),
   ctx.env.DB.prepare("INSERT INTO admin_bootstrap(slot,admin_id,claim_id,used_at) SELECT 1,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND role='admin') AND NOT EXISTS(SELECT 1 FROM admin_bootstrap)").bind(adminId,claim,now,adminId),
   ctx.env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,admin_id,? FROM admin_bootstrap WHERE slot=1 AND admin_id=? AND claim_id=?").bind(await hash(session),expiry,adminId,claim)
  ]);
  if(results.length!==3||results.some(r=>Number(r.meta?.changes)!==1))
   return json({error:'Ersteinrichtung bereits verwendet oder Konto vorhanden'},409);
 }catch{
  return json({error:'Ersteinrichtung nicht möglich: D1-Migration oder Konfiguration prüfen'},503);
 }
 return new Response(JSON.stringify({ok:true,admin_ready:true,mail_sent:false}),{
  status:201,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store, private','x-content-type-options':'nosniff',
   'referrer-policy':'no-referrer',
   'set-cookie':`gr_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
  }
 });
}

import {json,protectMutation} from '../_lib/core.js';

// Explicitly disabled until D1 migration 0007 + Turnstile are approved and configured.
// Nothing about this endpoint creates, disables, or changes an administrator.
const kinds=new Set(['suspected_fraud','broken_link','terms_or_privacy','request_review']);
function enabled(env){
 return env?.PUBLIC_REPORTS_ENABLED==='true'&&typeof env.PUBLIC_REPORTS_TURNSTILE_SITE_KEY==='string'&&
 /^[a-zA-Z0-9_-]{8,150}$/.test(env.PUBLIC_REPORTS_TURNSTILE_SITE_KEY)&&
 typeof env.PUBLIC_REPORTS_TURNSTILE_SECRET==='string'&&env.PUBLIC_REPORTS_TURNSTILE_SECRET.length>=8&&
 typeof env.DB?.prepare==='function';
}
export async function onRequestGet({env}){
 return json({enabled:enabled(env),site_key:enabled(env)?env.PUBLIC_REPORTS_TURNSTILE_SITE_KEY:null},200);
}
export async function onRequestPost(ctx){
 const {env,request}=ctx;
 if(!enabled(env))return json({error:'Meldungen sind noch nicht aktiviert'},403);
 if(!protectMutation(request))return json({error:'Ungültige Herkunft'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
  return json({error:'JSON erforderlich'},415);
 if(Number(request.headers.get('content-length')||0)>2500)return json({error:'Zu große Anfrage'},413);
 let body;
 try{body=await request.json()}catch{return json({error:'Ungültige Anfrage'},400)}
 const contest=body?.contest_id,kind=body?.kind,details=body?.details,token=body?.turnstile_token;
 if(typeof contest!=='string'||!/^[a-z0-9][a-z0-9-]{2,99}$/.test(contest)||
 !kinds.has(kind)||typeof details!=='string'||details.trim().length<15||details.length>600||
 typeof token!=='string'||token.length<10||token.length>2048)
  return json({error:'Bitte Meldung und Sicherheitsprüfung vollständig ausfüllen'},400);
 // Do not accept secrets, emails, links, or control characters in the free-text report.
 if(/@[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/|[\u0000-\u001f\u007f]/i.test(details))
  return json({error:'Bitte keine E-Mail-Adressen, Links oder privaten Daten im Meldungstext angeben'},400);
 let verified;
 try{
  const req=new URLSearchParams({secret:env.PUBLIC_REPORTS_TURNSTILE_SECRET,response:token});
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',body:req,signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Turnstile unavailable');
  verified=await response.json();
 }catch{return json({error:'Sicherheitsprüfung derzeit nicht verfügbar'},503)}
 if(verified?.success!==true||verified.hostname!==new URL(request.url).hostname||
    verified.action!=='gewinnradar_report')
  return json({error:'Sicherheitsprüfung ungültig'},403);
 // Temporary IP-less abuse limits; no visitor identity, CAPTCHA token, or IP stored.
 try{
  const since=new Date(Date.now()-60*60000).toISOString();
  const global=await env.DB.prepare('SELECT COUNT(*) AS n FROM public_contest_reports WHERE submitted_at>?').bind(since).first();
  const target=await env.DB.prepare('SELECT COUNT(*) AS n FROM public_contest_reports WHERE contest_id=? AND submitted_at>?').bind(contest,since).first();
  if(Number(global?.n)>=150||Number(target?.n)>=20)return json({error:'Zu viele Meldungen. Bitte später erneut versuchen'},429);
  const id=crypto.randomUUID();
  const now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO public_contest_reports (id,contest_id,kind,details,submitted_at) VALUES(?,?,?,?,?)')
   .bind(id,contest,kind,details.trim(),now).run();
  return json({ok:true,message:'Meldung eingegangen. Sie wird geprüft, nicht automatisch als Betrug gewertet.'},201);
 }catch{return json({error:'Meldung derzeit nicht verfügbar'},503)}
}

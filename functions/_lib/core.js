import {publicContestUrl} from './urls.js';
const te = new TextEncoder();
export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
export async function hash(input){const a=await crypto.subtle.digest('SHA-256',te.encode(input));return Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('')}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')}
export function cookies(request){
 const raw=request.headers.get('cookie')||'';
 if(raw.length>8192)return {};
 const result={};
 for(const part of raw.split(';')){
  const idx=part.indexOf('=');
  if(idx<1)continue;
  const name=part.slice(0,idx).trim();
  if(!/^[a-z_]{1,40}$/.test(name))continue;
  try{result[name]=decodeURIComponent(part.slice(idx+1).trim())}catch{/* malformed cookies cannot crash authentication */}
 }
 return result;
}
export async function viewer(ctx){const token=cookies(ctx.request).gr_session;if(!token||!/^[0-9a-f]{64}$/.test(token))return null;return await ctx.env.DB.prepare(`SELECT u.id,u.email,u.display_name,u.role,u.senior_mode,u.daily_email,u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > ?`).bind(await hash(token),new Date().toISOString()).first()}
export function protectMutation(request){const origin=request.headers.get('origin');return Boolean(origin&&origin===new URL(request.url).origin)}
export function dayKey(date=new Date(),zone='Europe/Berlin'){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function validHttps(url){return publicContestUrl(url)}
export async function sendBrevo(env,to,subject,text){if(!env.BREVO_API_KEY||!env.SENDER_EMAIL)throw Error('Email service not configured');let res=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify({sender:{email:env.SENDER_EMAIL,name:'GewinnRadar'},to:[{email:to}],subject,textContent:text})});if(!res.ok)throw Error('Mail provider returned HTTP '+res.status);return await res.json()}
export function escapeText(s){return String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,1000)}

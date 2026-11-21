import {hash} from './core.js';

export const LOGIN_RESPONSE = 'Falls ein freigeschaltetes Konto existiert, wurde ein Link versendet.';
export function emailAddress(value) {
  if (typeof value !== 'string') return null;
  const email=value.trim().toLowerCase();
  if (email.length > 254 || email.length < 5 || !/^[^\s@]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return null;
  return email;
}
export function loginAllowed(env) {
  return env?.LOGIN_MAIL_ENABLED === 'true' && typeof env?.LOGIN_RATE_SALT === 'string' && env.LOGIN_RATE_SALT.length >= 32
    && !!env.BREVO_API_KEY && !!env.SENDER_EMAIL && !!env.DB;
}
export async function requestFingerprint(request,salt) {
  // CF-Connecting-IP is set by the trusted Cloudflare edge for deployed Pages Functions.
  const ip=request.headers.get('CF-Connecting-IP') || 'unknown';
  return hash(salt+':ip:'+ip.slice(0,75));
}
export async function incrementLimit(db,key,bucket,maximum) {
  const result=await db.prepare("INSERT INTO login_limits (key_hash,bucket,count) VALUES (?,?,1) ON CONFLICT(key_hash,bucket) DO UPDATE SET count=count+1 RETURNING count").bind(key,bucket).first();
  return Boolean(result && result.count <= maximum);
}
export function loginBucket(date=new Date()) { return date.toISOString().slice(0,13); }

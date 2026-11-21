import {hash,randomToken,protectMutation} from '../_lib/core.js';

const validToken = token => typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);
const invalid = ctx => Response.redirect(new URL('/?login=invalid',ctx.request.url),303);

// Mail link prefetchers may visit GET URLs. GET never consumes a token or creates a session.
export async function onRequestGet(ctx) {
  const token=new URL(ctx.request.url).searchParams.get('token');
  if (!validToken(token)) return invalid(ctx);
  const headers={
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store, private',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'x-frame-options':'DENY'
  };
  // The token is a strict lowercase hexadecimal string and is safe as a form value.
  return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GewinnRadar – Anmeldung bestätigen</title><main><h1>GewinnRadar ❤️</h1><p>Bestätige deine Anmeldung. Dieser Link ist nur einmal und höchstens 15 Minuten gültig.</p><form action="/api/verify" method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Jetzt sicher anmelden</button></form><p>Falls du die Anmeldung nicht angefordert hast, schließe diese Seite.</p></main></html>`,{status:200,headers});
}

// The one-time token is consumed only by explicit same-origin form submission.
export async function onRequestPost(ctx) {
  if (!protectMutation(ctx.request)) return invalid(ctx);
  const contentType=ctx.request.headers.get('content-type')||'';
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)) return invalid(ctx);
  let token;
  try { token=(await ctx.request.formData()).get('token'); }
  catch { return invalid(ctx); }
  if (!validToken(token)) return invalid(ctx);
  const h=await hash(token), now=new Date().toISOString();
  const row=await ctx.env.DB.prepare('SELECT user_id FROM login_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(h,now).first();
  if (!row) return invalid(ctx);
  const changed=await ctx.env.DB.prepare('UPDATE login_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(now,h,now).run();
  if (changed.meta.changes!==1) return invalid(ctx);
  await ctx.env.DB.prepare('UPDATE users SET email_verified=1 WHERE id=?').bind(row.user_id).run();
  const session=randomToken();
  await ctx.env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(session),row.user_id,new Date(Date.now()+30*86400*1000).toISOString()).run();
  return new Response(null,{status:303,headers:{
    location:'/',
    'set-cookie':`gr_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    'referrer-policy':'no-referrer','cache-control':'no-store'
  }});
}

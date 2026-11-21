import {json,hash,randomToken,protectMutation,sendBrevo} from '../_lib/core.js';
import {LOGIN_RESPONSE,emailAddress,loginAllowed,requestFingerprint,incrementLimit,loginBucket} from '../_lib/login-safety.js';

export async function onRequestPost(ctx) {
  if(!protectMutation(ctx.request)) return json({error:'Ungültiger Ursprung'},403);
  if(!loginAllowed(ctx.env)) return json({error:'Der Familien-Login ist noch nicht freigeschaltet.'},503);
  let body;
  try { body=await ctx.request.json(); } catch { return json({error:'Ungültige Anfrage'},400); }
  const email=emailAddress(body?.email);
  if(!email) return json({error:'Bitte gültige E-Mail eingeben'},400);
  const hour=loginBucket();
  const ipHash=await requestFingerprint(ctx.request,ctx.env.LOGIN_RATE_SALT);
  const mailHash=await hash(ctx.env.LOGIN_RATE_SALT+':email:'+email);
  const ipAllowed=await incrementLimit(ctx.env.DB,ipHash,hour,12);
  const emailAllowed=await incrementLimit(ctx.env.DB,mailHash,hour,3);
  if(!ipAllowed || !emailAllowed) return json({ok:true,message:LOGIN_RESPONSE});
  const user=await ctx.env.DB.prepare('SELECT id,email FROM users WHERE email=?').bind(email).first();
  if(!user) return json({ok:true,message:LOGIN_RESPONSE});
  const token=randomToken();
  const expiry=new Date(Date.now()+15*60*1000).toISOString();
  await ctx.env.DB.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(token),user.id,expiry).run();
  try {
    await sendBrevo(ctx.env,user.email,'Dein Anmeldelink – GewinnRadar',
      'Hallo!\n\nHier ist dein einmaliger Anmeldelink (15 Minuten gültig):\n'
      +new URL('/api/verify?token='+token,ctx.request.url)
      +'\n\nFalls du keinen Link angefordert hast, ignoriere die Nachricht.');
  } catch {
    await ctx.env.DB.prepare('DELETE FROM login_tokens WHERE token_hash=?').bind(await hash(token)).run();
    console.error('Login mail failed');
  }
  return json({ok:true,message:LOGIN_RESPONSE});
}

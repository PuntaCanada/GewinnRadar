import {json,hash,randomToken,protectMutation,sendBrevo} from '../_lib/core.js';

// Separate path from the ordinary family login. Never enables general email login.
const refused=()=>json({error:'Einmaliger Admin-Test nicht verfügbar.'},503);
const fixedMatch=async(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string'||a.length<32||b.length<32||a.length>256||b.length>256)return false;
  const left=await hash(a),right=await hash(b);
  let diff=0;
  for(let i=0;i<64;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
};

export async function onRequestPost(ctx) {
  const {request,env}=ctx;
  if(!protectMutation(request))return refused();
  // An explicit, short-lived and separate opt-in is required; broad login must stay OFF.
  if(!env?.DB||env.LOGIN_MAIL_ENABLED!=='false'||env.ADMIN_MAGIC_LINK_TEST_ENABLED!=='true'||
     !env.BREVO_API_KEY||!env.SENDER_EMAIL||
     typeof env.LOGIN_RATE_SALT!=='string'||env.LOGIN_RATE_SALT.length<32)return refused();
  const deadline=env.ADMIN_MAGIC_LINK_TEST_EXPIRES_AT;
  const expires=typeof deadline==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(deadline)?Date.parse(deadline):NaN;
  const now=Date.now();
  if(!Number.isFinite(expires)||expires<=now||expires-now>24*60*60*1000)return refused();
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/x-www-form-urlencoded'))return refused();
  let code;
  try {code=(await request.formData()).get('code')}catch{return refused()}
  if(!await fixedMatch(code,env.ADMIN_MAGIC_LINK_TEST_CODE))return refused();

  // Do not send to another role or ambiguous administrator selection.
  const admins=await env.DB.prepare("SELECT id,email FROM users WHERE role='admin' LIMIT 2").all();
  if(admins.results?.length!==1)return refused();
  const admin=admins.results[0];
  // Fixed key + bucket ensure exactly one claim even under concurrent requests or redeploys.
  const key=await hash('gewinnradar:one-admin-mail-test:v1');
  const claim=await env.DB.prepare("INSERT OR IGNORE INTO login_limits(key_hash,bucket,count) VALUES(?,'single-admin-mail-test',1)").bind(key).run();
  if(claim.meta?.changes!==1)return refused();

  // Permanently consume the test allowance before any provider call. Fail closed on errors.
  const token=randomToken();
  const tokenHash=await hash(token);
  await env.DB.prepare('INSERT INTO login_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .bind(tokenHash,admin.id,new Date(Date.now()+15*60*1000).toISOString()).run();
  try {
    await sendBrevo(env,admin.email,'Dein einmaliger GewinnRadar-Admin-Anmeldelink',
      'Hallo!\n\nDein einmaliger Anmeldelink (15 Minuten gültig):\n'+
      new URL('/api/verify?token='+token,request.url)+
      '\n\nBitte die Anmeldung auf der Bestätigungsseite selbst bestätigen. Falls nicht angefordert: ignorieren.');
  } catch {
    await env.DB.prepare('DELETE FROM login_tokens WHERE token_hash=?').bind(tokenHash).run();
    return json({error:'Testversand fehlgeschlagen; einmalige Freigabe bleibt verbraucht.'},502);
  }
  return json({ok:true,message:'Einmaliger Admin-Testversand wurde beim Anbieter angefordert.'});
}

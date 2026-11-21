import {publicContestUrl} from '../functions/_lib/urls.js';
// No sending until MAIL_ENABLED=true is explicitly configured in a separately deployed worker.
const berlin=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const berlinHour=(date=new Date())=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'}).format(date));
const validUrl=publicContestUrl;
const nowISO=()=>new Date().toISOString();
// Untrusted URLs may resolve to private IPs even when their text looks public.
// Do not make outbound HTTP requests until an operator has explicitly enabled
// checking AND independently allowlisted each expected original hostname.
const checkTarget=(url,env)=>{
 if(env.LINK_CHECK_ENABLED!=='true')return false;
 if(!validUrl(url))return false;
 const names=String(env.LINK_CHECK_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const host=new URL(url).hostname.toLowerCase().replace(/\.$/,'');
 return names.includes(host) && names.length>0;
};
async function checkGames(env){
 const now=nowISO();
 await env.DB.prepare("UPDATE games SET status='ended',updated_at=? WHERE status IN ('verified','review') AND ends_at<=?").bind(now,now).run();
 if(env.LINK_CHECK_ENABLED!=='true')return {skipped:'disabled'};
 const games=(await env.DB.prepare("SELECT id,url FROM games WHERE status='verified' AND ends_at>? ORDER BY COALESCE(last_checked_at,'') ASC LIMIT 80").bind(now).all()).results||[];
 for(const g of games){
  let state='review',code=null,note='';
  if(!validUrl(g.url)){state='broken';note='Invalid URL'}
  else if(!checkTarget(g.url,env)){state='review';note='Host not explicitly allowlisted'}
  else try{
   const res=await fetch(g.url,{method:'GET',redirect:'manual',headers:{'user-agent':'GewinnRadar-LinkCheck/0.2 (+manual-review-required)'},signal:AbortSignal.timeout(9000)});
   code=res.status;res.body?.cancel();
   if(code>=200&&code<300)state='ok';
   else if(code>=300&&code<400){state='redirect';note='Redirect requires manual review'}
   else if([401,403,429].includes(code)){state='blocked';note='Access restricted; not a dead link'}
   else if(code===404||code===410){state='broken';note='Original page no longer found'}
   else {state='review';note='HTTP status needs review'}
  }catch(e){state='review';note='Network failure; manual review'}
  await env.DB.prepare('INSERT INTO link_checks(game_id,result,http_status,note) VALUES(?,?,?,?)').bind(g.id,state,code,note).run();
  await env.DB.prepare('UPDATE games SET link_state=?,last_checked_at=? WHERE id=?').bind(state,nowISO(),g.id).run();
 }
}
async function sendDigest(env){
 if(env.MAIL_ENABLED!=='true')return {skipped:'disabled'};
 if(!env.BREVO_API_KEY||!env.SENDER_EMAIL||!env.PUBLIC_BASE_URL)throw Error('Missing mail configuration');
 const today=berlin(),now=nowISO();
 const users=(await env.DB.prepare('SELECT id,email,display_name FROM users WHERE daily_email=1 AND email_verified=1 AND consent_at IS NOT NULL').all()).results||[];
 let sent=0;
 for(const u of users){
  const games=(await env.DB.prepare("SELECT g.title,g.organizer,g.prize,g.url,g.ends_at FROM favorites f JOIN games g ON g.id=f.game_id LEFT JOIN participations p ON p.user_id=f.user_id AND p.game_id=f.game_id AND p.day=CASE WHEN g.daily=1 THEN ? ELSE 'once' END WHERE f.user_id=? AND p.user_id IS NULL AND g.status='verified' AND g.link_state='ok' AND g.starts_at<=? AND g.ends_at>? ORDER BY g.ends_at LIMIT 100").bind(today,u.id,now,now).all()).results||[];
  if(!games.length)continue;
  const claim=await env.DB.prepare("INSERT OR IGNORE INTO email_log(user_id,day,status) VALUES(?,?,'sending')").bind(u.id,today).run();
  if(!claim.meta?.changes)continue;
  const lines=games.map((g,i)=>(i+1)+'. '+g.title+' – '+g.organizer+'\nGewinn: '+g.prize+'\nEnde: '+g.ends_at+'\n'+g.url).join('\n\n');
  const content='Guten Morgen, '+u.display_name+'! 🍀\n\nHier sind deine '+games.length+' heute noch offenen gemerkten Gewinnspiele:\n\n'+lines+'\n\nDeine Häkchen: '+env.PUBLIC_BASE_URL+'\n\nErinnerungen ausschalten: Melde dich an und deaktiviere „Tägliche Erinnerungs-E-Mail“.\n\nKeine Werbung. Keine automatische Teilnahme.';
  try{
   const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json'},body:JSON.stringify({sender:{email:env.SENDER_EMAIL,name:'GewinnRadar'},to:[{email:u.email}],subject:'Deine Gewinnspiele für heute 🍀',textContent:content})});
   if(!response.ok)throw Error('Brevo HTTP '+response.status);
   const result=await response.json();
   await env.DB.prepare("UPDATE email_log SET status='sent',message_id=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND day=?").bind(result.messageId||null,u.id,today).run();sent++;
  }catch(e){console.error('Digest failed',u.id,e.message);await env.DB.prepare("UPDATE email_log SET status='failed',updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND day=?").bind(u.id,today).run()}
 }
 return {sent};
}
export default {async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await checkGames(env);if(berlinHour()===8)await sendDigest(env)})())}};
export {berlin,berlinHour,validUrl,checkTarget,checkGames};

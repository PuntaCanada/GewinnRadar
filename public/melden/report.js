const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const contest=params.get('id')||'';
const valid=/^[a-z0-9][a-z0-9-]{2,99}$/.test(contest);
const fallback=$('githubReport');
if(valid)fallback.href='https://github.com/PuntaCanada/GewinnRadar/issues/new?template=gewinnspiel-melden.yml&title='+encodeURIComponent('Meldung: '+contest);
let captcha='';
function loadCaptcha(siteKey){
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 script.async=true;script.onload=()=>{
  if(!window.turnstile){$('reportStatus').textContent='Sicherheitsprüfung konnte nicht geladen werden.';return;}
  window.turnstile.render('#reportChallenge',{sitekey:siteKey,action:'gewinnradar_report',
    callback:token=>{captcha=token;$('reportSubmit').disabled=false},
    'expired-callback':()=>{captcha='';$('reportSubmit').disabled=true},
    'error-callback':()=>{captcha='';$('reportSubmit').disabled=true}});
 };script.onerror=()=>{$('reportStatus').textContent='Sicherheitsprüfung konnte nicht geladen werden.'};document.head.append(script);
}
async function init(){
 if(!valid){$('reportStatus').textContent='Bitte zuerst ein Gewinnspiel aus dem Katalog auswählen.';return}
 try{
  const r=await fetch('/api/public-reports',{cache:'no-store'});
  if(!r.ok)throw Error();
  const d=await r.json();
  if(d.enabled!==true||typeof d.site_key!=='string'){$('reportStatus').textContent='Direkte Meldungen sind derzeit deaktiviert. Bitte vorerst GitHub benutzen.';return}
  $('reportStatus').textContent='Meldung für Gewinnspiel-ID: '+contest;
  $('reportForm').hidden=false;loadCaptcha(d.site_key);
 }catch{$('reportStatus').textContent='Direkte Meldungen sind derzeit nicht verfügbar. Bitte vorerst GitHub benutzen.'}
}
$('reportForm').onsubmit=async event=>{
 event.preventDefault();if(!valid||!captcha)return;
 $('reportSubmit').disabled=true;$('reportResult').textContent='Meldung wird gesichert …';
 try{
  const res=await fetch('/api/public-reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
   contest_id:contest,kind:$('reportKind').value,details:$('reportDetails').value,turnstile_token:captcha})});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Nicht gespeichert');
  $('reportResult').textContent=data.message;$('reportDetails').value='';$('reportForm').hidden=true;
 }catch(e){$('reportResult').textContent=e.message;captcha='';window.turnstile?.reset?.('#reportChallenge')}
};
init();

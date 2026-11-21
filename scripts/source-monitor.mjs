import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {canonicalContestUrl,auditResearch} from '../functions/_lib/catalog.js';
const catalog=JSON.parse(readFileSync(new URL('../catalog/research-2026.json',import.meta.url),'utf8'));
const audit=auditResearch(catalog.entries);
if(!audit.ok)throw new Error('Catalog validation failed: '+audit.errors.join('; '));
// Explicitly reviewed source hosts only. Unlisted input is never fetched.
const ALLOWED=new Set([
 'www.agravis.de','www1.wdr.de','www.aldiventskalender.de','www.pilotpen.de',
 'www.abendzeitung-muenchen.de','www.diestadtgaertner.de','ahoi-leipzig.de',
 'www.adac.de','advent.supernurse.de','openexperience.de','adventskalender.bsw.de',
 'www.infra-fuerth.de','hager.com','www.mueller.de','www.daddyhero.de',
 'tal-studio.de','fitseveneleven.de','pld24.de','www.pluspunkt-apotheke.de',
 'de.babor.com','de.handicraft.com',
 'adventskalender.sueddeutsche.de','www.mdr.de','filiale.kaufland.de','games.focus.de',
 'diekreidefarbe.de','www.magdochjeder.de','www.pincamp.de','www.wirliebenbau.de',
 'www.hairloft-loxstedt.de','myteslatuning.de','beatwings.com',
 'www.montessori-dinkelscherben.de','www.staterabikes.de','sharemagazines.de',
 'tankstelle-kern.de','bobblume.de','outside-stories.de','www.tauchen.de',
 'www.cloettadeutschland.de','www.bayerndigitalradio.de','www.draco.de',
 'www.counterkompass.de','lumarie.de','www.borchersplus.de','himmlischschoen.de',
 'carmushka.humblebutbold.de','partnerfuertechnik.de',
 'www.berliner-sparkasse.de','www.ndr.de','spiele.connect.de','www.urlaubsguru.de',
 'www.gewinnarena.de'
]);
export function classify(status,error=false){
 if(error)return 'inconclusive';
 if(status>=200&&status<300)return 'reachable';
 if(status>=300&&status<400)return 'redirect-review';
 if([401,403,429].includes(status))return 'blocked-or-rate-limited';
 if([404,410].includes(status))return 'missing-review';
 return 'inconclusive';
}
export function eligibleProbe(url){
 const c=canonicalContestUrl(url);
 if(!c)return false;
 return ALLOWED.has(new URL(c).hostname);
}
export async function probe(url,fetchFn=fetch){
 if(!eligibleProbe(url))return{status:'skipped-unapproved-host',http_status:null};
 try{
  const r=await fetchFn(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'user-agent':'GewinnRadar-Research-Status/0.4 (single daily HEAD check)'}});
  r.body?.cancel();
  return {status:classify(r.status),http_status:r.status};
 }catch{return{status:'inconclusive',http_status:null}}
}
async function main(){
 const records=[];
 for(const entry of catalog.entries){
  const result=await probe(entry.source_url);
  records.push({id:entry.id,source:entry.source_url,...result,research_state:entry.state});
 }
 const summary=Object.fromEntries([...new Set(records.map(x=>x.status))].map(status=>[status,records.filter(x=>x.status===status).length]));
 const output={checked_at:new Date().toISOString(),count:records.length,summary,reminder_emails_sent:0,auto_approved:0,records};
 mkdirSync('test-artifacts',{recursive:true});
 writeFileSync('test-artifacts/source-status.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({checked:records.length,summary,auto_approved:0}));
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href)await main();

// Verify every Advent production asset against GitHub main, independently over HTTPS.
// In PRs read origin/main, not unmerged PR content. No write to Cloudflare/D1.
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const paths=['public/advent-calendars-2026.json','public/advent-daily.js','public/index.html'];
const source='https://gewinnradar.pages.dev/';
const fromMain=process.env.PRODUCTION_COMPARE_MAIN==='1';
const commit=fromMain?execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim():process.env.GITHUB_SHA||null;
const hash=b=>createHash('sha256').update(b).digest('hex');
const audit={timestamp:new Date().toISOString(),comparison_commit:commit,baseline:fromMain?'origin/main':'checkout',status:'MATCH',files:[]};
for(const path of paths){
 const bytes=fromMain?execFileSync('git',['show','origin/main:'+path],{maxBuffer:4*1024*1024}):await readFile(path);
 const url=source+path.replace(/^public\//,'');
 const entry={path,url,expected_sha256:hash(bytes),production_sha256:null,http_status:null,status:'UNVERIFIED'};
 try{
  const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  entry.http_status=r.status;
  if(r.ok){
   const actual=Buffer.from(await r.arrayBuffer());
   entry.production_sha256=hash(actual);
   entry.status=actual.equals(bytes)?'MATCH':'MISMATCH';
   if(path.endsWith('advent-calendars-2026.json')){
    const d=JSON.parse(actual.toString('utf8'));
    if(d.schema_version!==1||!Array.isArray(d.confirmed))entry.status='MISMATCH';
   }
  }
 }catch(e){entry.error=e?.name||'FetchError';}
 audit.files.push(entry);
 if(entry.status==='MISMATCH')audit.status='MISMATCH';
 if(entry.status==='UNVERIFIED'&&audit.status==='MATCH')audit.status='UNVERIFIED';
}
await writeFile('advent-production-verification.json',JSON.stringify(audit,null,2)+'\n');
const lines=['### GewinnRadar Advent: unabhängiger Cloudflare-Dateivergleich','- Ergebnis: **'+audit.status+'**','- GitHub-Commit: '+commit,'- Zeitpunkt: '+audit.timestamp,...audit.files.map(e=>'- '+e.path+': **'+e.status+'**, HTTP '+(e.http_status??'keine Antwort')+', GitHub SHA-256 '+e.expected_sha256+', Production SHA-256 '+(e.production_sha256??'unbekannt'))];
console.log(lines.join('\n'));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
if(audit.status==='MISMATCH')process.exitCode=2;
else if(audit.status==='UNVERIFIED')process.exitCode=3;

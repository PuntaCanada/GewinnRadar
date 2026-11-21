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
   entry.expected_bytes=bytes.length;entry.production_bytes=actual.length;
    entry.status=actual.equals(bytes)?'MATCH':'MISMATCH';
   if(path==='public/index.html'&&entry.status==='MISMATCH'){
    const html=actual.toString('utf8'),expected=bytes.toString('utf8');
    entry.production_has_advent_section=html.includes('id="adventDaily"');
    entry.production_has_advent_script=html.includes('src="/advent-daily.js"');
    const startTag="<script defer src='https://static.cloudflareinsights.com/beacon.min.js'";
    const marker='<!-- Cloudflare Pages Analytics -->';
    const start=html.indexOf(startTag),mark=start<0?-1:html.indexOf(marker,start);
    entry.injection_start=start;
    entry.injection_marker=mark;
    if(start>=0&&mark>=0&&html.lastIndexOf(startTag)===start&&html.lastIndexOf(marker)===mark){
     const injection=html.slice(start,mark+marker.length);
     const rule=/^<script defer src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js' data-cf-beacon='\{"token": "[0-9a-f]{32}"\}'><\/script><!-- Cloudflare Pages Analytics -->$/;
     entry.injection_bytes=Buffer.byteLength(injection);
     entry.exact_injection_format=rule.test(injection);
     const normalized=html.slice(0,start)+html.slice(mark+marker.length);
     entry.normalized_sha256=hash(Buffer.from(normalized));
     entry.normalized_length=Buffer.byteLength(normalized);
     entry.normalized_first_diff=Array.from({length:Math.min(normalized.length,expected.length)},(_,i)=>i).find(i=>normalized[i]!==expected[i])??Math.min(normalized.length,expected.length);
     entry.normalized_ends_like_source=normalized.slice(-85)===expected.slice(-85);
     entry.github_end=expected.slice(-180);
     entry.normalized_end=normalized.slice(-250);
     entry.first_difference_expected=expected.slice(Math.max(0,entry.normalized_first_diff-90),entry.normalized_first_diff+130);
     entry.first_difference_live=normalized.slice(Math.max(0,entry.normalized_first_diff-90),entry.normalized_first_diff+130);
     if(rule.test(injection)&&Buffer.from(normalized).equals(bytes)){
      entry.status='MATCH_WITH_PLATFORM_INJECTION';
      entry.platform_injection='Verified one exact Cloudflare Pages Analytics beacon; all original HTML bytes unchanged';
     }
    }
   }
   if(path.endsWith('advent-calendars-2026.json')){
    const d=JSON.parse(actual.toString('utf8'));
    if(d.schema_version!==1||!Array.isArray(d.confirmed))entry.status='MISMATCH';
   }
  }
 }catch(e){entry.error=e?.name||'FetchError';}
 audit.files.push(entry);
 if(entry.status==='MISMATCH')audit.status='MISMATCH';
 if(entry.status==='MATCH_WITH_PLATFORM_INJECTION'&&audit.status==='MATCH')audit.status='MATCH_WITH_PLATFORM_INJECTION';
 if(entry.status==='UNVERIFIED'&&audit.status!=='MISMATCH')audit.status='UNVERIFIED';
}
await writeFile('advent-production-verification.json',JSON.stringify(audit,null,2)+'\n');
const lines=['### GewinnRadar Advent: unabhängiger Cloudflare-Dateivergleich','- Ergebnis: **'+audit.status+'**','- GitHub-Commit: '+commit,'- Zeitpunkt: '+audit.timestamp,...audit.files.map(e=>'- '+e.path+': **'+e.status+'**, HTTP '+(e.http_status??'keine Antwort')+', GitHub SHA-256 '+e.expected_sha256+', Production SHA-256 '+(e.production_sha256??'unbekannt')+', Prefix identisch: '+(e.prefix_byte_identical??'n/a')+', Extra Bytes: '+(e.trailing_bytes??'n/a')+', Analytics-Anhang: '+(e.trailing_has_analytics??'n/a')+', HTML script vorhanden: '+(e.production_has_advent_script??'n/a')+', HTML Bereich vorhanden: '+(e.production_has_advent_section??'n/a')+', erste Abweichung: '+(e.first_difference_offset??'n/a')+', remote-Auszug: '+(e.production_excerpt??'n/a')+', Normalized hash: '+(e.normalized_sha256??'n/a')+', normalized length: '+(e.normalized_length??'n/a')+', injected bytes: '+(e.injection_bytes??'n/a')+', injection format: '+(e.exact_injection_format??'n/a')+', normalized first diff: '+(e.normalized_first_diff??'n/a')+', ending unchanged: '+(e.normalized_ends_like_source??'n/a')+', source end: '+(e.github_end??'n/a')+', normalized end: '+(e.normalized_end??'n/a')+', diff source: '+(e.first_difference_expected??'n/a')+', diff remote: '+(e.first_difference_live??'n/a'))];
console.log(lines.join('\n'));
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
if(audit.status==='MISMATCH')process.exitCode=2;
else if(audit.status==='UNVERIFIED')process.exitCode=3;
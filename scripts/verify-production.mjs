// Read-only, independent Cloudflare Pages integrity check.
// Run in GitHub Actions or locally: node scripts/verify-production.mjs
// Exit 0 = identical OR inaccessible (explicit UNVERIFIED); exit 2 = mismatch.
// Never treat a failed fetch as proof of an up-to-date deployment.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const path = 'public/editorial-links-2026.json';
const url = 'https://gewinnradar.pages.dev/editorial-links-2026.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stamp = new Date().toISOString();
const local = await readFile(path);
const result = {
  verified_at: stamp, source: url, github_sha: process.env.GITHUB_SHA || null,
  local_file: path, local_sha256: hash(local), local_bytes: local.length,
  remote_sha256: null, remote_bytes: null, http_status: null,
  status: 'UNVERIFIED', reason: 'Anfrage wurde nicht abgeschlossen'
};
try {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {'Accept':'application/json', 'Cache-Control':'no-cache'},
    redirect:'follow'
  });
  result.http_status = response.status;
  if(!response.ok) result.reason = 'HTTP ' + response.status + ' beim öffentlichen Dateiabruf';
  else {
    const remote = Buffer.from(await response.arrayBuffer());
    result.remote_sha256 = hash(remote);
    result.remote_bytes = remote.length;
    const json = JSON.parse(remote.toString('utf8'));
    if(!Array.isArray(json.active) || json.schema_version !== 1) {
      result.status = 'MISMATCH';
      result.reason = 'Die produktive Antwort ist kein gültiger redaktioneller Katalog';
    } else if(remote.equals(local)) {
      result.status = 'MATCH';
      result.reason = 'Unabhängig über HTTPS abgerufener Dateiinhalt ist bytegenau mit diesem GitHub-Checkout identisch';
    } else {
      result.status = 'MISMATCH';
      result.reason = 'Öffentlicher Dateiinhalt weicht von diesem GitHub-Checkout ab';
    }
  }
} catch(error) {
  result.reason = 'HTTPS-Zugriff oder JSON-Verarbeitung fehlgeschlagen: ' + (error?.name || 'Fehler');
}
await writeFile('production-verification.json',JSON.stringify(result,null,2)+'\n');
const msg = [
  '### GewinnRadar – externer Production-Dateivergleich',
  '- Ergebnis: **' + result.status + '**',
  '- GitHub-Commit: ' + (result.github_sha || 'lokaler Checkout'),
  '- URL: ' + url,
  '- Lokale SHA-256: ' + result.local_sha256,
  '- Öffentliche SHA-256: ' + (result.remote_sha256 || 'nicht ermittelbar'),
  '- HTTP: ' + (result.http_status ?? 'nicht erreichbar'),
  '- Begründung: ' + result.reason,
  '- Zeitpunkt: ' + stamp,
  '',
  'Nur MATCH bestätigt eine identische Production-Datei. UNVERIFIED ist **keine** Deployment-Bestätigung.'
].join('\n');
console.log(msg);
if(process.env.GITHUB_STEP_SUMMARY) {
  const {appendFile}=await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY,msg+'\n');
}
if(result.status==='MISMATCH')process.exitCode=2;

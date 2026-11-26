import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Partner directory is transparent, complete and stays non-indexable',()=>{
 const home=readFileSync('public/index.html','utf8'),page=readFileSync('public/partners.html','utf8'),robots=readFileSync('public/robots.txt','utf8');
 assert.ok(home.includes('href="/partners.html"'));assert.match(home,/keine bezahlte Werbung/);assert.match(page,/Eigenwerbung/);assert.match(page,/name="robots" content="noindex,follow"/);assert.doesNotMatch(robots,/^Disallow: \/\s*$/m);assert.ok(page.includes('<link rel="canonical" href="https://gewinnradar.pages.dev/partners.html">'));assert.deepEqual([...page.matchAll(/<li><a href="([^"]+)"/g)].map(m=>m[1]),["https://comparanetrd.pages.dev/","https://islaviva-rd.pages.dev/","https://vuelosrd.pages.dev/","https://oficiord.pages.dev/","https://recarganet-rd.pages.dev/","https://by-maria-beauty-store.pages.dev/","https://demoradar.pages.dev/","https://ahorrord.pages.dev/","https://hablard.pages.dev/","https://transporterd.pages.dev/","https://aprenderd.pages.dev/","https://handyfix.pages.dev/","https://dateiwerk.pages.dev/","https://voicefix.pages.dev/"]);assert.equal(new Set([...page.matchAll(/<li><a href="([^"]+)"/g)].map(m=>m[1])).size,14);assert.match(page,/Simulation/i);assert.equal([...home.match(/<p id="project-network">.*?<\/p>/)[0].matchAll(/href=/g)].length,4);
});

test('Only public homepage is submitted for indexing',()=>{
 const read=p=>readFileSync(p,'utf8');
 assert.match(read('public/index.html'),/<meta name="robots" content="index,follow">/);
 assert.match(read('public/index.html'),/<link rel="canonical" href="https:\/\/gewinnradar\.pages\.dev\/">/);
 assert.equal(read('public/robots.txt'),"User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /admin-login-test\nDisallow: /api/\nSitemap: https://gewinnradar.pages.dev/sitemap.xml\n");
 assert.equal(read('public/sitemap.xml'),"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url><loc>https://gewinnradar.pages.dev/</loc></url>\n</urlset>\n");
 for(const p of ['admin/index.html','admin/setup/index.html','admin/recovery/index.html','admin-login-test.html','melden/index.html','datenschutz.html','quellenpruefung.html','partners.html']) assert.match(read('public/'+p),/<meta name="robots" content="noindex(?:,[^"]*)?">/);
 assert.match(read('functions/_lib/core.js'),/'x-robots-tag':'noindex, nofollow'/);
});

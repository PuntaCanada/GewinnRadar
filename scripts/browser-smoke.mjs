import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const root=resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const parsed=new URL(req.url,'http://127.0.0.1');
  const pathname=decodeURIComponent(parsed.pathname);
  const safe=resolve(root,'.'+pathname);
  if(!(safe===root||safe.startsWith(root+sep))){res.writeHead(403);res.end();return;}
  try{
    const file=pathname.endsWith('/')?safe+'index.html':safe;
    const data=await readFile(file);
    res.writeHead(200,{'content-type':types[extname(file)]||'text/plain'});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  for(const width of [390,1280]){
    const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
    const page=await ctx.newPage();
    const actions=[];
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      const response=(object,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(object)});
      if(path==='/api/me')return response({user:{id:'mother',role:'member',display_name:'Mama',daily_email:0,senior_mode:1,email_verified:1}});
      if(path==='/api/games')return response({games:[
        {id:'advent-test',title:'Geprüfter Adventskalender',organizer:'Test-Radiosender',prize:'Digitalradio',url:'https://www.br.de/',terms_url:'https://www.br.de/',privacy_url:'https://www.br.de/',ends_at:'2099-12-24T00:00:00Z',required_data:'Name und E-Mail',daily:1,completed:0,favorite:0,verified_at:'2026-11-21T09:00:00Z'}
      ],day:'2026-12-01'});
      if(path==='/api/progress'){const body=JSON.parse(route.request().postData());actions.push(body);return response({ok:true})}
      if(path==='/api/settings')return response({ok:true});
      return response({error:'unhandled'},404);
    });
    await page.goto(base+'/');
    await page.getByRole('heading',{name:/Guten Morgen, Mama/}).waitFor();
    await page.getByRole('heading',{name:/Was habe ich heute schon erledigt/}).waitFor();
    const read=await page.locator('body').evaluate(el=>getComputedStyle(el).fontSize);
    assert.equal(read,'21px','Large-type senior mode');
    assert.equal(await page.locator('#progressBar').getAttribute('max'),'1');
    const done=page.getByRole('checkbox',{name:/Teilnahme als erledigt markieren/});
    assert.equal(await done.isChecked(),false);
    await done.check();
    assert.equal(actions.length,1);
    assert.equal(actions[0].action,'completed');
    await page.getByText('1 von 1 erledigt').waitFor();
    assert.equal(await page.locator('#progressBar').getAttribute('value'),'1');
    const link=page.getByRole('link',{name:/Jetzt am Gewinnspiel teilnehmen/});
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
    const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(scrollWidth <= width+2,'No horizontal overflow on '+width+'px device');
    await ctx.close();
  }
  console.log('Chromium senior/mobile+desktop dashboard and progress interactions: PASS');
}finally{await browser.close();await new Promise(ok=>server.close(ok))}

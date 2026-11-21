import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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
    const file=pathname.endsWith('/')?resolve(safe,'index.html'):safe;
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
    await page.getByRole('heading',{name:/Willkommen, Mama/}).waitFor();
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
    await page.locator('#dailyOnly').check();
    assert.equal(await page.locator('.game').count(),1);
    await page.locator('#simpleOnly').check();
    assert.equal(await page.locator('.game').count(),1);
    await page.locator('#simpleOnly').uncheck();
    await page.locator('#dailyOnly').uncheck();
    assert.equal(await page.locator('#progressBar').getAttribute('value'),'1');
    const link=page.getByRole('link',{name:/Jetzt am Gewinnspiel teilnehmen/});
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
    const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    if(scrollWidth>width+2) {
      const offenders=await page.locator('body *').evaluateAll((nodes,width)=>nodes.map(n=>({tag:n.tagName,cls:n.className,txt:(n.textContent||'').slice(0,70),right:Math.round(n.getBoundingClientRect().right),width:Math.round(n.getBoundingClientRect().width)})).filter(x=>x.right>width+2).slice(0,20),width);
      console.log('Horizontal overflow',width,scrollWidth,JSON.stringify(offenders));
    }
    assert.ok(scrollWidth <= width+2,'No horizontal overflow on '+width+'px device');
    await mkdir('test-artifacts',{recursive:true});
    await page.screenshot({path:'test-artifacts/senior-'+width+'.png',fullPage:true});
    await ctx.close();
  }
  const guest=await browser.newContext({viewport:{width:390,height:850}});
  const guestPage=await guest.newPage();
  await guestPage.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    const body=path==='/api/me'?{user:null}:path==='/api/games'?{games:[{id:'public-test',title:'Öffentlich geprüfter Testeintrag',organizer:'Testveranstalter',prize:'Testpreis',url:'https://www.br.de/',terms_url:'https://www.br.de/',privacy_url:'https://www.br.de/',ends_at:'2099-12-24T00:00:00Z',daily:0,required_data:'Name und E-Mail',verified_at:'2026-11-21T09:00:00Z'}]}:{error:path==='/api/login'?'Der Familien-Login ist noch nicht freigeschaltet.':'Nicht erlaubt'};
    return route.fulfill({status:path==='/api/me'||path==='/api/games'?200:path==='/api/login'?503:403,contentType:'application/json',body:JSON.stringify(body)});
  });
  await guestPage.goto(base+'/');
  await guestPage.getByRole('heading',{name:/Aktuelle Gewinnspiele/}).waitFor();
  await guestPage.getByRole('heading',{name:'Öffentlich geprüfter Testeintrag'}).waitFor();
  await guestPage.locator('#searchGames').fill('testpreis');
  assert.equal(await guestPage.locator('.game').count(),1);
  await guestPage.locator('#searchGames').fill('nicht-vorhanden');
  assert.equal(await guestPage.locator('.game').count(),0);
  await guestPage.getByText('0 von 1 Gewinnspielen angezeigt').waitFor();
  await guestPage.getByRole('button',{name:'Suche und Filter zurücksetzen'}).click();
  assert.equal(await guestPage.locator('#searchGames').inputValue(),'');
  await guestPage.locator('#sortGames').selectOption('title');
  await guestPage.locator('#searchGames').fill('');
  assert.equal(await guestPage.locator('.game').count(),1);
  assert.ok(await guestPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Guest mobile has no horizontal scroll');
  assert.equal(await guestPage.locator('#dashboard').isVisible(),true);
  assert.equal(await guestPage.getByRole('checkbox',{name:/Teilnahme als erledigt markieren/}).count(),0);
  assert.equal(await guestPage.locator('#saveSettings').isVisible(),false);
  await guestPage.locator('#loginPanel summary').click();
  await guestPage.locator('#email').fill('test@example.invalid');
  await guestPage.getByRole('button',{name:'Anmeldelink anfordern'}).click();
  await guestPage.getByText('Der Familien-Login ist noch nicht freigeschaltet.').waitFor();
  await guestPage.goto(base+'/admin/');
  await guestPage.getByText(/Keine Admin-Berechtigung/).waitFor();
  assert.equal(await guestPage.locator('#list').locator('.game').count(),0);
  await guest.close();
  const adminContext=await browser.newContext({viewport:{width:1280,height:900}});
  const adminPage=await adminContext.newPage();
  let savedEvidence=null,savedForm=null;
  await adminPage.route('**/api/admin/**',route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    const response=(object,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(object)});
    if(path==='/api/admin/contests')return response({contests:[]});
    if(path==='/api/admin/form-verification'&&route.request().method()==='POST'){
      const b=JSON.parse(route.request().postData());
      if(!['form_observed','correct_year','german_residents','no_marketing_required','no_purchase_required','no_account_or_app_obligation','no_unresolved_deadline_conflict'].every(k=>b[k]===true))return response({error:'Nicht alle Bedingungen erfüllt'},409);
      savedForm=b;return response({ok:true,form_review_recorded:true,contest_approved:false,reminder_approved:false},201);
    }
    if(path==='/api/admin/source-evidence'){
      if(route.request().method()==='POST'){
        savedEvidence=JSON.parse(route.request().postData());
        return response({ok:true,approved:false,reminders_enabled:false},201);
      }
      return response({events:savedEvidence?[{id:1,observed_at:'2026-11-21T08:00:00Z',...savedEvidence}]:[]});
    }
    return response({error:'Nicht erlaubt'},403);
  });
  await adminPage.goto(base+'/admin/');
  await adminPage.getByRole('heading',{name:'Quellenhistorie 2026'}).waitFor();
  await adminPage.locator('#evidenceCandidate').fill('wdr3-2026');
  await adminPage.locator('#evidenceUrl').fill('https://www1.wdr.de/radio/wdr3/schwerpunkte/wdr3-weihnacht/teilnahmebedingungen-adventskalender-102.html');
  await adminPage.locator('#evidenceFinding').fill('Der offizielle WDR nennt das Kalenderjahr 2026, aber das Formular ist noch nicht geprüft.');
  await adminPage.locator('#evidenceSave').click();
  await adminPage.getByText(/Gewinnspiel bleibt ungeprüft/).waitFor();
  assert.equal(savedEvidence.candidate_id,'wdr3-2026');
  assert.equal(savedEvidence.verdict,'pending');
  assert.equal(savedEvidence.source_year,2026);
  assert.equal(await adminPage.locator('#evidenceEvents li').count(),1);
  await adminPage.locator('#verGame').fill('sample-2026');
  await adminPage.locator('#verForm').fill('https://www.br.de/gewinnspiel');
  await adminPage.locator('#verPrivacy').fill('https://www.br.de/datenschutz');
  await adminPage.locator('#verData').fill('E-Mail only');
  await adminPage.locator('#verNotes').fill('Ein echter Formularnachweis wird nur nach manueller Prüfung gespeichert.');
  await adminPage.locator('#verifiedSave').click();
  await adminPage.getByText(/Nicht gespeichert: Nicht alle Bedingungen erfüllt/).waitFor();
  assert.equal(savedForm,null);
  for(const input of await adminPage.locator('#verifiedForm fieldset input[type=checkbox]').all())await input.check();
  await adminPage.locator('#verifiedSave').click();
  await adminPage.getByText(/Noch keine Gewinnspiel-Freigabe und keine Erinnerungen/).waitFor();
  assert.equal(savedForm.game_id,'sample-2026');
  assert.equal(savedForm.no_marketing_required,true);
  await adminContext.close();
  console.log('Chromium senior/mobile+desktop, private login and denied admin UI: PASS');
}finally{await browser.close();await new Promise(ok=>server.close(ok))}

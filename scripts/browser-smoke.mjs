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
  // Verify real browser date behavior in Europe/Berlin, independent of runner timezone.
  // Fixed UTC noon is 13:00 Berlin time in November/December (CET).
  for(const [isoDate,seasonOpen] of [
    ['2026-11-30',false],['2026-12-01',true],
    ['2026-12-24',true],['2026-12-25',false]
  ]){
    const ctx=await browser.newContext({viewport:{width:390,height:850},timezoneId:'Europe/Berlin'});
    const page=await ctx.newPage();
    await page.clock.setFixedTime(new Date(isoDate+'T12:00:00Z'));
    await page.goto(base+'/');
    await page.locator('#adventAllDetails > summary').waitFor();
    await page.waitForFunction(()=>document.querySelector('#adventAllDetails')?.dataset.adventInitialized==='1');
    assert.equal(await page.locator('#adventAllDetails').evaluate(el=>el.open),seasonOpen,'Advent auto disclosure on '+isoDate);
    const order=await page.locator('#editorialLinks').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('#adventAllDetails')) & Node.DOCUMENT_POSITION_FOLLOWING));
    assert.equal(order,true,'Regular draws precede Advent on '+isoDate);
    const summary=await page.locator('#adventAllDetails > summary').innerText();
    assert.match(summary,seasonOpen?/zum Einklappen klicken/:/zum Anzeigen klicken/,'Season label on '+isoDate);
    // Native disclosure remains user-operable without being reset on same-season refresh.
    await page.locator('#adventAllDetails > summary').click();
    assert.equal(await page.locator('#adventAllDetails').evaluate(el=>el.open),!seasonOpen,'Manual toggle on '+isoDate);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#adventAllDetails')?.dataset.adventInitialized==='1');
    assert.equal(await page.locator('#adventAllDetails').evaluate(el=>el.open),!seasonOpen,'Persist manual choice on '+isoDate);
    await ctx.close();
  }
  // Regular giveaways and Advent calendars are independently collapsible.
  {
    const ctx=await browser.newContext({viewport:{width:390,height:850},timezoneId:'Europe/Berlin'});
    const page=await ctx.newPage();
    await page.goto(base+'/');
    const regular=page.locator('#editorialDetails');
    const advent=page.locator('#adventAllDetails');
    assert.equal(await regular.evaluate(el=>el.open),true,'Regular giveaways open by default');
    await regular.locator('summary').click();
    assert.equal(await regular.evaluate(el=>el.open),false,'Regular giveaways collapse');
    assert.equal(await page.evaluate(()=>localStorage.getItem('gewinnradar:guest:editorial-expanded:v1')),'0','Regular disclosure choice saved');
    assert.equal(await advent.count(),1,'Advent disclosure remains independently available');
    await page.reload();
    assert.equal(await regular.evaluate(el=>el.open),false,'Regular disclosure stays collapsed after reload');
    await regular.locator('summary').click();
    await page.reload();
    assert.equal(await regular.evaluate(el=>el.open),true,'Regular disclosure stays expanded after reload');
    await ctx.close();
  }
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
    await page.getByRole('heading',{name:'Jetzt direkt beim Veranstalter teilnehmen'}).waitFor();
    await page.locator('#editorialLive .game').first().waitFor();
    // Upcoming calendars must not obscure immediately playable regular contests.
    assert.equal(await page.locator('#adventAllDetails').evaluate(el=>el.open),false);

    assert.equal(await page.locator('#editorialLinks').evaluate(el=>el.compareDocumentPosition(document.querySelector('#adventAllDetails')) & Node.DOCUMENT_POSITION_FOLLOWING),4);
    await page.locator('#adventAllDetails > summary').click();
    assert.equal(await page.locator('#adventAllDetails').evaluate(el=>el.open),true);
    await page.locator('#adventToday .advent-card').first().waitFor();
    assert.equal(await page.locator('#adventToday .advent-card').count(),55);
    assert.equal(await page.locator('#adventCandidates .game').count(),23);
    assert.match(await page.locator('#adventTodayStatus').innerText(),/Noch keine heutige Teilnahme/);
    assert.equal(await page.locator('#adventToday input[data-advent-day]').count(),0);
    assert.equal(await page.locator('#editorialLive .game').count(),42);
    assert.equal(await page.locator('#editorialReview .game').count(),5);
    await page.locator('#editorialReview').getByRole('heading',{name:/Berghaus/}).waitFor();
    await page.locator('#editorialReview').getByRole('heading',{name:/Saal-Digital/}).waitFor();
    assert.match(await page.locator('#editorialReview').innerText(),/nicht zur Teilnahme freigegeben/i);
    assert.match(await page.locator('#editorialReview a').first().getAttribute('href'),/^https:\/\//);
    await page.locator('#editorialLive .game').first().getByText(/Teilnahmeschluss: 24\.11\.2026.*23:59 Uhr/).waitFor();
    await page.locator('#editorialLive .game').first().getByText('Zuletzt geprüft: 21.11.2026').waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Pfalz-Genussreise/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Mosel/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/kostenlose Übernachtung/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/La Sportiva/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/10 Preise/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/CandyKing Adventskalender/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:'Fünf Wera-Adventskalender gewinnen',exact:true}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Prym DIY-Adventskalender/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Vier BULLS Fahrräder gewinnen/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Zehn STRYVE Weihnachtspakete/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/iPhone 18 Pro Max/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Smyths-Toys-Wunschliste/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/4.000 € AIDA-Reisegutschein/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Weihnachten mit Bibi & Tina/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/PlayStation 5 Slim oder Nintendo Switch 2/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Brautkleid bei wed2b/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/DeWalt-Baustellenradio/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/HALPLUS-Weihnachtsleuchten/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Radio Brocken Familienquiz/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/PILOT FriXion/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/250-€-Würfel-Gutschein/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Simple Spa Whirlpool/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/zusätzlichen DualSense-Controller/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/KANZI-Power-Suche/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/SÜLZLE Wimmelbild/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Le Rustique/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Meine MVG/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Hurtigruten-Nordkapreise/}).waitFor();
    await page.locator('#editorialLive').getByRole('heading',{name:/Zehn PlayStation-5-Pakete für Familien/}).waitFor();
    assert.equal(await page.locator('#counter').innerText(),'42 Originalaktionen · 29 Bedingungen bestätigt');
    assert.equal(await page.locator('#counter').innerText().then(s=>s.includes('D1')),false);
    await page.locator('#editorialLive').getByText(/kostenpflichtiges, monatlich kündbares Abo weiter/).waitFor();
    await page.locator('#editorialLive').getByText(/nur ZWEIER Tage/).waitFor();
    assert.equal(await page.locator('#editorialLive').getByText('Instagram oder TikTok erforderlich').count(),1);
    await page.locator('#editorialLive').getByText(/KEIN Versand: Selbstabholung/).waitFor();
    await page.locator('#editorialLive').getByText(/WICHTIGE Quellenabweichung/).waitFor();
    await page.locator('#editorialLive').getByText(/unbeschränkte Bildnutzungsrechte/).waitFor();
    await page.locator('#editorialLive').getByText(/aufgezeichnete und ausgestrahlte/).waitFor();
    assert.equal(await page.locator('#editorialLive').getByText('Externes Formular – noch selbst prüfen').count(),5);
    assert.equal(await page.locator('#editorialLive').getByText('App und neues Konto erforderlich').count(),2);
    assert.equal(await page.locator('#editorialLive').getByText('Kostenloses Kundenkonto erforderlich').count(),3);
    const sortedIds=await page.locator('#editorialLive .game h2').allTextContents();
    assert.match(sortedIds[0],/Wera-Adventskalender/);
    assert.match(sortedIds[1],/DAB\+-Radio/);
    assert.match(sortedIds[2],/CandyKing/);
    assert.match(sortedIds[3],/iPhone 18 Pro Max/);
    assert.match(sortedIds[4],/KANZI-Power-Suche/);
    assert.match(sortedIds[5],/10 Preise/);
    assert.match(sortedIds[6],/Smyths-Toys-Wunschliste/);
    assert.match(sortedIds[7],/BULLS Fahrräder/);
    assert.match(sortedIds[8],/AIDA-Reisegutschein/);
    assert.match(sortedIds[9],/Brautkleid bei wed2b/);
    assert.match(sortedIds[10],/PlayStation 5 Slim/);
    assert.match(sortedIds[11],/Bibi & Tina/);
    assert.match(sortedIds[12],/Simple Spa Whirlpool/);
    await page.locator('#editorialLive').getByText(/Teilnahmeschluss: 30\.11\.2026 · 18:00 Uhr/).waitFor();
    assert.equal(await page.locator('#editorialLive').getByText('Instagram-Konto erforderlich').count(),4);
    assert.equal(await page.locator('#editorialLive').getByText('Facebook oder Instagram erforderlich').count(),3);
    assert.equal(await page.locator('#editorialLive').getByText('WhatsApp-Kanal + eigene E-Mail').count(),1);
    assert.equal(await page.locator('#editorialLive').getByRole('link',{name:'Offiziellen Teilnahmeweg prüfen'}).count(),28);
    assert.equal(await page.locator('#adventPreview .game').count(),1);
    assert.match(await page.locator('#editorialCount').innerText(),/42 recherchierte Originalaktionen/);
    // Preview is deliberately collapsed; expand it to inspect its visible text.
    assert.match(await page.locator('#adventPreview').innerText(),/Vorschau – nicht zur Teilnahme freigegeben/);
    await page.getByRole('heading',{name:/Was habe ich heute schon erledigt/}).waitFor();
    await page.getByText(/Kalender-Ende:/).waitFor();
    await page.getByText(/Die Frist für das heutige Türchen kann früher liegen/).waitFor();
    await page.getByText(/Tagesaktion – heutiges Türchen prüfen/).waitFor();
    const read=await page.locator('body').evaluate(el=>getComputedStyle(el).fontSize);
    assert.equal(read,'21px','Large-type senior mode');
    assert.equal(await page.locator('#progressBar').getAttribute('max'),'1');
    const done=page.getByRole('checkbox',{name:/Teilnahme als erledigt markieren/});
    assert.equal(await done.isChecked(),false);
    await done.check();
    assert.equal(actions.length,1);
    assert.equal(actions[0].action,'completed');
    await page.waitForFunction(()=>document.querySelector('#progressBar')?.getAttribute('aria-label')==='1 von 1 Gewinnspielen erledigt');
    await page.locator('#dailyOnly').check();
    assert.equal(await page.locator('#cards .game').count(),1);
    await page.locator('#simpleOnly').check();
    assert.equal(await page.locator('#cards .game').count(),1);
    await page.locator('#simpleOnly').uncheck();
    await page.locator('#dailyOnly').uncheck();
    assert.equal(await page.locator('#progressBar').getAttribute('value'),'1');
    const link=page.getByRole('link',{name:/Jetzt am Gewinnspiel teilnehmen/});
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
    const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    if(scrollWidth>width+2) {
      const offenders=await page.locator('body *').evaluateAll((nodes,width)=>nodes.map(n=>({tag:n.tagName,cls:n.className,txt:(n.textContent||'').slice(0,70),right:Math.round(n.getBoundingClientRect().right),width:Math.round(n.getBoundingClientRect().width)})).filter(x=>x.right>width+2).slice(0,20),width);
      const diagnostics=await page.locator('body *').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id,cls:typeof n.className==='string'?n.className:'',sw:n.scrollWidth,cw:n.clientWidth,left:Math.round(n.getBoundingClientRect().left),right:Math.round(n.getBoundingClientRect().right)})).filter(n=>n.sw>n.cw+2||n.left < -2||n.right>innerWidth+2).slice(0,25));console.log('Horizontal overflow',width,scrollWidth,JSON.stringify(offenders),JSON.stringify(diagnostics));
    }
    assert.ok(scrollWidth <= width+2,'No horizontal overflow on '+width+'px device');
    await mkdir('test-artifacts',{recursive:true});
    await page.screenshot({path:'test-artifacts/senior-'+width+'.png',fullPage:true});
    await ctx.close();
  }
  const guest=await browser.newContext({viewport:{width:390,height:850}});
  const guestPage=await guest.newPage();
  let failGuestCatalog=false;
  await guestPage.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/games'&&failGuestCatalog)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Katalog vorübergehend nicht erreichbar'})});
    const body=path==='/api/me'?{user:null}:path==='/api/games'?{games:[{id:'public-test',title:'Öffentlich geprüfter Testeintrag',organizer:'Testveranstalter',prize:'Testpreis',url:'https://www.br.de/',terms_url:'https://www.br.de/',privacy_url:'https://www.br.de/',ends_at:'2099-12-24T00:00:00Z',daily:0,required_data:'Name und E-Mail',verified_at:'2026-11-21T09:00:00Z',email_entry:'EMAIL_ENTRY_V1:'+JSON.stringify({to:'marketing@pilotpen.de',subject:'Geprüfter Tagesbetreff',fields:'Absender-E-Mail'})}]}:{error:path==='/api/login'?'Der Familien-Login ist noch nicht freigeschaltet.':'Nicht erlaubt'};
    return route.fulfill({status:path==='/api/me'||path==='/api/games'?200:path==='/api/login'?503:403,contentType:'application/json',body:JSON.stringify(body)});
  });
  await guestPage.goto(base+'/');
  const catalogueStatusLink=guestPage.getByRole('link',{name:'Technischen Katalogstatus prüfen'});
  assert.equal(await catalogueStatusLink.getAttribute('href'),'/api/catalog-status');
  // The diagnostic must remain a public GET without login or user data.
  await guestPage.getByRole('heading',{name:/Aktuelle Gewinnspiele/}).waitFor();
  await guestPage.locator('#editorialLive .game').first().waitFor();
  assert.equal(await guestPage.locator('#editorialLive .game').count(),42);
  assert.equal(await guestPage.locator('#counter').innerText(),'42 Originalaktionen · 29 Bedingungen bestätigt');
  assert.equal(await guestPage.locator('#d1CatalogHeading').isVisible(),false,'Private database technical section hidden for guests');
  assert.equal(await guestPage.locator('#cards').isVisible(),false,'Private catalogue is not a second empty public catalogue');
  assert.equal(await guestPage.locator('#searchGames').isVisible(),false);
  assert.ok(await guestPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Guest mobile has no horizontal scroll');
  assert.equal(await guestPage.locator('#dashboard').isVisible(),true);
  await guestPage.locator('#loginPanel summary').click();
  await guestPage.locator('#email').fill('test@example.invalid');
  await guestPage.getByRole('button',{name:'Anmeldelink anfordern'}).click();
  await guestPage.getByText('Der Familien-Login ist noch nicht freigeschaltet.').waitFor();
  await guestPage.goto(base+'/admin/');
  await guestPage.getByText(/Keine Admin-Berechtigung/).waitFor();
  assert.equal(await guestPage.locator('#list').locator('.game').count(),0);
  await guestPage.getByRole('link',{name:'Einmalige Admin-Ersteinrichtung'}).waitFor();
  const adminGuestField=guestPage.locator('#newForm input[name="organizer"]');
  const adminGuestFieldBox=await adminGuestField.boundingBox();
  assert.ok(adminGuestFieldBox.width>=250,'mobile admin form fields remain wide and not inline');

  // Real guest: participation must persist in this browser WITHOUT login or a D1 POST.
  await guestPage.goto(base+'/');
  const guestCards=guestPage.locator('#editorialLive .game');
  await guestCards.first().waitFor();
  assert.equal(await guestCards.count(),42);
  assert.equal(await guestPage.locator('#counter').innerText(),'42 Originalaktionen · 29 Bedingungen bestätigt');
  assert.equal(await guestPage.getByText(/davon .*D1/).count(),0);
  const firstMark=guestCards.first().locator('input[data-joined-contest]');
  assert.equal(await firstMark.isChecked(),false);
  assert.match(await guestPage.locator('#editorialProgress').innerText(),/0 von 42/);
  await firstMark.check();
  assert.match(await guestPage.locator('#editorialProgress').innerText(),/1 von 42/);
  assert.equal(await guestCards.first().evaluate(x=>x.classList.contains('joined-completed')),true);
  await guestPage.reload();
  await guestCards.first().waitFor();
  assert.equal(await guestCards.first().locator('input[data-joined-contest]').isChecked(),true);
  await guestPage.locator('#editorialOnlyOpen').check();
  assert.equal(await guestPage.evaluate(()=>localStorage.getItem('gewinnradar:guest:only-open:v1')),'1');
  await guestPage.reload();
  // A filtered, already-joined card remains in the DOM but is deliberately hidden.
  // Waiting for visibility here would incorrectly fail the browser regression test.
  await guestCards.first().waitFor({state:'attached'});
  assert.equal(await guestPage.locator('#editorialOnlyOpen').isChecked(),true,'Guest filter remains selected after reload');
  assert.equal(await guestCards.first().isVisible(),false);
  assert.equal(await guestCards.nth(1).isVisible(),true);
  await guestPage.locator('#editorialOnlyOpen').uncheck();
  await guestPage.reload();
  await guestCards.first().waitFor();
  assert.equal(await guestPage.locator('#editorialOnlyOpen').isChecked(),false,'Guest filter remains cleared after reload');
  await guestCards.first().locator('input[data-joined-contest]').uncheck();
  await guestPage.reload();
  await guestCards.first().waitFor();
  assert.equal(await guestCards.first().locator('input[data-joined-contest]').isChecked(),false);
  assert.match(await guestPage.locator('#editorialProgress').innerText(),/0 von 42/);
  const guestStorageKeys=await guestPage.evaluate(()=>Object.keys(localStorage));
  assert.ok(guestStorageKeys.every(k=>k.startsWith('gewinnradar:guest:completed:v1:')||k==='gewinnradar:guest:only-open:v1'||k==='gewinnradar:guest:editorial-expanded:v1'));
  await guest.close();
  const adminContext=await browser.newContext({viewport:{width:1280,height:900}});
  const adminPage=await adminContext.newPage();
  let savedEvidence=null,savedForm=null,savedLink=null;
  await adminPage.route('**/api/admin/**',route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    const response=(object,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(object)});
    if(path==='/api/admin/contests')return response({contests:[]});
    if(path==='/api/admin/readiness')return response({checked_at:'2026-11-21T12:00:00Z',ready:0,blocked:1,total:1,research:{total:65,candidates:47,excluded:18},contests:[{id:'pending',title:'Ungeprüfter Testkalender',ready:false,reasons:['Aktuelles Adventstürchen heute noch nicht geprüft']}]});
    if(path==='/api/admin/form-verification'&&route.request().method()==='POST'){
      const b=JSON.parse(route.request().postData());
      if(!['form_observed','correct_year','german_residents','no_marketing_required','no_purchase_required','no_account_or_app_obligation','no_unresolved_deadline_conflict'].every(k=>b[k]===true))return response({error:'Nicht alle Bedingungen erfüllt'},409);
      savedForm=b;return response({ok:true,form_review_recorded:true,contest_approved:false,reminder_approved:false},201);
    }
    if(path==='/api/admin/link-confirmation'&&route.request().method()==='POST'){
      const body=JSON.parse(route.request().postData());savedLink=body;
      return response({ok:true,link_confirmed:true,contest_approved:false},201);
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
  await adminPage.getByRole('button',{name:'Freigabereife prüfen'}).click();
  await adminPage.getByText('0 öffentlich sichtbar · 1 nicht öffentlich sichtbar. D1-Gewinnspiele: 1. Recherche separat: 47 Kandidaten, 18 ausgeschlossen. Keine automatische Veröffentlichung.').waitFor();
  await adminPage.getByText('Aktuelles Adventstürchen heute noch nicht geprüft').waitFor();
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
  await adminPage.locator('#verMethod').selectOption('email');
  assert.equal(await adminPage.locator('#emailEntryFields').isVisible(),true);
  await adminPage.locator('#verRecipient').fill('marketing@pilotpen.de');
  await adminPage.locator('#verSubject').fill('Live bestätigter Tagesbetreff');
  await adminPage.locator('#verSubjectToday').check();
  await adminPage.locator('#verifiedSave').click();
  await adminPage.getByText(/Noch keine Gewinnspiel-Freigabe und keine Erinnerungen/).waitFor();
  assert.equal(savedForm.entry_method,'email');
  assert.equal(savedForm.email_subject,'Live bestätigter Tagesbetreff');
  assert.equal(savedForm.email_subject_confirmed_today,true);
  await adminPage.locator('#linkConfirmId').fill('sample-2026');
  await adminPage.locator('#linkConfirmUrl').fill('https://www.br.de/gewinnspiel');
  await adminPage.locator('#linkConfirmNote').fill('Originalseite und ihren aktuellen Formularteil mit sämtlichen Prüfbedingungen separat kontrolliert.');
  await adminPage.locator('#linkConfirmationForm input[name=opened_original]').check();
  await adminPage.locator('#linkConfirmationForm input[name=checked_no_redirect]').check();
  await adminPage.locator('#linkConfirmationForm input[name=checked_live_entry]').check();
  await adminPage.locator('#linkConfirmSave').click();
  await adminPage.getByText(/Original-Link bestätigt und protokolliert/).waitFor();
  assert.equal(savedLink.game_id,'sample-2026');
  assert.equal(savedLink.checked_no_redirect,true);
  // Desktop admin inputs must stack instead of running into neighbouring labels.
  const adminInput=adminPage.locator('#newForm input[name="organizer"]');
  const adminLabel=adminInput.locator('xpath=..');
  const inputBox=await adminInput.boundingBox(),labelBox=await adminLabel.boundingBox();
  assert.ok(inputBox.width>350,'admin text fields should have usable width on desktop');
  assert.ok(inputBox.y>labelBox.y+15,'field must sit below its label rather than inline');
  assert.ok(await adminPage.locator('#adminAccessHelp').isVisible()===false,'authorized admin instructions stay hidden in normal test fixture');
  await adminPage.goto(base+'/admin/setup/');
  await adminPage.getByRole('heading',{name:'Ersten Admin-Zugang einrichten'}).waitFor();
  assert.equal(await adminPage.locator('#setupKey').getAttribute('type'),'password');
  assert.equal(await adminPage.locator('#setupKey').getAttribute('maxlength'),'64');
  await adminPage.goto(base+'/admin/recovery/');
  await adminPage.getByRole('heading',{name:'Vorhandenes Administratorkonto wiederherstellen'}).waitFor();
  assert.equal(await adminPage.locator('#recoverySecret').getAttribute('type'),'password');
  assert.equal(await adminPage.locator('#recoverySecret').getAttribute('maxlength'),'64');
  await adminPage.locator('#recoverySecret').fill('a'.repeat(64));
  await adminPage.getByRole('button',{name:'Vorhandenes Admin-Konto einmalig wiederherstellen'}).click();
  await adminPage.getByText(/Wiederherstellung verweigert/).waitFor();
  assert.equal(await adminPage.locator('#recoverySecret').inputValue(),'','The secret is cleared immediately after a denied request');
  // Disabled anonymous reporting must remain a clear non-submitting fallback.
  const reportPage=await browser.newPage();
  await reportPage.goto(base+'/melden/?id=bayern-digitalradio-2026');
  await reportPage.getByRole('heading',{name:'Gewinnspiel melden'}).waitFor();
  assert.equal(await reportPage.locator('#reportForm').isVisible(),false);
  await reportPage.getByText(/GitHub benutzen/).waitFor();
  assert.match(await reportPage.locator('#githubReport').getAttribute('href'),/bayern-digitalradio-2026/);
  await reportPage.close();
  await adminContext.close();
  console.log('Chromium senior/mobile+desktop, private login and denied admin UI: PASS');
}finally{await browser.close();await new Promise(ok=>server.close(ok))}

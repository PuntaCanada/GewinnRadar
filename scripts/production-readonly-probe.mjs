// Observational only: GET the two public endpoints, never send auth, cookies,
// forms, secrets or D1 queries. Designed to run on an independent GitHub runner.
const origin='https://gewinnradar.pages.dev';
const endpoints=['/api/catalog-status','/api/games'];
const report=[];
for(const path of endpoints){
 const item={endpoint:path,site:origin,status:'unknown'};
 try{
  const response=await fetch(origin+path,{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),
   headers:{accept:'application/json','user-agent':'GewinnRadar-Public-ReadOnly-Probe/1.0'}
  });
  item.http_status=response.status;
  const type=response.headers.get('content-type')||'';
  item.content_type=type.split(';')[0].trim().toLowerCase();
  const body=await response.text();
  let data;
  try{data=JSON.parse(body)}catch{}
  if(item.http_status===200&&item.content_type==='application/json'&&data&&typeof data==='object'){
   if(path==='/api/catalog-status'&&Number.isSafeInteger(data.visible_games)&&data.database_connected===true){
    item.status='ready';item.visible_games=data.visible_games;
   }else if(path==='/api/games'&&Array.isArray(data.games)){
    item.status='ready';item.visible_games=data.games.length;
   }else item.status='unexpected_json_shape';
  }else if(response.status===503&&item.content_type==='application/json')item.status='service_unavailable';
  else if(response.status===404)item.status='route_not_found';
  else if(response.status>=300&&response.status<400)item.status='redirect_review';
  else if(item.content_type==='text/html')item.status='html_instead_of_api_json';
  else item.status='unexpected_http_response';
 }catch(e){
  const cause=e?.cause?.code||e?.code||'';
  item.status=['ENOTFOUND','EAI_AGAIN'].includes(cause)?'dns_unresolved':e?.name==='TimeoutError'?'timeout':'network_error';
  item.error_code=String(cause).slice(0,50)||String(e?.name||'Error').slice(0,50);
 }
 report.push(item);
 console.log('PUBLIC_ENDPOINT_PROBE '+JSON.stringify(item));
}
const a=report[0],b=report[1];
if(a.status==='ready'&&b.status==='ready'){
 console.log('PUBLIC_ENDPOINT_COMPARISON '+JSON.stringify({matching_counts:a.visible_games===b.visible_games,status_api_count:a.visible_games,public_games_count:b.visible_games}));
}else{
 console.log('PUBLIC_ENDPOINT_COMPARISON unavailable: never interpret DNS, 404 or an incomplete API response as an empty D1 database');
}
// Diagnostic only. Never gate code quality/merges on a third-party DNS or HTTP hiccup.

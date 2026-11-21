import {publicContestUrl} from './urls.js';
const ascii=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():'';
export function canonicalContestUrl(url){
 if(!publicContestUrl(url))return null;
 const u=new URL(url);
 u.hash='';u.username='';u.password='';
 u.hostname=u.hostname.toLowerCase().replace(/\.$/,'');
 if(u.port==='443')u.port='';
 for(const name of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$|mc_|ref$|source$|cmpid$)/i.test(name))u.searchParams.delete(name);
 u.searchParams.sort();
 if(u.pathname!=='/')u.pathname=u.pathname.replace(/\/+$/,'');
 return u.toString();
}
export function catalogKey(entry){
 const url=canonicalContestUrl(entry.url);
 if(!url || !Number.isInteger(entry.year)||entry.year<2026||entry.year>2100)return null;
 return entry.year+':'+url;
}
export function validateResearch(entry){
 if(!entry || typeof entry!=='object'||Array.isArray(entry))return {error:'Kein Datensatz'};
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(entry.id||''))return {error:'Ungültige ID'};
 if(!['candidate','excluded'].includes(entry.state))return {error:'Unzulässiger Status'};
 if(entry.human_approved!==false||entry.allowed_for_reminders!==false||entry.verified_at!==null)return {error:'Rechercheeintrag darf nicht als freigegeben markiert sein'};
 if(!['daily','specific_dates','single','social_posts'].includes(entry.cadence))return {error:'Unbekannte Teilnahmehäufigkeit'};
 if(!['low','medium','higher','blocked'].includes(entry.privacy_tier))return {error:'Ungeprüftes Datenschutzlevel'};
 if(entry.state==='excluded'&&entry.privacy_tier!=='blocked')return {error:'Ausschlussstatus unklar'};
 if(entry.state==='candidate'&&entry.privacy_tier==='blocked')return {error:'Gesperrte Einträge müssen ausgeschlossen werden'};
 for(const k of ['organizer','title','prize','required_data','review_note'])if(!ascii(entry[k],1000))return {error:'Text fehlt: '+k};
 for(const k of ['url','terms_url','source_url'])if(!publicContestUrl(entry[k]))return {error:'Unsichere oder fehlende URL: '+k};
 if(!/^\d{4}-\d\d-\d\d$/.test(entry.starts_on)||!/^\d{4}-\d\d-\d\d$/.test(entry.ends_on))return {error:'Datumsformat ungültig'};
 if([entry.starts_on,entry.ends_on].some(s=>{const d=new Date(s+'T12:00:00Z');return !Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s;}))return {error:'Ungültiges Kalenderdatum'};
 if(entry.starts_on>entry.ends_on || !entry.starts_on.startsWith(String(entry.year)))return {error:'Zeitraum widersprüchlich'};
 if(entry.cadence==='specific_dates'&&(!Array.isArray(entry.eligible_dates)||!entry.eligible_dates.length||entry.eligible_dates.some(x=>!Number.isInteger(x)||x<1||x>31)))return {error:'Teilnahmetage fehlen'};
 return {value:entry,key:catalogKey(entry)};
}
export function auditResearch(entries){
 if(!Array.isArray(entries)||entries.length>1000)return {ok:false,errors:['Ungültige Kataloggröße']};
 const seenId=new Set(),seenKey=new Set(),errors=[];
 for(const [i,e] of entries.entries()){
  const check=validateResearch(e);
  if(check.error){errors.push(i+': '+check.error);continue}
  if(seenId.has(e.id))errors.push(i+': doppelte ID '+e.id);
  if(seenKey.has(check.key))errors.push(i+': doppelte Original-URL/Jahr '+check.key);
  seenId.add(e.id);seenKey.add(check.key);
 }
 return {ok:errors.length===0,total:entries.length,candidates:entries.filter(e=>e.state==='candidate').length,excluded:entries.filter(e=>e.state==='excluded').length,errors};
}
export function eligibleToday(entry,today){
 if(!/^\d{4}-\d\d-\d\d$/.test(today)||entry.state!=='candidate'||entry.privacy_tier==='blocked'||today<entry.starts_on||today>entry.ends_on)return false;
 if(entry.cadence==='specific_dates')return entry.eligible_dates.includes(Number(today.slice(-2)));
 return true;
}

// Not all calendar-related prizes are daily calendars. Used by daily reminder planning.
export function dailyDoor(entry,day){
 if(!eligibleToday(entry,day))return false;
 if(entry.cadence==='single'||entry.cadence==='social_posts')return false;
 return true;
}


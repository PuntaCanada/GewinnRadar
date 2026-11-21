// Persist an explicitly reviewed, manual E-mail entry route inside the existing
// required_fields column. No DB migration, no outbound mail and no implicit approval.
export const EMAIL_PREFIX='EMAIL_ENTRY_V1:';
const email=/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
export function encodeEmailEntry(input,source){
 if(input.entry_method!=='email')return {error:'Kein E-Mail-Teilnahmeweg'};
 if(input.email_subject_confirmed_today!==true)return {error:'Der exakte Betreff muss im aktuellen Tages-Türchen bestätigt sein'};
 const to=typeof input.email_recipient==='string'?input.email_recipient.trim().toLowerCase():'';
 const subject=typeof input.email_subject==='string'?input.email_subject.trim():'';
 const fields=typeof input.required_fields==='string'?input.required_fields.trim():'';
 if(!email.test(to)||to.length>254||/[\r\n;]/.test(to))return {error:'Bestätigte Empfänger-Adresse fehlt'};
 if(subject.length<3||subject.length>160||/[\r\n]/.test(subject))return {error:'Exakter Betreff des aktuellen Tages fehlt'};
 if(fields.length<3||fields.length>200)return {error:'Erforderliche Angaben fehlen'};
 // The recipient domain must belong to the organizer's original website.
 // Example: www1.wdr.de may legitimately specify wdr3@wdr.de.
 const host=new URL(source).hostname.toLowerCase(),domain=to.split('@')[1];
 if(!(host===domain||host.endsWith('.'+domain)))return {error:'E-Mail-Domain gehört nicht zur Originalquelle'};
 const value=EMAIL_PREFIX+JSON.stringify({to,subject,fields});
 if(value.length>500)return {error:'E-Mail-Nachweis zu lang'};
 return {value};
}
export function decodeEmailEntry(value){
 if(typeof value!=='string'||!value.startsWith(EMAIL_PREFIX))return null;
 try{const x=JSON.parse(value.slice(EMAIL_PREFIX.length));return x&&email.test(x.to)&&typeof x.subject==='string'&&x.subject.length>=3&&typeof x.fields==='string'?x:null}catch{return null}
}

// One fail-closed publication gate shared by the public list and private progress writes.
// Both human review and the separate live form review must still be valid.
export const verifiedJoins = " JOIN contest_evidence e ON e.game_id=g.id JOIN form_verifications fv ON fv.game_id=g.id";
export const verifiedConditions = [
 "g.status='verified'","g.link_state='ok'","g.verified_at IS NOT NULL",
 "e.original_checked=1","e.terms_checked=1","e.privacy_checked=1",
 "e.germany_eligible=1","e.no_mandatory_marketing=1","e.no_payment_required=1","e.human_verified=1",
 "fv.form_observed=1","fv.correct_year=1","fv.german_residents=1",
 "fv.no_marketing_required=1","fv.no_purchase_required=1",
 "fv.no_account_or_app_obligation=1","fv.no_unresolved_deadline_conflict=1",
 "fv.privacy_url=g.privacy_url","fv.checked_at>=?","fv.checked_at<=?",
 "(g.daily=0 OR fv.checked_at>=?)"
].join(' AND ');
export function formReviewWindow(now=new Date()){
 const to=now.toISOString();
 const from=new Date(now.getTime()-7*86400000).toISOString();
 return [from,to,berlinDayStart(now)];
}

export function berlinDayStart(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const midnightUTC=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'}).format(new Date(midnightUTC)));
 if(!Number.isInteger(hour)||hour<0||hour>3)throw Error('Berlin day boundary unavailable');
 return new Date(midnightUTC-hour*3600000).toISOString();
}

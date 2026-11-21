import test from 'node:test';
import assert from 'node:assert/strict';
import {validateContest,validateEvidence,safeAdmin} from '../functions/_lib/contest-review.js';
import {emailAddress,loginAllowed,LOGIN_RESPONSE,loginBucket} from '../functions/_lib/login-safety.js';

const valid=()=>({id:'advent-2026-demo',organizer:'Seriöser Veranstalter',title:'Gewinnspiel im Advent 2026',prize:'Gutschein',url:'https://www.example.org/advent',terms_url:'https://www.example.org/terms',privacy_url:'https://www.example.org/privacy',starts_at:'2026-12-01T00:00:00Z',ends_at:'2026-12-24T23:59:59Z',daily:true,required_data:'Name und separate E-Mail'});
test('new contests are validated but never implicitly approved',()=>{const r=validateContest(valid(),new Date('2026-11-20'));assert.ok(r.value);assert.equal(r.value.status,undefined);});
test('reject invalid URLs, dates and incomplete fields',()=>{for(const patch of [{url:'http://bad.test'},{ends_at:'2026-01-01T00:00:00Z'},{daily:null},{required_data:''},{title:'x'},{starts_at:'whatever'}])assert.ok(validateContest({...valid(),...patch},new Date('2026-11-20')).error);});
test('approval requires all checks and current verification',()=>{
 const approve={id:'advent-2026-demo',action:'approve',note:'Originale Bedingungen und Angaben vom Veranstalter geprüft',checked_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z')};
 assert.ok(validateEvidence(approve).error);
 const complete={...approve,original_checked:true,terms_checked:true,privacy_checked:true,germany_eligible:true,no_mandatory_marketing:true,no_payment_required:true,human_verified:true};
 assert.ok(validateEvidence(complete).value);
 assert.ok(validateEvidence({...complete,no_mandatory_marketing:false}).error);
 assert.ok(validateEvidence({...complete,checked_at:'2020-01-01T00:00:00Z'}).error);
});
test('reviewer must be a verified admin',()=>{assert.equal(safeAdmin({role:'member',email_verified:1}),false);assert.equal(safeAdmin({role:'admin',email_verified:0}),false);assert.equal(safeAdmin({role:'admin',email_verified:1}),true)});
test('login requires explicit opt-in and configured secret',()=>{
 assert.equal(loginAllowed({LOGIN_MAIL_ENABLED:'true',LOGIN_RATE_SALT:'x'.repeat(32),BREVO_API_KEY:'a',SENDER_EMAIL:'a@b.de',DB:{}}),true);
 assert.equal(loginAllowed({LOGIN_MAIL_ENABLED:'false',LOGIN_RATE_SALT:'x'.repeat(32),BREVO_API_KEY:'a',SENDER_EMAIL:'a@b.de',DB:{}}),false);
 assert.equal(loginAllowed({LOGIN_MAIL_ENABLED:'true',LOGIN_RATE_SALT:'short',BREVO_API_KEY:'a',SENDER_EMAIL:'a@b.de',DB:{}}),false);
 assert.equal(emailAddress(' TEST@EXAMPLE.COM '),'test@example.com');
 assert.equal(emailAddress('bad'),null);
 assert.match(LOGIN_RESPONSE,/Falls/);
 assert.equal(loginBucket(new Date('2026-11-21T09:00:00Z')),'2026-11-21T09');
});

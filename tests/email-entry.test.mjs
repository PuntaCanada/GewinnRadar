import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeEmailEntry,decodeEmailEntry,EMAIL_PREFIX} from '../functions/_lib/email-entry.js';
const valid={entry_method:'email',email_recipient:'marketing@pilotpen.de',email_subject:'Bestätigter Tagesbetreff 1. Dezember',required_fields:'Absender-E-Mail'};
test('manual E-mail entry is encoded and decoded without sending or inventing a participation action',()=>{
 const checked=encodeEmailEntry(valid,'https://www.pilotpen.de/TNB-Adventskalender');
 assert.ok(checked.value,checked.error);
 assert.ok(checked.value.startsWith(EMAIL_PREFIX));
 assert.deepEqual(decodeEmailEntry(checked.value),{to:'marketing@pilotpen.de',subject:valid.email_subject,fields:'Absender-E-Mail'});
});
test('reject guessed or empty daily subject and unrelated E-mail recipient',()=>{
 for(const changes of [{email_subject:''},{email_subject:'x'},{email_subject:'Foo\r\nBcc: someone@example.org'},{email_recipient:'fake@evil.net'},{email_recipient:'not-an-email'}]){
  assert.ok(encodeEmailEntry({...valid,...changes},'https://www.pilotpen.de/TNB-Adventskalender').error);
 }
 assert.ok(encodeEmailEntry({...valid,email_recipient:'wdr3@wdr.de'},'https://www1.wdr.de/radio/wdr3/').value);
});
test('forged or malformed email instructions are not interpreted',()=>{
 assert.equal(decodeEmailEntry('web form'),null);
 assert.equal(decodeEmailEntry(EMAIL_PREFIX+'{invalid'),null);
});

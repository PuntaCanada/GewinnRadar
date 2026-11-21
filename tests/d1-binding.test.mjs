import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const files=['wrangler.toml','worker/wrangler.toml'];
const uuidPattern=/^database_id\s*=\s*"([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"\s*$/m;
test('Both GewinnRadar D1 bindings contain the same real UUID, never placeholders',()=>{
  const ids=files.map(file=>{
    const content=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(content,/REPLACE_WITH|YOUR_DATABASE|00000000-0000-0000-0000-000000000000/);
    assert.match(content,/database_name\s*=\s*"gewinnradar"/);
    assert.match(content,/binding\s*=\s*"DB"/);
    const match=content.match(uuidPattern);
    assert.ok(match, file+' does not contain a valid UUID');
    return match[1];
  });
  assert.equal(ids[0],ids[1]);
});
test('Mail workers are not enabled by Wrangler settings',()=>{
  for(const file of files){
    const content=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(content,/MAIL_ENABLED\s*=\s*["']?true/);
    assert.doesNotMatch(content,/LOGIN_MAIL_ENABLED\s*=\s*["']?true/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createBootstrapSql,prepareLocalFile} from '../scripts/prepare-admin-bootstrap.mjs';

test('offline first-admin SQL creates exactly one unverified admin without mail or session',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const statement=createBootstrapSql({email:'  test@example.invalid  ',name:"Test O'Neil",id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'});
 db.exec(statement);
 const user=db.prepare('SELECT id,email,display_name,role,senior_mode,daily_email,email_verified,consent_at FROM users').get();
 assert.deepEqual(user,{id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',email:'test@example.invalid',display_name:"Test O'Neil",role:'admin',senior_mode:1,daily_email:0,email_verified:0,consent_at:null});
 db.exec(statement);assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,1);
 for(const table of ['sessions','login_tokens','email_log'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,0);
 db.close();
});
test('existing accounts cannot be bypassed by a different bootstrap statement',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 db.exec(createBootstrapSql({email:'first@example.invalid',name:'First Admin',id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}));
 db.exec(createBootstrapSql({email:'second@example.invalid',name:'Second Admin',id:'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee'}));
 assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,1);
 db.close();
});
test('invalid mail and control characters rejected; no repository outputs or implicit file creation',()=>{
 assert.throws(()=>createBootstrapSql({email:'bad',name:'A Name'}),/Valid email/);
 assert.throws(()=>createBootstrapSql({email:'test@example.invalid',name:'\nRoot'}),/Valid email/);
 assert.throws(()=>prepareLocalFile({env:{},args:[]}),/Usage:/);
 assert.throws(()=>prepareLocalFile({env:{GEWINNRADAR_ADMIN_EMAIL:'test@example.invalid',GEWINNRADAR_ADMIN_NAME:'Test'},args:['--output','./bootstrap.sql']}),/outside the Git repository/);
});

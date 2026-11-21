import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleGames} from '../public/filters.js';
const rows=[
 {id:'z',title:'Zebra',organizer:'Sender',prize:'Radio',ends_at:'2026-12-24T12:00:00Z',daily:0},
 {id:'a',title:'Apfel',organizer:'Laden',prize:'Tasche',ends_at:'2026-12-01T12:00:00Z',daily:1},
 {id:'m',title:'Mango',organizer:'Radio',prize:'Buch',ends_at:'2026-12-12T12:00:00Z',daily:0}
];
test('public ordering defaults to ending soon, title option sorts alphabetically',()=>{
 assert.deepEqual(visibleGames(rows).map(x=>x.id),['a','m','z']);
 assert.deepEqual(visibleGames(rows,{sort:'title'}).map(x=>x.id),['a','m','z']);
 assert.deepEqual(rows.map(x=>x.id),['z','a','m'],'filter must not mutate API source data');
});
test('sorting remains compatible with search, daily and account-only filters',()=>{
 assert.deepEqual(visibleGames(rows,{query:'radio'}).map(x=>x.id),['m','z']);
 assert.deepEqual(visibleGames(rows,{dailyOnly:true}).map(x=>x.id),['a']);
 assert.deepEqual(visibleGames(rows,{status:'favorite'}),[]);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {simpleParticipation,visibleGames} from '../public/filters.js';
const games=[
 {id:'a',required_data:'E-Mail und Name',daily:1,completed:0,favorite:1},
 {id:'b',required_data:'Name, Anschrift und Telefonnummer',daily:1,completed:0,favorite:0},
 {id:'c',required_data:'Instagram Account',daily:0,completed:1,favorite:1},
 {id:'d',required_data:'Unbekannt',daily:1,completed:0,favorite:0}
];
test('conservative easy and daily filters',()=>{
 assert.equal(simpleParticipation(games[0]),true);
 assert.equal(simpleParticipation(games[1]),false);
 assert.equal(simpleParticipation(games[2]),false);
 assert.equal(simpleParticipation(games[3]),false);
 assert.deepEqual(visibleGames(games,{simpleOnly:true}).map(x=>x.id),['a']);
 assert.deepEqual(visibleGames(games,{dailyOnly:true,status:'favorite'}).map(x=>x.id),['a']);
 assert.deepEqual(visibleGames(games,{status:'done'}).map(x=>x.id),['c']);
});

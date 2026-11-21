import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleGames} from '../public/filters.js';

const games=[
 {title:'Adventskalender',organizer:'Radio Berlin',prize:'Kopfhörer'},
 {title:'Winterverlosung',organizer:'Kulturhaus',prize:'Reise'}
];
test('public keyword search matches prize, organizer and title without account',()=>{
 assert.deepEqual(visibleGames(games,{query:'KOPFHÖRER'}),[games[0]]);
 assert.deepEqual(visibleGames(games,{query:'radio'}),[games[0]]);
 assert.deepEqual(visibleGames(games,{query:'reise'}),[games[1]]);
 assert.deepEqual(visibleGames(games,{query:'unbekannt'}),[]);
 assert.deepEqual(visibleGames(games,{query:'  '}),games);
});

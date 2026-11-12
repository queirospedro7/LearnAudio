import {test} from 'node:test';import assert from 'node:assert/strict';
import {wordTimings} from '../src/speech-timing.js';
const word=(text,offset,duration=2000000)=>({Type:'WordBoundary',Data:{Offset:offset,Duration:duration,text:{Text:text}}});
test('maps repeated words in order and converts service ticks to seconds',()=>{
 const data=wordTimings('Olá, mundo. Olá outra vez.',[word('Olá',1000000),word('mundo',5000000),word('Olá',12000000)]);
 assert.deepEqual(data.map(w=>[w.start,w.end,w.time]),[[0,3,.1],[5,10,.5],[12,15,1.2]]);assert.equal(data[0].duration,.2);
});
test('missing and invalid metadata never invent a word location',()=>{
 assert.deepEqual(wordTimings('25 euros.',[word('vinte',0),word('euros',-1),word('euros','bad')]),[]);
});
test('handles XML escaping and ignores sentence events',()=>{
 const data=wordTimings('A & B.',[word('A',0),word('&amp;',1000000),{Type:'SentenceBoundary',Data:{}},word('B',2000000)]);assert.equal(data.length,3);assert.equal(data[1].start,2);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {StableFollower} from '../public/js/stable-follow.js';
const viewport={top:0,bottom:500};
test('changing a sentence inside the viewport never recentres the reader',()=>{const f=new StableFollower();assert.equal(f.delta({top:100,bottom:125},viewport,0,0),0);assert.equal(f.delta({top:220,bottom:245},viewport,100,500),0);assert.equal(f.delta({top:60,bottom:85},viewport,200,1000),0);});
test('active follow restores a passage scrolled completely out of view',()=>{const f=new StableFollower();f.delta({top:200,bottom:225},viewport,0,0);assert.ok(f.delta({top:-100,bottom:-75},viewport,100,1000)<0);assert.equal(f.delta({top:60,bottom:85},viewport,100,1500),0);});
test('advances near the bottom in measured steps with no repeated animation restart',()=>{const f=new StableFollower();f.delta({top:100,bottom:125},viewport,0,0);assert.ok(f.delta({top:450,bottom:480},viewport,100,1000)>0);assert.equal(f.delta({top:455,bottom:485},viewport,120,1016),0);});
test('an explicit backwards jump or return-to-reading may reveal an earlier line',()=>{const f=new StableFollower();f.delta({top:100,bottom:125},viewport,100,0);assert.ok(f.delta({top:-90,bottom:-65},viewport,0,1000)<0);f.reset();assert.ok(f.delta({top:-70,bottom:-45},viewport,0,2000)<0);});

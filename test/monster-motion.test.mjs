import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chaseMonster,gasExposure} from '../docs/src/monster-motion.js';
const open=()=>false;
test('chaser closes distance without overlapping the player',()=>{
 const monster={x:0,z:12},target={x:0,z:0};
 for(let i=0;i<300;i++)chaseMonster(monster,target,1/60,open);
 assert.ok(monster.z<3);assert.ok(monster.z>=2.05-1e-8);
});
test('large chaser cannot cross a thin wall even with a delayed frame',()=>{
 const monster={x:0,z:4},target={x:0,z:-10};
 const wall=(x,z,r)=>Math.abs(z)<r+.04;
 for(let i=0;i<100;i++)chaseMonster(monster,target,.8,wall);
 assert.ok(monster.z>=1.39);
});
test('gas respects walls, altitude, vehicle protection and range',()=>{
 const cloud={x:0,z:0,radius:4},target={x:2,z:0,y:0};
 assert.equal(gasExposure(cloud,target,1,false,open),true);
 assert.equal(gasExposure(cloud,target,1,true,open),false);
 assert.equal(gasExposure(cloud,{...target,y:10},1,false,open),false);
 assert.equal(gasExposure(cloud,{...target,x:5},1,false,open),false);
 assert.equal(gasExposure(cloud,target,1,false,x=>x>.9&&x<1.4),false);
});

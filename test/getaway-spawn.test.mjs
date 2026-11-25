import test from 'node:test';
import assert from 'node:assert/strict';
import {getawayStart} from '../docs/src/getaway-spawn.js';

test('the opening chase leaves space beyond the bumper and beside the cruiser',()=>{
 const free=()=>false;
 const ride={x:3.6,z:-10},lead={x:-4.4,z:-30};
 const original=getawayStart([ride,lead],ride,lead,free);
 assert.equal(original.z,-59);
 for(const obstacle of [
   {x:3.7,z:original.z-13,a:0,speed:0},
   {x:20,z:original.z-14,a:Math.PI/2,traffic:true,speed:9},
   {x:original.copX,z:original.copZ,a:0}
 ]){
   assert.notDeepEqual(getawayStart([ride,lead,obstacle],ride,lead,free),original);
 }
});

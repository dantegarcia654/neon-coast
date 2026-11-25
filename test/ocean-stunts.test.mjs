import assert from 'node:assert/strict';
import {test} from 'node:test';
import {register} from 'node:module';
const threeURL=new URL('../docs/vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export function resolve(id,context,next){return id==='three'?{url:${JSON.stringify(threeURL)},shortCircuit:true}:next(id,context)}`));
const T=await import('three');
const {createOceanRoutes,desertContains}=await import('../docs/src/ocean-routes.js');
const {installOceanStunts}=await import('../docs/src/ocean-stunts.js');
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
function setup(){
 const world={scene:new T.Scene(),camera:new T.PerspectiveCamera(),colliders:[],cameraObstacles:[],getGroundHeight:()=>0,isWaterWalkway:()=>false,districtAt:()=> 'CITY'};
 const ocean=installOceanStunts(world,{notify:()=>{}});
 const car={g:new T.Group(),spec:{},x:0,z:0,a:0,speed:0};return {world,ocean,car};
}
test('all three branches join the same bridge and desert approach without gaps',()=>{
 const roads=createOceanRoutes();
 for(const r of roads.slice(1,4)){
  assert.ok(r.at(0).p.distanceTo(roads[0].at(roads[0].length).p)<.001);
  assert.ok(r.at(r.length).p.distanceTo(roads[4].at(0).p)<.001);
  for(const f of r.frames){assert.ok(f.p.toArray().every(Number.isFinite));assert.ok(Math.abs(f.q.length()-1)<1e-6);assert.ok(Math.abs(f.up.dot(f.forward))<1e-6)}
 }
 assert.ok(desertContains(roads[4].at(roads[4].length).p.x,-144));
 assert.equal(desertContains(1100,-144),false);
});
test('loop and corkscrew really invert the car and return upright',()=>{
 for(const r of createOceanRoutes().slice(2,4)){
  assert.ok(r.frames.some(f=>f.up.y<-.8),r.name);
  assert.ok(r.at(r.length).up.y>.9,r.name);
 }
});
test('each selected route can be driven to town and retried without leftover stunt state',()=>{
 for(let selected=0;selected<3;selected++){
  const {ocean,car,world}=setup();ocean.start(car);ocean.choose(selected);let inverted=false;
  for(let i=0;i<2000&&ocean.active;i++){ocean.update(car,.04,{KeyW:true});inverted ||=ocean.state().inverted;}
  assert.equal(ocean.active,false);assert.equal(car.stunt,false);assert.equal(car.y,undefined);
  assert.equal(ocean.state().trips,1);assert.equal(ocean.state().completed.length,1);assert.equal(world.districtAt(car.x,car.z),'CACTUS CROSSING');
  if(selected){assert.equal(inverted,true);assert.equal(ocean.state().invertedTracks.length,1);}
  assert.equal(ocean.recover(car),true);assert.equal(ocean.active,true);ocean.reset();assert.equal(ocean.active,false);assert.equal(car.stunt,false);
 }
});
test('pause freezes distance and brakes stop; track exit and island have valid ground',()=>{
 const {ocean,car,world}=setup();ocean.start(car);
 for(let i=0;i<100;i++)ocean.update(car,.04,{KeyW:true});
 const before=ocean.state().distance;ocean.update(car,0,{KeyW:true});assert.equal(ocean.state().distance,before);
 for(let i=0;i<100;i++)ocean.update(car,.04,{Space:true});assert.equal(car.speed,0);
 assert.equal(world.getGroundHeight(860,-144),3.2);assert.equal(ocean.contains(860,-144,1),true);assert.equal(ocean.contains(1000,0),false);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {register} from 'node:module';
const threeURL=new URL('../docs/vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export function resolve(id,context,next){return id==='three'?{url:${JSON.stringify(threeURL)},shortCircuit:true}:next(id,context)}`));
const {Scene}=await import('three');
const {createFartaculous}=await import('../docs/src/fartaculous.js');
function setup(blocked=()=>false){
 const world={scene:new Scene(),getGroundHeight:()=>0},messages=[];let damage=0;
 const monster=createFartaculous(world,{blocked,notify:m=>messages.push(m),sound:()=>{},hurt:n=>damage+=n});
 return {world,monster,messages,damage:()=>damage};
}
const target={x:0,z:0};
const advance=(m,seconds,car=false)=>{for(let i=0;i<seconds*60;i++)m.update(1/60,target,car)};
test('encounter chases, telegraphs, emits clouds and spawns its friend once',()=>{
 const {monster}=setup();monster.start(target,true);
 const before=monster.state().actors[0];advance(monster,4.2);
 assert.equal(monster.state().actors[0].winding,true);advance(monster,2);
 const after=monster.state();
 assert.ok(Math.hypot(after.actors[0].x,after.actors[0].z)<Math.hypot(before.x,before.z));
 assert.ok(after.bursts>=1);assert.equal(after.actors[1].visible,true);assert.equal(after.actors.length,2);
 const frozen=JSON.stringify(monster.state());monster.update(0,target,false);assert.equal(JSON.stringify(monster.state()),frozen);
});
test('gas damages on foot at a bounded rate, protects vehicles, and clears on stop',()=>{
 const foot=setup(),vehicle=setup();
 foot.monster.start(target,true);vehicle.monster.start(target,true);
 advance(foot.monster,18);advance(vehicle.monster,18,true);
 assert.ok(foot.damage()>0);assert.ok(foot.damage()<=18*6);assert.equal(vehicle.damage(),0);
 foot.monster.stop();const s=foot.monster.state();assert.equal(s.active,false);assert.equal(s.clouds,0);assert.ok(s.actors.every(a=>!a.visible));
});
test('weapons defeat monsters; restart restores health; disabled or blocked spawns stay hidden',()=>{
 const {monster,world}=setup();monster.start(target,true);
 for(let i=0;i<6;i++)world.enemies[0].hit('rocket');
 assert.equal(monster.state().actors[0].health,0);assert.equal(monster.state().actors[0].visible,false);
 monster.start(target,true);assert.equal(monster.state().actors[0].health,12);
 monster.start(target,false);assert.equal(monster.state().active,false);
 const trapped=setup(()=>true);trapped.monster.start(target,true);assert.equal(trapped.monster.state().active,false);
});
test('live weapon raycasts hit the large enemy and ignore it when hidden',async()=>{
 const {createImpactSurfaces}=await import('../docs/src/impact-surfaces.js');
 const {Ray,Vector3}=await import('three');
 const {world,monster}=setup();Object.assign(world,{shotSurfaces:[],cars:[],cops:[],pedestrians:[],footOfficers:[]});
 const surfaces=createImpactSurfaces(world);monster.start(target,true);
 const boss=world.enemies[0];
 const ray=new Ray(new Vector3(boss.x,3.5,boss.z+10),new Vector3(0,0,-1));
 const hit=surfaces.cast(ray,20);assert.equal(hit.civilian,boss);
 hit.civilian.hit('rocket');assert.equal(boss.hp,10);
 monster.stop();assert.equal(surfaces.cast(ray,20),null);
});

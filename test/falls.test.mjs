import assert from "node:assert/strict";
import {test} from "node:test";
import {register} from "node:module";

// Use the same Three.js module that the browser's import map selects.
const threeURL=new URL("../docs/vendor/three.module.js",import.meta.url).href;
register("data:text/javascript,"+encodeURIComponent(`
  export function resolve(id,context,next) {
    return id==="three" ? {url:${JSON.stringify(threeURL)},shortCircuit:true} : next(id,context);
  }
`));
const {Group}=await import("three");
const {beginBodyReaction,beginPedestrianImpact,updatePedestrianImpact}=await import("../docs/src/pedestrian-impact.js");
const open=()=>false, ground=()=>0;
function actor(){
  return {root:new Group(),arms:[new Group(),new Group()],legs:[new Group(),new Group()],
    x:0,z:0,phase:0,behavior:"fight"};
}
function observe(n){
  let peak=0,maxTravel=0;
  for(let i=0;n.impact && i<600;i++){
    updatePedestrianImpact(n,1/120,i/120,ground);
    peak=Math.max(peak,n.impact?.y||0);
    maxTravel=Math.max(maxTravel,n.impact?.x||0);
  }
  assert.equal(n.impact,null);
  assert.equal(n.root.position.y,0);
  assert.equal(n.root.rotation.z,0);
  for(const joint of [...n.arms,...n.legs])assert.equal(joint.rotation.x,0);
  return {peak,maxTravel};
}
test("finishing punches fold on the ground, traffic carries low, and close blasts lift",()=>{
  const punch=actor(),car=actor(),blast=actor();
  beginBodyReaction(punch,1,0,2.7,2.6,open,3.1,"punch");
  beginPedestrianImpact(car,15,0,open);
  beginBodyReaction(blast,1,0,11,5.9,open,.9,"blast");
  const a=observe(punch),b=observe(car),c=observe(blast);
  assert.equal(a.peak,0);
  assert.ok(b.peak>.10 && b.peak<c.peak*.5);
  assert.ok(b.maxTravel>a.maxTravel*2);
  assert.ok(c.peak>.8);
});
test("a second bumper can redirect a grounded body without resetting its pose or launching it",()=>{
  const n=actor();
  beginPedestrianImpact(n,15,0,open);
  for(let i=0;i<94;i++)updatePedestrianImpact(n,1/120,i/120,ground);
  const before=n.root.quaternion.clone(),x=n.impact.x;
  beginPedestrianImpact(n,0,15,open);
  updatePedestrianImpact(n,1/120,.8,ground);
  assert.ok(before.angleTo(n.root.quaternion)<.04);
  assert.ok(Math.abs(n.impact.x-x)<.05 && n.impact.vz>0);
  assert.ok(observe(n).peak<.05);
});

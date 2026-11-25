import { test } from "node:test";
import assert from "node:assert/strict";
import { slide, blastWeight, facingAttacker } from "../docs/src/impact-motion.js";

test("a knockback slide stops at a wall but continues along its face", () => {
  const body={x:0,z:0}, motion={vx:16,vz:8};
  slide(body,motion,.4,3.2,(x)=>x>.95);
  assert.ok(body.x<=.95 && body.x>.75);
  assert.equal(motion.vx,0);
  assert.ok(body.z>1.7);
});

test("the same impulse travels equally far at 30 and 120 frames per second", () => {
  function simulate(fps) {
    const body={x:1,z:2}, motion={vx:9,vz:-7};
    for(let i=0;i<fps;i++) slide(body,motion,1/fps,3.2,()=>false);
    return body;
  }
  const a=simulate(30), b=simulate(120);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-8);
});

test("blast strength falls smoothly to zero at the edge", () => {
  assert.equal(blastWeight(0,5.5),1);
  assert.equal(blastWeight(2.75,5.5),.5);
  assert.ok(blastWeight(5,5.5)<.025);
  assert.equal(blastWeight(6,5.5),0);
});

test("a raised guard protects against strikes from the facing direction", () => {
  assert.ok(facingAttacker(0, .45,-1));
  assert.equal(facingAttacker(0,0,1),false);
  assert.equal(facingAttacker(Math.PI/2,0,1),false);
  assert.ok(facingAttacker(Math.PI/2,-1,.2));
});

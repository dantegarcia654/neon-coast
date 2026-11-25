import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collisionImpulse,
  hullBlocked,
  impactDamage,
  moveVehicle,
  velocity,
} from "../docs/src/crash.js";

function car(speed, a = 0) {
  return { x: 0, z: 0, a, speed, slip: 0, spec: { length: 4.5 } };
}
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
}

test("a front bumper stops before a thin post, including at top speed", () => {
  const c = car(52),
    post = (x, z, r) => Math.abs(z + 3) < 0.09 + r && Math.abs(x) < 0.09 + r;
  const impact = moveVehicle(c, 0.04, (x, z) => hullBlocked(c, x, z, 1, post));
  near(impact, 52);
  assert.ok(c.z > -1);
  assert.ok(c.speed < 0);
  assert.equal(hullBlocked(c, c.x, c.z, 1, post), false);
});
test("a glancing contact preserves travel along the wall and costs less health", () => {
  const c = car(30);
  c.slip = 5;
  const impact = moveVehicle(c, 0.04, (x) => x > 0.1);
  near(impact, 5);
  near(velocity(c).z, -30);
  near(c.z, -1.2);
  assert.ok(c.slip < 0);
  assert.ok(impactDamage(impact) < impactDamage(30) / 10);
});
test("traffic impacts use relative closing velocity", () => {
  const c = car(20),
    parallel = car(20);
  parallel.traffic = true;
  near(collisionImpulse(c, parallel, 0, 1), 0);
  near(c.speed, 20);
  const oncoming = car(20, Math.PI);
  oncoming.traffic = true;
  near(collisionImpulse(c, oncoming, 0, 1), 40);
  assert.ok(c.speed < 0);
  assert.ok(oncoming.speed < 0);
  near(collisionImpulse(c, oncoming, 0, 1), 0);
});
test("reverse and low-speed contacts stop against the correct end of the car", () => {
  const c = car(-2);
  near(
    moveVehicle(c, 0.04, (x, z) => z > 0.03),
    2,
  );
  near(c.speed, 0);
  near(impactDamage(2), 0);
});

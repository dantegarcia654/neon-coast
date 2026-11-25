import { test } from "node:test";
import assert from "node:assert/strict";
import { insideCar, sweptContact } from "../docs/src/traffic-contact.js";
const car = { x: 0, z: 0, a: 0, spec: { length: 4.5 } };
test("a single large step detects the front bumper before passing the player", () => {
  const t = sweptContact(car, 0, -12, 0, -6);
  assert.ok(Math.abs(t - (6 - 2.25 - 0.38) / 12) < 1e-8);
  assert.equal(sweptContact(car, 0, -12, 2, -6), null);
});
test("reverse, sideways slip, and rotated cars share the same contact footprint", () => {
  assert.ok(sweptContact(car, 0, 8, 0.1, 6) > 0);
  assert.ok(sweptContact(car, 5, 0, 3, 0) > 0);
  const turned = { ...car, a: Math.PI / 2 };
  assert.equal(insideCar(turned, 2.5, 0), true);
  assert.equal(insideCar(turned, 0, 2.5), false);
  assert.ok(sweptContact(turned, -10, 0, -8, 0) > 0);
});

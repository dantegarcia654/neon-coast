import * as T from "three";
import { slide } from "./impact-motion.js";
const clamp = T.MathUtils.clamp;
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const axis = new T.Vector3(),
  tilt = new T.Quaternion(),
  up = new T.Vector3(0, 1, 0);

export function beginPedestrianImpact(npc, vx, vz, blocked) {
  const speed = Math.hypot(vx, vz),
    dx = vx / speed,
    dz = vz / speed;
  const hard = speed >= 9,
    power = clamp((speed - 4) / 28, 0, 1);
  const pos = npc.root.position,
    travel = hard ? 1.6 + 4.5 * power : 0.48 + power;
  let distance = 0;
  for (let n = 1; n <= 24; n++) {
    const d = (travel * n) / 24;
    if (blocked(pos.x + dx * d, pos.z + dz * d, 0.36)) break;
    distance = d;
  }
  npc.impact = {
    age: 0,
    x: pos.x,
    z: pos.z,
    yaw: npc.root.rotation.y,
    dx,
    dz,
    distance,
    hard,
    power,
  };
  npc.root.rotation.order = "YXZ";
}
// Use an airborne arc for hard hits and a planted-foot stagger for lighter contact.
export function beginBodyReaction(npc, dx, dz, shove, lift, blocked, downTime = 0) {
  npc.root.rotation.reorder("YXZ");
  const p = npc.root.position;
  const length = Math.hypot(dx, dz) || 1;
  dx /= length;
  dz /= length;
  npc.impact = {
    dynamic: true, hard: lift > 0, dx, dz, x: p.x, z: p.z, y: p.y,
    vx: dx * shove, vz: dz * shove, vy: lift,
    yaw: npc.impact?.yaw ?? npc.root.rotation.y,
    tilt: lift ? 1.43 : Math.min(.58, .16 + shove * .075),
    age: 0, groundedTime: 0, hold: downTime, blocked
  };
}

function stepBodyReaction(npc, s, dt, time, ground) {
  const steps = Math.max(1, Math.ceil(dt * 90));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const airborne = s.vy > 0 || s.y > ground(s.x, s.z) + .012;
    slide(s, s, h, airborne ? 1.45 : 7.5, (x, z) => s.blocked(x, z, .34));
    const floor = ground(s.x, s.z);
    s.y += s.vy * h - 9 * h * h;
    s.vy -= 18 * h;
    if (s.y <= floor) {
      s.y = floor;
      s.vy = 0;
      s.groundedTime += h;
    }
    s.age += h;
  }
  const fall = smooth(s.age / (s.hard ? .28 : .11));
  const rise = smooth((s.groundedTime - s.hold) / (s.hard ? .66 : .25));
  const pose = fall * (1 - rise);
  const brace = Math.sin(Math.PI * rise);
  const root = npc.root;
  root.position.set(s.x, s.y + pose * (s.hard ? .22 : .045), s.z);
  axis.set(s.dz, 0, -s.dx);
  tilt.setFromAxisAngle(axis, s.tilt * pose - brace * .12);
  root.quaternion.setFromAxisAngle(up, s.yaw).premultiply(tilt);
  for (let i = 0; i < npc.arms.length; i++) {
    const side = i ? 1 : -1;
    npc.arms[i].rotation.set(-.88 * pose + .72 * brace, 0, side * (.61 * pose + .2 * brace));
    npc.legs[i].rotation.x = (i ? .56 : -.44) * pose - .72 * brace;
  }
  if (rise === 1) {
    root.rotation.set(0, s.yaw, 0, "YXZ");
    if (!npc.behavior) {
      npc.walkOffsetX = s.x - (npc.x + Math.sin(time * .08 + npc.phase) * 8);
      npc.walkOffsetZ = s.z - npc.z;
    }
    npc.impact = null;
  }
  return true;
}
export function updatePedestrianImpact(npc, dt, time, ground) {
  const s = npc.impact;
  if (!s) return false;
  if (s.dynamic) return stepBodyReaction(npc, s, dt, time, ground);
  s.age += dt;
  const fall = s.hard ? 0.46 : 0.23,
    hold = s.hard ? 0.55 + 0.5 * s.power : 0.08,
    rise = s.hard ? 0.86 : 0.42;
  const t = clamp(s.age / fall, 0, 1),
    recovery = smooth((s.age - fall - hold) / rise);
  const reach =
    1 - (1 - clamp(s.age / (fall + (s.hard ? 0.35 : 0.12)), 0, 1)) ** 2;
  const pose = Math.sin(t * Math.PI * 0.5) * (1 - recovery),
    bend = Math.sin(Math.PI * recovery);
  const root = npc.root,
    x = s.x + s.distance * s.dx * reach,
    z = s.z + s.distance * s.dz * reach;
  const lift = s.hard
    ? Math.sin(t * Math.PI) * (0.31 + 0.65 * s.power) + 0.23 * pose
    : 0.06 * pose;
  root.position.set(x, ground(x, z) + lift, z);
  axis.set(s.dz, 0, -s.dx);
  tilt.setFromAxisAngle(axis, pose * (s.hard ? 1.52 : 0.54) - bend * 0.12);
  root.quaternion.setFromAxisAngle(up, s.yaw).premultiply(tilt);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    npc.arms[i].rotation.set(
      -0.95 * pose + 0.85 * bend,
      0,
      side * (0.85 * pose + 0.25 * bend),
    );
    npc.legs[i].rotation.x = (i ? 0.52 : -0.65) * pose - 0.78 * bend;
  }
  if (s.age >= fall + hold + rise) {
    npc.walkOffsetX = x - (npc.x + Math.sin(time * 0.08 + npc.phase) * 8);
    npc.walkOffsetZ = z - npc.z;
    npc.impact = null;
    root.rotation.set(0, s.yaw, 0, "YXZ");
    for (const arm of npc.arms) arm.rotation.z = 0;
  }
  return true;
}

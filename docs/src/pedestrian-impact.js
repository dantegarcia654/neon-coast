import * as T from "three";
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
export function updatePedestrianImpact(npc, dt, time, ground) {
  const s = npc.impact;
  if (!s) return false;
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

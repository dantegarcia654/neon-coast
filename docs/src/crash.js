// Wheel speed is longitudinal. Impacts can also set chassis velocity across the tires.
export function velocity(c) {
  const sn = Math.sin(c.a),
    cs = Math.cos(c.a),
    side = c.slip || 0;
  return { x: -sn * c.speed + cs * side, z: -cs * c.speed - sn * side };
}
function setVelocity(c, x, z) {
  const sn = Math.sin(c.a),
    cs = Math.cos(c.a);
  c.speed = -sn * x - cs * z;
  c.slip = cs * x - sn * z;
}
export function decayImpact(c, dt) {
  c.slip = (c.slip || 0) * Math.exp(-3.6 * dt);
  c.crashPitch = (c.crashPitch || 0) * Math.exp(-8 * dt);
  c.crashRoll = (c.crashRoll || 0) * Math.exp(-8 * dt);
}
function bodyKick(c, x, z) {
  c.crashPitch = Math.max(
    -0.14,
    Math.min(0.14, (-Math.sin(c.a) * x - Math.cos(c.a) * z) * 0.005),
  );
  c.crashRoll = Math.max(
    -0.13,
    Math.min(0.13, (Math.cos(c.a) * x - Math.sin(c.a) * z) * 0.006),
  );
}
export function hullBlocked(c, x, z, r, blocked, a = c.a) {
  const reach = Math.max(0, (c.spec?.length || 4.5) * 0.5 - r);
  const dx = Math.sin(a) * reach,
    dz = Math.cos(a) * reach;
  return (
    blocked(x, z, r) || blocked(x + dx, z + dz, r) || blocked(x - dx, z - dz, r)
  );
}
export function moveVehicle(c, dt, blocked) {
  const v = velocity(c),
    steps = Math.max(1, Math.ceil((Math.hypot(v.x, v.z) * dt) / 0.32));
  let hitX = 0,
    hitZ = 0;
  for (let n = 0; n < steps; n++) {
    const dx = (v.x * dt) / steps,
      dz = (v.z * dt) / steps;
    if (dx && blocked(c.x + dx, c.z)) {
      hitX = v.x;
      v.x = Math.abs(v.x) > 3 ? -v.x * 0.14 : 0;
    } else c.x += dx;
    if (dz && blocked(c.x, c.z + dz)) {
      hitZ = v.z;
      v.z = Math.abs(v.z) > 3 ? -v.z * 0.14 : 0;
    } else c.z += dz;
  }
  const impact = Math.hypot(hitX, hitZ);
  if (impact) {
    setVelocity(c, v.x, v.z);
    if (impact > 2) bodyKick(c, -hitX, -hitZ);
  }
  return impact;
}
export function collisionImpulse(
  car,
  other,
  nx,
  nz,
  otherVelocity = velocity(other),
) {
  const v = velocity(car);
  const closing = (otherVelocity.x - v.x) * nx + (otherVelocity.z - v.z) * nz;
  if (closing <= 0) return 0;
  const share = other.traffic ? 0.52 : 0.88,
    push = closing * 1.16;
  setVelocity(car, v.x + nx * push * share, v.z + nz * push * share);
  if (other.traffic)
    setVelocity(
      other,
      otherVelocity.x - nx * push * (1 - share),
      otherVelocity.z - nz * push * (1 - share),
    );
  if (closing > 2) bodyKick(car, nx * closing, nz * closing);
  return closing;
}
export function impactDamage(speed) {
  return Math.min(64, Math.max(0, speed - 3) ** 1.42 * 0.24);
}

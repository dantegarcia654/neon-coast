// Game-space impulse. Short steps keep fast slides from skipping thin obstacles.
export function slide(body, motion, dt, drag, blocked) {
  const steps = Math.max(1, Math.ceil(dt * Math.hypot(motion.vx, motion.vz) / .16));
  const step = dt / steps;
  const decay = Math.exp(-drag * step);
  const travel = -Math.expm1(-drag * step) / drag;
  for (let i = 0; i < steps; i++) {
    const x = body.x + motion.vx * travel;
    if (motion.vx && blocked(x, body.z)) motion.vx = 0;
    else body.x = x;
    const z = body.z + motion.vz * travel;
    if (motion.vz && blocked(body.x, z)) motion.vz = 0;
    else body.z = z;
    motion.vx *= decay;
    motion.vz *= decay;
  }
}
export function blastWeight(distance, radius) {
  const t = Math.max(0, 1 - distance / radius);
  return t * t * (3 - 2 * t);
}
export function facingAttacker(yaw, dx, dz) {
  return -Math.sin(yaw) * dx - Math.cos(yaw) * dz >= .23 * Math.hypot(dx, dz);
}

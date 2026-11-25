// Coordinates in the car's frame, with positive forward toward the bonnet.
export function roadPosition(car, x, z) {
  const dx = x - car.x,
    dz = z - car.z,
    sn = Math.sin(car.a),
    cs = Math.cos(car.a);
  return { side: dx * cs - dz * sn, front: -dx * sn - dz * cs };
}
export function insideCar(car, x, z, r = 0.38) {
  const q = roadPosition(car, x, z);
  return (
    Math.abs(q.side) < 1.02 + r &&
    Math.abs(q.front) < (car.spec?.length || 4.5) / 2 + r
  );
}
// Clip a segment against both slabs of an expanded vehicle footprint. This also
// covers reversals, lateral slip and an actor already touching a bumper.
export function sweptContact(car, dx, dz, x, z) {
  const start = roadPosition(car, x, z),
    end = roadPosition(car, x - dx, z - dz);
  let enter = 0,
    exit = 1;
  for (const [a, b, r] of [
    [start.side, end.side, 1.4],
    [start.front, end.front, (car.spec?.length || 4.5) / 2 + 0.38],
  ]) {
    if (Math.abs(b - a) < 1e-8) {
      if (Math.abs(a) > r) return null;
      continue;
    }
    const t1 = (-r - a) / (b - a),
      t2 = (r - a) / (b - a);
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return null;
  }
  return exit <= 0 ? null : enter;
}

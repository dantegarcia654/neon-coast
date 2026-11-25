// Find a clear departure lane and an opposing lane for the visible cruiser.
// Account for moving cross traffic during the first two seconds of driving.
export function getawayStart(vehicles, ride, lead, blocked) {
  let best, bestClearance=-Infinity;
  for (const avenue of [0,48,-48,96,-96]) {
    for (const z of [-11,85,-59,37,-107,133]) {
      const x=avenue+3.6, copX=avenue-4.4, copZ=z-19;
      if (blocked(x,z,1.2) || blocked(copX,copZ,1.4)) continue;
      let clearance=Infinity;
      for (const c of vehicles) {
        if (c===ride || c===lead || c.active===false) continue;
        const radius=(c.spec?.length||4.6)*.5+1.8;
        for (const t of [0,1,2]) {
          const travel=c.traffic ? c.speed*t : 0;
          const cx=c.x-Math.sin(c.a)*travel, cz=c.z-Math.cos(c.a)*travel;
          const along=Math.max(z-28,Math.min(z+5,cz));
          clearance=Math.min(clearance,Math.hypot(cx-x,cz-along)-radius,
            Math.hypot(cx-copX,cz-copZ)-radius);
        }
      }
      if (clearance>bestClearance) {best={x,z,copX,copZ};bestClearance=clearance}
      if (clearance>1.5) return best;
    }
  }
  return best;
}

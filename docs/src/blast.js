import * as T from "three";
import { beginPedestrianImpact } from "./pedestrian-impact.js";

const radius = 5.5,
  puff = new T.IcosahedronGeometry(1, 1),
  ring = new T.RingGeometry(0.83, 1, 48);
const charred = new T.MeshStandardMaterial({
  color: 0x382e2a,
  roughness: 0.91,
  metalness: 0.35,
});
export function createBlasts(
  world,
  { blocked, tag, onAssault, onBoom, onWreck, dropBlock, staticCast },
) {
  const effects = [],
    wrecks = new Map();
  let count = 0,
    last = null;
  function wreck(c) {
    if (wrecks.has(c)) return;
    const saved = [];
    c.g.traverse((m) => {
      if (m.isMesh && !m.userData.sauce) {
        saved.push([m, m.material]);
        m.material = charred;
      }
    });
    wrecks.set(c, saved);
    c.wrecked = true;
    c.speed = c.slip = 0;
    c.traffic = false;
  }
  function effect(center) {
    const group = new T.Group();
    group.position.copy(center);
    world.scene.add(group);
    const clouds = [];
    for (let i = 0; i < 13; i++) {
      const smoke = i >= 8;
      const mat = new T.MeshBasicMaterial({
        color: smoke ? 0x5b5350 : i % 3 ? 0xff8b21 : 0xffe98b,
        transparent: true,
        depthWrite: false,
      });
      const m = new T.Mesh(puff, mat);
      group.add(m);
      const a = i * 2.4;
      clouds.push({
        m,
        smoke,
        x: Math.cos(a) * ((i % 4) + 0.5) * 0.53,
        z: Math.sin(a) * ((i % 4) + 0.5) * 0.53,
        y: 0.35 + (i % 3) * 0.6,
      });
    }
    const halo = new T.Mesh(
      ring,
      new T.MeshBasicMaterial({
        color: 0xffce82,
        side: T.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.08;
    group.add(halo);
    effects.push({ group, clouds, halo, age: 0 });
  }
  function detonate(hit, skip, direction) {
    const center = hit.point;
    effect(center);
    count++;
    last = hit.kind;
    onBoom();
    const ray = new T.Ray(
      center.clone().addScaledVector(hit.normal, 0.09),
      new T.Vector3(),
    );
    function covered(p) {
      ray.direction.set(p.x, p.y + 0.85, p.z).sub(ray.origin);
      const length = ray.direction.length();
      ray.direction.normalize();
      return length > 0.1 && Boolean(staticCast(ray, length - 0.08));
    }
    for (const npc of world.pedestrians) {
      const p = npc.root.position,
        dx = p.x - center.x,
        dz = p.z - center.z;
      const d = Math.hypot(dx, dz, p.y + 0.85 - center.y);
      if (
        npc !== hit.civilian &&
        (!npc.root.visible || d >= radius || covered(p))
      )
        continue;
      const len = Math.hypot(dx, dz),
        force = 11 + 13 * Math.max(0, 1 - d / radius);
      const fallback = new T.Vector2(direction.x, direction.z);
      if (fallback.lengthSq() < 0.0001) fallback.set(0, -1);
      else fallback.normalize();
      beginPedestrianImpact(
        npc,
        force * (len > 0.08 ? dx / len : fallback.x),
        force * (len > 0.08 ? dz / len : fallback.y),
        blocked,
      );
      onAssault(npc, "blast");
    }
    let destroyedCivilianVehicle = false;
    for (const c of [...world.cars, ...world.cops, ...world.footOfficers]) {
      if (c === skip || c.active === false || !c.g.visible || c.wrecked)
        continue;
      const p = c.g.position,
        d = Math.hypot(p.x - center.x, p.y + 0.8 - center.y, p.z - center.z);
      if (c !== hit.vehicle && (d >= radius || covered(p))) continue;
      if (c.police) {
        tag(c, "blast");
        if (!c.muzzle) wreck(c);
        continue;
      }
      c.health = Math.max(
        0,
        (c.health ?? 100) - (c === hit.vehicle ? 100 : 100 * (1 - d / radius)),
      );
      if (c.health === 0) {
        wreck(c);
        destroyedCivilianVehicle = true;
      }
    }
    if (destroyedCivilianVehicle) onWreck();
    for (const b of world.roadblocks) {
      if (
        b.root.visible &&
        !b.broken &&
        b.root.position.distanceTo(center) < radius
      )
        dropBlock(b);
    }
  }
  function remove(f) {
    f.group.removeFromParent();
    f.halo.material.dispose();
    for (const { m } of f.clouds) m.material.dispose();
  }
  function restore(c) {
    for (const [mesh, mat] of wrecks.get(c)) mesh.material = mat;
    c.wrecked = false;
    wrecks.delete(c);
  }
  function update(dt) {
    for (const c of wrecks.keys()) if (c.police && c.snackTime <= 0) restore(c);
    for (let i = effects.length - 1; i >= 0; i--) {
      const f = effects[i],
        t = (f.age += dt) / 1.2;
      if (t >= 1) {
        remove(f);
        effects.splice(i, 1);
        continue;
      }
      const burst = 1 - Math.exp(-9 * t);
      for (const { m, smoke, x, y, z } of f.clouds) {
        m.position.set(
          x * burst,
          y * burst + t * (smoke ? 2.3 : 0.9),
          z * burst,
        );
        m.scale.setScalar(smoke ? 0.25 + 1.15 * t : 0.23 + 1.17 * burst);
        m.material.opacity = smoke
          ? Math.min(0.65, t * 4) * (1 - t)
          : Math.max(0, 1 - t * 1.75);
      }
      f.halo.scale.setScalar(0.4 + radius * burst);
      f.halo.material.opacity = Math.max(0, 0.85 - t * 2);
    }
  }
  function reset() {
    for (const f of effects) remove(f);
    effects.length = 0;
    for (const c of wrecks.keys()) restore(c);
    wrecks.clear();
    count = 0;
    last = null;
  }
  return {
    detonate,
    update,
    reset,
    state: () => ({ count, last, active: effects.length, wrecks: wrecks.size }),
  };
}

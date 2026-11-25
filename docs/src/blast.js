import * as T from "three";
import { beginBodyReaction } from "./pedestrian-impact.js";

import { cloudSprite } from "./blast-cloud.js";
import { blastWeight, slide } from "./impact-motion.js";
import { hullBlocked, velocity } from "./crash.js";

const radius = 5.5,
  ring = new T.RingGeometry(0.83, 1, 48);
const charred = new T.MeshStandardMaterial({
  color: 0x382e2a,
  roughness: 0.91,
  metalness: 0.35,
});
export function createBlasts(
  world,
  { blocked, tag, onAssault, onBoom, onWreck, dropBlock, staticCast, playerOnFoot, onPlayerBlast },
) {
  const effects = [],
    wrecks = new Map(),
    moving = new Map();
  const flash = new T.PointLight(0xffab58, 0, 12);
  world.scene.add(flash);
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
    const fire = new T.Group();
    fire.position.set(.12, .75, -(c.spec?.length || 4.5) * .27);
    for (let i=0; i<8; i++) {
      const smoke = i>=4;
      fire.add(cloudSprite(smoke ? (i%2 ? 0x484346 : 0x776e6d) : (i%2 ? 0xfc661c : 0xffb047), i*1.7));
    }
    c.g.add(fire);
    wrecks.set(c, {saved,fire,age:0});
    c.wrecked = true;
    c.speed = c.slip = 0;
    c.traffic = false;
  }
  function effect(center) {
    flash.position.copy(center);
    flash.position.y += .45;
    flash.intensity = 28;
    const group = new T.Group();
    group.position.copy(center);
    world.scene.add(group);
    const core = cloudSprite(0xffe3a0,0);
    core.material.blending = T.AdditiveBlending;
    core.material.color.multiplyScalar(2.8);
    core.renderOrder = 1;
    group.add(core);
    const clouds = [];
    for (let i = 0; i < 20; i++) {
      const smoke = i >= 10;
      const m = cloudSprite(smoke ? (i%2 ? 0x574e4b : 0x948275) : i%3 ? 0xff7920 : 0xffe8a0, i*2.1);
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
    const floor = world.getGroundHeight(center.x, center.z);
    halo.position.y = floor - center.y + .06;
    halo.visible = center.y - floor < 2.5;
    group.add(halo);
    const rays = [];
    const points = new Float32Array(18 * 6);
    for (let i = 0; i < points.length / 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      rays.push({vx:Math.sin(angle)*speed, vz:Math.cos(angle)*speed, vy:1.5+Math.random()*5});
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(points, 3).setUsage(T.DynamicDrawUsage));
    const sparks = new T.LineSegments(geo, new T.LineBasicMaterial({
      color:0xffcc66, transparent:true, depthWrite:false, blending:T.AdditiveBlending
    }));
    sparks.frustumCulled = false;
    group.add(sparks);
    effects.push({ group, core, clouds, halo, rays, sparks, floor:floor-center.y, age:0 });
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
    const player = playerOnFoot?.();
    if (player) {
      const dx=player.x-center.x, dz=player.z-center.z;
      const d=Math.hypot(dx,player.y+.85-center.y,dz);
      if(d<radius && !covered(player)) onPlayerBlast(dx || (dz ? 0 : direction.x), dz || (dx ? 0 : direction.z || -1), blastWeight(d,radius));
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
      const weight = npc === hit.civilian ? 1 : blastWeight(d, radius);
      const hard = weight > .45;
      const len = Math.hypot(dx, dz);
      beginBodyReaction(npc, len > .08 ? dx : direction.x, len > .08 ? dz : direction.z || -1,
        .4 + 11 * weight, hard ? 2.4 + 3.5 * weight : 0, blocked, hard ? .5 + weight * .45 : .15);
      onAssault(npc, "blast");
    }
    let destroyedCivilianVehicle = false;
    for (const c of [...world.cars, ...world.cops, ...world.footOfficers]) {
      if (c === skip || c.active === false || !c.g.visible)
        continue;
      const p = c.g.position,
        d = Math.hypot(p.x - center.x, p.y + 0.8 - center.y, p.z - center.z);
      if (c !== hit.vehicle && (d >= radius || covered(p))) continue;
      const weight = c === hit.vehicle ? 1 : blastWeight(d, radius);
      const dx = p.x - center.x, dz = p.z - center.z, len = Math.hypot(dx,dz);
      const nx = len > .08 ? dx/len : direction.x, nz = len > .08 ? dz/len : direction.z || -1;
      const damage = 100 * weight;
      const stops = !c.wrecked && (c.police || damage >= (c.health ?? 100));
      if (c.muzzle) {
        tag(c, "blast");
        beginBodyReaction(c,nx,nz,.5+10*weight,weight>.45 ? 2+3*weight : 0,blocked,.45);
        continue;
      }
      if (!c.spec?.special) {
        const carry = stops ? velocity(c) : {x:0,z:0};
        const heavy = ["utility","truck"].includes(c.spec?.kind);
        const kick = weight * (heavy ? 4.6 : 8);
        const motion = moving.get(c) || {vx:0,vz:0,age:0,roll:0,pitch:0};
        motion.vx += nx * kick + carry.x;
        motion.vz += nz * kick + carry.z;
        motion.roll = kick * .055 * (nx*Math.cos(c.a) - nz*Math.sin(c.a));
        motion.pitch = kick * .026 * (nz*Math.cos(c.a) + nx*Math.sin(c.a));
        motion.age = 0;
        moving.set(c,motion);
      }
      if (c.wrecked) continue;
      if (c.police) {
        tag(c, "blast");
        wreck(c);
        continue;
      }
      c.health = Math.max(
        0,
        (c.health ?? 100) - damage,
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
        b.root.position.distanceTo(center) < radius && !covered(b.root.position)
      )
        dropBlock(b);
    }
  }
  function remove(f) {
    f.group.removeFromParent();
    f.halo.material.dispose();
    f.core.material.dispose();
    f.sparks.geometry.dispose();
    f.sparks.material.dispose();
    for (const { m } of f.clouds) m.material.dispose();
  }
  function restore(c) {
    const {saved,fire} = wrecks.get(c);
    if(fire) removeFire(fire);
    for (const [mesh, mat] of saved) mesh.material = mat;
    c.wrecked = false;
    wrecks.delete(c);
  }
  function removeFire(fire) {
    fire.removeFromParent();
    for (const particle of fire.children) particle.material.dispose();
  }
  function updateFire(wreck,dt) {
    const fire = wreck.fire;
    if(!fire) return;
    wreck.age += dt;
    if(wreck.age>=5.2) {
      removeFire(fire);
      wreck.fire=null;
      return;
    }
    for (const [i,m] of fire.children.entries()) {
      const smoke = i>=4;
      const t = (wreck.age * (smoke ? .64 : 1.55) + i*.247) % 1;
      const envelope = Math.sin(t*Math.PI);
      m.position.set(Math.sin(i*2.4)*.5 + t*t*.3, t*(smoke ? 2.5 : 1.45), Math.cos(i*2.4)*.42);
      const size = smoke ? .36+t*.69 : .34+.17*envelope;
      m.scale.set(2.5*size,smoke ? 2.5*size : .72+1.15*envelope,1);
      m.material.opacity = envelope * Math.max(0,1-wreck.age/(smoke ? 5.2 : 3.4)) * (smoke ? .65 : .95);
    }
  }
  function update(dt) {
    for(const wreck of wrecks.values()) updateFire(wreck,dt);
    flash.intensity *= Math.exp(-23 * dt);
    for (const [c,m] of moving) {
      m.age += dt;
      slide(c,m,dt,3.2,(x,z)=>hullBlocked(c,x,z,1,blocked));
      const rock = Math.sin(11*m.age) * Math.exp(-4.5*m.age);
      c.blastRoll = m.roll * rock;
      c.blastPitch = m.pitch * rock;
      if (m.age > 1.7 || c.active === false) {
        c.blastRoll = c.blastPitch = 0;
        moving.delete(c);
      }
    }
    for (const c of wrecks.keys()) if (c.police && c.snackTime <= 0) restore(c);
    for (let i = effects.length - 1; i >= 0; i--) {
      const f = effects[i],
        t = (f.age += dt) / 2.05;
      if (t >= 1) {
        remove(f);
        effects.splice(i, 1);
        continue;
      }
      const burst = 1 - Math.exp(-15 * t);
      f.core.visible = f.age < .16;
      f.core.scale.setScalar(.65 + 2.7*burst);
      f.core.material.opacity = Math.max(0,1-f.age/.16);
      for (const { m, smoke, x, y, z } of f.clouds) {
        m.position.set(
          x * burst,
          y * burst + t * (smoke ? 3.6 : 0.9),
          z * burst,
        );
        m.scale.setScalar(smoke ? 1.05 + 3.75*t : .75 + 2.8*burst);
        m.material.rotation += dt * (smoke ? .48 : -.7);
        m.material.opacity = smoke
          ? Math.min(0.70, t * 5) * (1 - t)
          : Math.max(0, 1 - t * 3.8);
      }
      const attr = f.sparks.geometry.attributes.position;
      f.sparks.visible = f.age < .62;
      if (f.sparks.visible) {
        f.rays.forEach(({vx,vy,vz},i)=>{
          for (let j=0;j<2;j++) {
            const a = Math.max(0,f.age - j*.055);
            attr.setXYZ(2*i+j,vx*a,Math.max(f.floor+.03,vy*a-8*a*a),vz*a);
          }
        });
        attr.needsUpdate = true;
        f.sparks.material.opacity = 1 - f.age/.62;
      }
      f.halo.scale.setScalar(0.4 + radius * burst);
      f.halo.material.opacity = Math.max(0, 0.5 - t * 3.4);
    }
  }
  function reset() {
    for (const f of effects) remove(f);
    effects.length = 0;
    flash.intensity = 0;
    for (const c of moving.keys()) c.blastPitch = c.blastRoll = 0;
    moving.clear();
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

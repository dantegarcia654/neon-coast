import * as T from "three";
import { insideCar, roadPosition, sweptContact } from "./traffic-contact.js";
import { beginBodyReaction, beginPedestrianImpact, clearBodyPose, updatePedestrianImpact } from "./pedestrian-impact.js";
import { facingAttacker } from "./impact-motion.js";
import { velocity } from "./crash.js";

const clothes = ["#527887", "#b36c4b", "#667b57", "#85748a"],
  skins = ["#ad8063", "#795740", "#ca9971"];
export function createEncounters(
  world,
  player,
  { wall, move, horn, notify, hurt, thump },
) {
  const drivers = [],
    ground = world.getGroundHeight,
    scene = world.scene;
  let pulling = null,
    down = 0,
    guarding = false,
    honks = 0,
    trafficHits = 0,
    punches = 0,
    blockedPunches = 0;
  const playerBody = {...world.makeHuman(),behavior:"player"};
  function placePlayerBody() {
    playerBody.root.position.set(player.x,ground(player.x,player.z),player.z);
    playerBody.root.rotation.set(0,player.a,0);
  }
  function blastPlayer(dx,dz,weight) {
    if(weight < .025 || pulling) return;
    placePlayerBody();
    beginBodyReaction(playerBody,dx,dz,.5+8*weight,weight>.45 ? 2.4+2.8*weight : 0,
      bodyBlocked,weight>.45 ? .62 : .13);
    hurt(Math.max(1,Math.round(38*weight)), "CAUGHT IN THE BLAST");
  }
  const knockbackOffset = new T.Vector2();
  const seatShape = new T.SphereGeometry(1, 8, 6);
  const fabrics = clothes.map((color) => new T.MeshStandardMaterial({ color }));
  const faces = skins.map((color) => new T.MeshStandardMaterial({ color }));
  function occupant(i) {
    const seat = new T.Group();
    for (const [mat, y, w, h, d] of [
      [fabrics[i % 4], 0, 0.21, 0.22, 0.14],
      [faces[i % 3], 0.27, 0.127, 0.146, 0.13],
    ]) {
      const mesh = new T.Mesh(seatShape, mat);
      mesh.position.y = y;
      mesh.scale.set(w, h, d);
      seat.add(mesh);
    }
    return seat;
  }
  world.pedestrians.forEach((n, i) => {
    n.temper = i % 3 === 0 ? "aggressive" : "cautious";
  });
  for (const [i, c] of world.cars.filter((c) => c.traffic).entries()) {
    // Two approaches to the starting intersection let a new player encounter traffic immediately.
    if (i === 0) Object.assign(c, { x: -3.6, z: 38, a: 0 });
    if (i === 1) Object.assign(c, { x: 36, z: -3.6, a: Math.PI / 2 });
    const n = {
      driver: true,
      temper: i % 2 ? "aggressive" : "cautious",
      behavior: "seated",
      car: c,
      root: new T.Group(),
      seat: occupant(i),
      arms: [],
      legs: [],
      phase: i,
      x: c.x,
      z: c.z,
      index: i,
      cruise: c.speed,
    };
    n.root.visible = false;
    scene.add(n.root);
    drivers.push(n);
    c.driver = n;
    world.pedestrians.push(n);
  }
  for (const n of drivers) {
      n.seat.position.set(-0.37, (n.car.roofHeight || 1.55) * 0.62, 0.03);
      n.car.g.add(n.seat);
  }
  function bodyBlocked(x, z, r = 0.37, ignore = null) {
    if (wall(x, z, r)) return true;
    return [...world.cars, ...world.cops].some(
      (c) =>
        c !== ignore &&
        c.active !== false &&
        !c.spec?.special &&
        insideCar(c, x, z, r),
    );
  }
  function doorPoint(c, side, along) {
    return {
      x: c.x + side * Math.cos(c.a) - along * Math.sin(c.a),
      z: c.z - side * Math.sin(c.a) - along * Math.cos(c.a),
    };
  }
  function pullDriver(c) {
    const n = c.driver;
    if (!n || n.behavior !== "seated") return false;
    const side = roadPosition(c, player.x, player.z).side < 0 ? -1 : 1;
    const sites = [side, -side].flatMap((s) =>
      [0.6, -0.8, 1.45, -1.65].map((a) => doorPoint(c, s * 1.85, a)),
    );
    const dest = sites.find((v) => {
      if (
        bodyBlocked(v.x, v.z, 0.35, c) ||
        Math.hypot(v.x - player.x, v.z - player.z) <= 0.75
      )
        return false;
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        if (
          wall(
            player.x + (v.x - player.x) * t,
            player.z + (v.z - player.z) * t,
            0.18,
          )
        )
          return false;
      }
      return true;
    });
    if (!dest) {
      notify("DOOR BLOCKED");
      return true;
    }
    if (!n.arms.length) {
      const human = world.makeHuman(clothes[n.index % 4], skins[n.index % 3]);
      n.root.add(human.root);
      n.arms = human.arms;
      n.legs = human.legs;
      n.rig = human.rig;
    }
    c.traffic = false;
    c.speed = c.slip = 0;
    n.seat.visible = false;
    n.root.visible = true;
    const from = doorPoint(
      c,
      (roadPosition(c, dest.x, dest.z).side < 0 ? -1 : 1) * 0.48,
      0.12,
    );
    Object.assign(n, {
      behavior: "exiting",
      x: from.x,
      z: from.z,
      health: 3,
      wind: 0,
      cool: 0.65,
      rangeTime: 0,
      flinch: 0,
    });
    n.root.position.set(from.x, ground(from.x, from.z) + 0.15, from.z);
    n.root.rotation.set(0, c.a, 0);
    pulling = { n, from, dest, age: 0 };
    player.a = Math.atan2(player.x - from.x, player.z - from.z);
    return true;
  }
  function seated(c) {
    return c.driver?.behavior === "seated" && !c.wrecked;
  }
  function syncSeat(c, target) {
    if (c.driver)
      c.driver.seat.visible =
        seated(c) && Math.hypot(target.x - c.x, target.z - c.z) < 55;
  }
  function updateTraffic(c, dt, onFoot, streetLimit=Infinity) {
    const n = c.driver;
    if (!n) return;
    n.hornTime = Math.max(0, (n.hornTime || 0) - dt);
    const q = roadPosition(c, player.x, player.z),
      nose = (c.spec.length || 4.5) / 2 + 0.38;
    const ahead = q.front * Math.sign(c.speed || 1);
    const yieldNow =
      onFoot &&
      n.temper === "cautious" &&
      Math.abs(q.side) < 1.58 &&
      ahead >= -nose &&
      ahead < nose + 1.3 + Math.max(3, (c.speed * c.speed) / 15);
    if (yieldNow) {
      if (!n.waiting && !n.hornTime) {
        horn();
        honks++;
        n.hornTime = 3;
      }
      n.waiting = true;
      c.speed =
        Math.sign(c.speed) *
        Math.min(
          Math.max(0, Math.abs(c.speed) - 12 * dt),
          Math.sqrt(15 * Math.max(0, ahead - nose - 0.7)),
        );
    } else {
      n.waiting = false;
      c.speed += Math.max(0, Math.min(2.7 * dt, n.cruise - c.speed));
    }
    c.speed=Math.min(c.speed,streetLimit);
    const oldX = c.x,
      oldZ = c.z,
      v = velocity(c);
    move(c, v.x * dt, v.z * dt, 1);
    const dx = c.x - oldX,
      dz = c.z - oldZ;
    if (!onFoot || (!dx && !dz)) return;
    const before = { x: oldX, z: oldZ, a: c.a, spec: c.spec };
    const contact = sweptContact(before, dx, dz, player.x, player.z);
    if (contact === null) return;
    const speed = Math.hypot(dx, dz) / dt;
    c.x = oldX + dx * Math.max(0, contact - 0.015);
    c.z = oldZ + dz * Math.max(0, contact - 0.015);
    if (n.temper === "cautious" || speed < 2 || down > 0 || playerBody.impact) {
      c.speed = c.slip = 0;
      return;
    }
    // Send the player clear of the wheels. If scenery pins both sides, stop the car.
    const preferred = q.side < 0 ? -1 : 1;
    const escape = [preferred, -preferred]
      .map((sign) => doorPoint(c, sign * 1.85, q.front + 0.24))
      .find((pt) => {
        for (let i = 1; i <= 6; i++) {
          const t = i / 6;
          if (
            bodyBlocked(
              player.x + (pt.x - player.x) * t,
              player.z + (pt.z - player.z) * t,
              0.35,
              c,
            )
          )
            return false;
        }
        return true;
      });
    knockbackOffset.set(0, 0);
    if (escape) {
      knockbackOffset.set(player.x - escape.x, player.z - escape.z);
      player.x = escape.x;
      player.z = escape.z;
      c.speed *= 0.73;
    } else c.speed = c.slip = 0;
    placePlayerBody();
    const side=escape ? Math.sign((escape.x-c.x)*Math.cos(c.a)-(escape.z-c.z)*Math.sin(c.a)) : 0;
    const vx=dx/dt+side*Math.cos(c.a)*speed*.7;
    const vz=dz/dt-side*Math.sin(c.a)*speed*.7;
    beginPedestrianImpact(playerBody,vx,vz,bodyBlocked);
    down = 1.15;
    guarding = false;
    trafficHits++;
    hurt(Math.min(48, Math.round(7 + speed * 1.8)), "HIT BY TRAFFIC");
  }
  function react(n, kind) {
    if (
      (kind !== "strike" && kind !== "hammer") ||
      n.behavior === "seated" ||
      n.behavior === "exiting" ||
      n.behavior === "defeated"
    )
      return;
    n.x = n.root.position.x;
    n.z = n.root.position.z;
    n.health = Math.max(0,(n.health ?? 3) - (kind==="hammer"?2:1));
    n.flinch = kind==="hammer" ? .45 : .32;
    n.wind = n.followThrough = 0;
    n.cool = 0.46;
    n.rangeTime = 0;
    n.behavior =
      n.health <= 0 ? "defeated" : n.temper === "aggressive" ? "fight" : "flee";
    const downed = n.health === 0;
    const heavy = kind === "hammer";
    beginBodyReaction(n, n.x - player.x, n.z - player.z, heavy ? 5 : 2.7,
      downed ? 2.6 : 0, bodyBlocked, downed ? 3.1 : heavy ? .22 : .12,"punch");
    if (downed) {
      notify("OPPONENT DOWN");
    }
  }
  function walk(n, dx, dz, dist) {
    const len = Math.hypot(dx, dz) || 1;
    for (const a of [0, 0.65, -0.65, 1.4, -1.4]) {
      const x = n.x + ((dx * Math.cos(a) - dz * Math.sin(a)) / len) * dist,
        z = n.z + ((dz * Math.cos(a) + dx * Math.sin(a)) / len) * dist;
      if (bodyBlocked(x, z, 0.32)) continue;
      n.x = x;
      n.z = z;
      n.root.rotation.y = Math.atan2(
        n.root.position.x - x,
        n.root.position.z - z,
      );
      return true;
    }
    return false;
  }
  function stepNpc(n, dt, time, target, inCar) {
    if (!n.behavior) return;
    if (n.behavior === "seated" || n.behavior === "gone") {
      n.root.visible = false;
      return;
    }
    n.root.visible = Math.hypot(n.x - target.x, n.z - target.z) < 70;
    if (n.impact) {
      if (updatePedestrianImpact(n, dt, time, ground)) {
        n.x = n.root.position.x;
        n.z = n.root.position.z;
        return;
      }
    }
    if (n.behavior === "exiting") {
      const e = pulling;
      if (!e || e.n !== n) return;
      const t = Math.min(1, (e.age += dt) / 0.65),
        s = t * t * (3 - 2 * t);
      n.x = e.from.x + (e.dest.x - e.from.x) * s;
      n.z = e.from.z + (e.dest.z - e.from.z) * s;
      n.root.position.set(
        n.x,
        ground(n.x, n.z) + 0.18 * Math.sin(Math.PI * t),
        n.z,
      );
      n.root.rotation.z = 0.42 * Math.sin(Math.PI * t);
      n.arms.forEach((a) => (a.rotation.x = -0.65 * Math.sin(Math.PI * t)));
      if (t === 1) {
        pulling = null;
        n.behavior = n.temper === "aggressive" ? "fight" : "flee";
        notify(
          n.behavior === "fight"
            ? "DRIVER IS SWINGING · SPACE TO GUARD"
            : "DRIVER IS RUNNING AWAY",
        );
      }
      return;
    }
    n.flinch = Math.max(0, (n.flinch || 0) - dt);
    n.cool = Math.max(0, (n.cool || 0) - dt);
    const dx = target.x - n.x,
      dz = target.z - n.z,
      dist = Math.hypot(dx, dz);
    const face = () => {
      n.root.rotation.y = Math.atan2(-dx, -dz);
    };
    let stride = 0,
      swing = Math.min(1, (n.followThrough || 0) / .17),
      tilt = n.flinch * 0.9;
    n.followThrough = Math.max(0, (n.followThrough || 0) - dt);
    if (n.behavior === "defeated") {
      n.health = 3;
      n.behavior = "flee";
      n.rangeTime = 0;
    } else if (n.behavior === "fight") {
      if (n.wind > 0) {
        n.wind = Math.max(0, n.wind - dt);
        face();
        swing = Math.max(0, 1 - n.wind / .18);
        if (
          n.wind === 0 &&
          !inCar &&
          dist < 1.55 &&
          !down && !playerBody.impact?.hard &&
          !wall((n.x + player.x) / 2, (n.z + player.z) / 2, 0.1)
        ) {
          n.followThrough = .17;
          if (guarding && facingAttacker(player.a, -dx, -dz)) {
            blockedPunches++;
            thump();
            notify("BLOCKED");
          } else {
            punches++;
            placePlayerBody();
            const finishing=player.health<=10;
            beginBodyReaction(playerBody,dx,dz,2.9,finishing?1:0,bodyBlocked,finishing?3.1:.12,"punch");
            hurt(10, "PUNCHED · SPACE TO GUARD");
          }
          n.cool = 0.9;
        }
      } else if (!n.flinch && !inCar && dist <= 1.25) {
        face();
        if (!n.cool && !down && !playerBody.impact?.hard) n.wind = 0.32;
      } else if (!n.flinch && dist > 1.15 && dist < 24) {
        stride = walk(n, dx, dz, Math.min(dt * 3.2, dist - 1.15)) ? 1 : 0;
      }
      if (dist >= 24) {
        n.behavior = "flee";
        n.rangeTime = 0;
      }
    } else if (n.behavior === "flee") {
      n.rangeTime = (n.rangeTime || 0) + dt;
      stride = walk(n, -dx || 0.001, -dz, dt * 4.4) ? 1 : 0;
      if (n.rangeTime > 3 && dist > 21) {
        if (n.driver) {
          n.behavior = "gone";
          n.root.visible = false;
          return;
        }
        n.behavior = null;
        n.walkOffsetX = n.x - (n.homeX + Math.sin(time * 0.08 + n.phase) * 8);
        n.walkOffsetZ = n.z - n.homeZ;
        n.x = n.homeX;
        n.z = n.homeZ;
      }
    }
    n.root.position.set(
      n.x,
      ground(n.x, n.z) +
        (n.behavior === "defeated" ? 0.19 * Math.sin(tilt) : 0),
      n.z,
    );
    n.root.rotation.x = -tilt;
    for (let i = 0; i < 2; i++) {
      n.legs[i].rotation.x = Math.sin(time * 11 + i * Math.PI) * 0.65 * stride;
      n.arms[i].rotation.x =
        n.behavior === "fight"
          ? 0.77 + (i ? 0.08 : 1) * swing * 0.98
          : -n.legs[i].rotation.x * 0.7;
      n.arms[i].rotation.z = (i ? 1 : -1) * (0.07 + n.flinch * 0.7);
    }
  }
  for (const n of world.pedestrians) {
    n.homeX = n.x;
    n.homeZ = n.z;
  }
  function stepPlayerImpact(dt,time) {
    if(!playerBody.impact)return;
    updatePedestrianImpact(playerBody,dt,time,ground);
    player.x=playerBody.impact?.x ?? playerBody.root.position.x;
    player.z=playerBody.impact?.z ?? playerBody.root.position.z;
  }
  function step(dt, time, car, guard) {
    stepPlayerImpact(dt,time);
    down = Math.max(0, down - dt);
    guarding = guard && !car && !down && !pulling && !playerBody.impact;
    for (const n of world.pedestrians)
      stepNpc(n, dt, time, car || player, !!car);
  }
  function pose() {
    if(playerBody.impact){
      world.person.position.copy(playerBody.root.position);
      world.person.quaternion.copy(playerBody.root.quaternion);
      if(playerBody.impact.kind==="vehicle") {
        const travel=Math.max(0,1-playerBody.impact.age/.20)**2;
        world.person.position.x+=knockbackOffset.x*travel;
        world.person.position.z+=knockbackOffset.y*travel;
      }
      world.characters.fallPose(playerBody);
    } else if (pulling) {
      const n = pulling.n;
      world.characters.reachRight(
        new T.Vector3(n.x, n.root.position.y + 1.38, n.z),
      );
    } else if (guarding) {
      const local = (x) =>
        world.person.localToWorld(new T.Vector3(x, 1.55, -0.33));
      world.characters.holdLauncher(local(-0.19), local(0.19));
    }
  }
  function reset() {
    down = honks = trafficHits = punches = blockedPunches = 0;
    guarding = false;
    clearBodyPose(playerBody);
    pulling = null;
    for (const n of world.pedestrians) {
      clearBodyPose(n);
      n.health = 3;
      n.behavior = n.driver ? "seated" : null;
      n.followThrough = n.wind = n.flinch = n.hornTime = n.rangeTime = 0;
      n.waiting = false;
      n.x = n.homeX;
      n.z = n.homeZ;
      n.root.rotation.set(0, 0, 0);
      if (n.driver) n.root.visible = false;
    }
  }
  return {
    step,
    stepPlayerImpact,
    pose,
    reset,
    react,
    blastPlayer,
    seated,
    pullDriver,
    syncSeat,
    bodyBlocked,
    updateTraffic,
    get busy() {
      return down > 0 || !!pulling || !!playerBody.impact;
    },
    get guarding() {
      return guarding;
    },
    state: () => ({
      honks,
      trafficHits,
      down,
      guarding,
      punches,
      blockedPunches,
      pulling: !!pulling,
      drivers: drivers.map((n) => ({
        temper: n.temper,
        behavior: n.behavior,
        waiting: !!n.waiting,
        health: n.health ?? 3,
        x: n.behavior === "seated" ? n.car.x : n.x,
        z: n.behavior === "seated" ? n.car.z : n.z,
      })),
    }),
  };
}

import { Box3, MathUtils, Ray, Vector3 } from "three";

const presets = [
  { name: "Standard", foot: 4.6, car: 7.7 },
  { name: "Wide", foot: 6.8, car: 10.2 },
  { name: "Close", foot: 3.2, car: 6.0 },
];
const blend = (rate, dt) => 1 - Math.exp(-rate * dt);
const damp = (from, to, rate, dt) => MathUtils.lerp(from, to, blend(rate, dt));
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Follow the subject with a spherical boom. Its heading remains independent of
// the walking animation, so strafing never turns the player's controls around.
export function createFollowCamera(camera, buildings, groundHeight, vehicles = []) {
  const walls = buildings.map(({x, z, w, d, h, base = -.3}) => new Box3(
    new Vector3(x - w / 2 - .28, base, z - d / 2 - .28),
    new Vector3(x + w / 2 + .28, h + .7, z + d / 2 + .28),
  ));
  const anchor = new Vector3(), aim = new Vector3(), direction = new Vector3();
  const hit = new Vector3(), ray = new Ray();
  const vehicleBox = new Box3(), raisedDirection = new Vector3();
  let yaw = 0, pitch = .18, desiredPitch = .18, freeLookDelay = 0;
  let roadView = false, interior = false, headYaw = 0, headPitch = 0;
  let preset = 0, radius = 4.6, clearance = 4.6, reverseView = 0;
  let shoulder = .38, lead = 0, wasDriving = false, firstFrame = true;
  let focusHeight = 1.35, occluded = false, fightAngle = 0;
  const menuFov = camera.fov;

  function clearDistance(start, unitDirection, length, subject) {
    ray.set(start, unitDirection);
    let available = length;
    for (const wall of walls) {
      if (start.x+length<wall.min.x || start.x-length>wall.max.x || start.z+length<wall.min.z || start.z-length>wall.max.z) continue;
      if (ray.intersectBox(wall, hit)) available = Math.min(available, Math.max(.08, hit.distanceTo(start) - .12));
    }
    for (const vehicle of vehicles) {
      if (vehicle.g.visible===false || vehicle === subject || Math.abs(vehicle.x - start.x) > length + 3 ||
          Math.abs(vehicle.z - start.z) > length + 3) continue;
      const sin = Math.abs(Math.sin(vehicle.a)), cos = Math.abs(Math.cos(vehicle.a));
      const halfX = cos + 2.25 * sin, halfZ = sin + 2.25 * cos;
      const floor=vehicle.spec?.special?vehicle.y:groundHeight(vehicle.x,vehicle.z);
      vehicleBox.min.set(vehicle.x - halfX, floor, vehicle.z - halfZ);
      vehicleBox.max.set(vehicle.x + halfX, floor + (vehicle.model === "Mesa Utility" ? 1.85 : 1.55), vehicle.z + halfZ);
      if (!vehicleBox.containsPoint(start) && ray.intersectBox(vehicleBox, hit)) {
        available = Math.min(available, Math.max(.08, hit.distanceTo(start) - .12));
      }
    }
    if(start.z < -176){
      for(let t=.5;t<=available;t+=.5){
        const x=start.x+unitDirection.x*t,z=start.z+unitDirection.z*t;
        if(start.y+unitDirection.y*t<groundHeight(x,z)+.22){available=Math.max(.12,t-.5);break;}
      }
    }
    return available;
  }

  function update(dt, subject, driving, sprinting, dragging, lookingBack, fighting = false) {
    if (!dt) return;
    const speed = driving ? Math.min(Math.abs(subject.speed) / 40, 1) : 0;
    if (wasDriving !== driving) freeLookDelay = 0;
    wasDriving = driving;
    if (!driving) { roadView = interior = false; headYaw = headPitch = 0; }
    if (interior) {
      yaw = subject.a;
      reverseView = damp(reverseView, lookingBack ? 2.87 : 0, 13, dt);
      freeLookDelay = Math.max(0,freeLookDelay-dt);
      if (!dragging && !freeLookDelay) {
        headYaw=damp(headYaw,0,4,dt);headPitch=damp(headPitch,0,4,dt);
      }
      clearance=0;occluded=false;
      return;
    }
    freeLookDelay = Math.max(0, freeLookDelay - dt);
    if (driving && !dragging && !freeLookDelay && !lookingBack) {
      yaw += angleDelta(yaw, subject.a) * blend(roadView ? 12 : 1.8 + speed * 2.5, dt);
      desiredPitch = damp(desiredPitch, .22, 1.4, dt);
    }
    pitch = damp(pitch, desiredPitch, 12, dt);
    reverseView = damp(reverseView, lookingBack ? Math.PI : 0, 12, dt);
    // A slight side view separates the silhouettes without rotating walking controls.
    const relative = angleDelta(subject.a, yaw);
    const sideView = fighting && !driving && !dragging && !lookingBack && !freeLookDelay
      ? (relative < -.03 ? -1 : 1) * Math.max(0,.96-Math.abs(relative)) : 0;
    fightAngle = damp(fightAngle,sideView,sideView ? 11 : 4,dt);
    const heading = yaw + reverseView + fightAngle;
    if (roadView) {
      // A forward view above the bumper keeps the horizon visible on bridge grades.
      const forwardX = -Math.sin(heading), forwardZ = -Math.cos(heading);
      const floor=subject.spec?.special?subject.y:groundHeight(subject.x,subject.z);
      const grade = (groundHeight(subject.x + forwardX * 1.5, subject.z + forwardZ * 1.5) -
        groundHeight(subject.x - forwardX * 1.5, subject.z - forwardZ * 1.5)) / 3;
      anchor.set(subject.x, floor + 1.12, subject.z);
      direction.set(forwardX, grade, forwardZ).normalize();
      clearance = clearDistance(anchor, direction, 2.7, subject);
      occluded = clearance < 2.69;
      camera.position.copy(anchor).addScaledVector(direction, clearance);
      direction.y += .20 - pitch;
      camera.lookAt(aim.copy(camera.position).add(direction));
      camera.fov = damp(camera.fov, 62 + speed * 8, 5, dt);
      camera.updateProjectionMatrix();
      return;
    }
    const follow = presets[preset];
    radius = damp(radius, driving ? follow.car + (subject.spec?.special?Math.max(0,subject.spec.length-2)*.85:0) + speed * 1.8 : follow.foot + (sprinting ? .45 : 0), 4, dt);
    focusHeight = damp(focusHeight, driving ? 1 : 1.35, 5, dt);
    anchor.set(subject.x,(subject.spec?.special?subject.y:groundHeight(subject.x,subject.z))+focusHeight,subject.z);
    shoulder = damp(shoulder, driving ? 0 : .38, 5, dt);
    lead = damp(lead, driving && !dragging && !freeLookDelay && !lookingBack ? speed * 3 : 0, 4, dt);
    aim.copy(anchor);
    aim.x += Math.cos(heading) * shoulder - Math.sin(subject.a) * lead * Math.sign(subject.speed || 0);
    aim.z -= Math.sin(heading) * shoulder + Math.cos(subject.a) * lead * Math.sign(subject.speed || 0);

    const elevation = pitch + Math.abs(fightAngle)*.14;
    direction.set(Math.sin(heading)*Math.cos(elevation), Math.sin(elevation), Math.cos(heading)*Math.cos(elevation));
    // Clamp the camera above the local ground before testing the final boom.
    const endX = anchor.x + direction.x * radius, endZ = anchor.z + direction.z * radius;
    direction.y = Math.max(direction.y, (groundHeight(endX, endZ) + .35 - anchor.y) / radius);
    direction.normalize();
    let available = clearDistance(anchor, direction, radius, subject);
    occluded = available < radius - .01;
    // In bumper-to-bumper traffic, favor seeing over the roof before
    // shortening the boom so far that the lens enters the player's own car.
    if (driving && available < 3) {
      raisedDirection.copy(direction);
      raisedDirection.y = Math.max(raisedDirection.y, .72);
      raisedDirection.normalize();
      const raisedDistance = clearDistance(anchor, raisedDirection, radius, subject);
      if (raisedDistance > available + .3) {
        direction.copy(raisedDirection);
        available = raisedDistance;
      }
    }
    if (driving && subject.spec?.special && available < 2.5) {
      for (const lift of [1.8,4]) {
        raisedDirection.set(direction.x,lift,direction.z).normalize();
        const room=clearDistance(anchor,raisedDirection,radius,subject);
        if(room>available+.3){available=room;direction.copy(raisedDirection)}
        if(available>=3)break;
      }
    }
    clearance = available < clearance || firstFrame ? available : damp(clearance, available, 5, dt);
    firstFrame = false;
    camera.position.copy(anchor).addScaledVector(direction, clearance);
    camera.lookAt(aim);
    camera.fov = damp(camera.fov, driving ? 54 + speed * 12 : sprinting ? 59 : 55, 4, dt);
    camera.updateProjectionMatrix();
  }

  return {
    update,
    align(subject){yaw=subject.a;reverseView=freeLookDelay=fightAngle=0;roadView=interior=false;firstFrame=true;},
    reset(){
      fightAngle=yaw=headYaw=headPitch=reverseView=freeLookDelay=lead=preset=0;
      pitch=desiredPitch=.18;radius=clearance=4.6;focusHeight=1.35;shoulder=.38;
      roadView=interior=wasDriving=occluded=false;firstFrame=true;
      camera.fov=menuFov;camera.updateProjectionMatrix();
    },
    get heading() { return yaw; },
    get interior() { return interior; },
    get headYaw() { return headYaw + reverseView; },
    get headPitch() { return headPitch; },
    toggleInterior() {
      interior=!interior; roadView=false; headYaw=headPitch=reverseView=0;
      return interior;
    },
    orbit(dx, dy) {
      if(interior){
        headYaw=MathUtils.clamp(headYaw-dx*.005,-1.6,1.6);
        headPitch=MathUtils.clamp(headPitch-dy*.004,-.54,.5);
        freeLookDelay=1.4;return;
      }
      yaw -= dx * .006;
      desiredPitch = MathUtils.clamp(desiredPitch + dy * .004, -.19, 1.03);
      freeLookDelay = 1.3;
    },
    cycle() {
      if (roadView) {roadView=false; interior=true; headYaw=headPitch=reverseView=0; return "Cockpit";}
      if (interior) {interior=false; preset=0; reverseView=0; return presets[preset].name;}
      if (wasDriving && preset === presets.length - 1 && !roadView) {
        roadView = true;
        desiredPitch = .2;
        return "Road";
      }
      roadView = false;
      preset = (preset + 1) % presets.length;
      return presets[preset].name;
    },
    showcase() {
      camera.position.set(1.7, 1.3, 18.2);
      camera.lookAt(-.2, 1, 15.4);
      if (camera.fov !== menuFov) { camera.fov = menuFov; camera.updateProjectionMatrix(); }
    },
    snapshot: () => ({preset: interior ? "Cockpit" : roadView ? "Road" : presets[preset].name, yaw, pitch, distance: clearance, occluded,
      freeLookDelay, lookBack: reverseView, fov: camera.fov, position: camera.position.toArray()}),
  };
}

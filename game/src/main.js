import {createFootPatrol} from './foot-patrol.js';
import {createAssaultTracker} from './assault.js';
import {reinforcementSite} from './backup.js';
import {installRoadblocks} from './roadblocks.js';
import {installAirWatch} from './air-watch.js';
import {responseFor, escalationSeconds} from './pursuit.js';
import {installTransport,atTerminal,atPier,coastWater} from './transport.js';
import {launcherPortrait} from './sahur.js';
import { createWeapons } from './weapons.js';
import { outsideMap, trailheads, route, groundType, drawCountryside } from './terrain.js';
import * as THREE from "three";
import { createCockpit } from "./cockpit.js";
import { createFollowCamera } from "./camera.js";
import { createWorld } from "./visuals.js";
import { installCharacterSelector } from "./selector.js";
const $ = (s) => document.querySelector(s);
const world = createWorld($("#world"));
installCharacterSelector(world);
const {
  scene,
  renderer,
  camera,
  roads,
  colliders,
  buildings,
  cars,
  cops,
  person,
  legs,
  box,
  mat,
  rand,
} = world;
const p = { x: 1, z: 15, a: 0, health: 100 };
let car = null,
  started = false,
  paused = false,
  wanted = 0,
  heatTimer = 0,
  tierTime = 0,
  job = 0,
  delivery = 0,
  toastTime = 0,
  bust = 0,
  pointerId = null,
  elapsed = 0;
const transport=installTransport(world);
const blocks=installRoadblocks(world);
const airWatch=installAirWatch(world,transport.units[1]);
world.roadblocks=blocks.slots;
const streetCops=cops.filter(c=>!c.spec?.special);
const footPatrol=createFootPatrol(world,streetCops);
world.footOfficers=footPatrol.officers;
const footOption=$("#foot-patrols");
let assaultCount=0,lastAssault=null;
function reportAssault(victim,kind){
  if(!started||bust)return;
  if(!victim.police)victim.startled=.85;
  assaultCount++;lastAssault=kind;
  const actor=car||p,lead=streetCops[0];
  if(!wanted && !lead.snackTime && Math.hypot(actor.x-lead.x,actor.z-lead.z)>48){
    const site=reinforcementSite(actor,0,actor.z< -176?'rural':'street',route,roads,[],cars,blocked);
    if(site)Object.assign(lead,{x:site.x,z:site.z,a:Math.atan2(site.x-actor.x,site.z-actor.z),speed:0,way:null,inContact:false});
  }
  Object.assign(airWatch.report,{x:actor.x,z:actor.z});
  heat(wanted+1);
  toast("ASSAULT REPORTED · "+wanted+(wanted===1?" STAR":" STARS"));
}
const assault=createAssaultTracker(world,reportAssault);
const followCamera = createFollowCamera(camera, [...buildings,...world.cameraObstacles], world.getGroundHeight, [...cars, ...cops]);
const cockpit = createCockpit(scene,renderer,camera);
const weapons = createWeapons(world,(unit,kind)=>{
  if(unit.muzzle)reportAssault(unit,kind);
  if(!wanted){heat(1);toast("PATROL STALLED · DISPATCH ALERTED")}
  sound(410,.10,"sine",.06);
},()=>{
  for(const [i,hz] of [146,128,111].entries())sound(hz,.072,"triangle",.10,i*.07);
},reportAssault);
const wheel=weapons.wheel;
const garage = $("#starter-car");
world.vehicleModels.ready.then(() => {
  garage.replaceChildren(...[...world.vehicleModels.options(),...transport.vehicles.map(c=>c.spec)].map(spec=>new Option(spec.name,spec.name)));
  garage.disabled=false;
  $("#start").disabled=!world.characters.getState().ready;
  if (!started) stageCar();
});
const portraits=new Map();
function specialSelected(){return transport.vehicles.find(c=>c.spec.name===garage.value)}
function stageCar() {
  const c=specialSelected(),fixed=c&&['boat','heli','plane'].includes(c.spec.kind);
  const fixedOption=departure.querySelector('[data-station]');
  if(fixedOption)fixedOption.remove();
  departure.disabled=Boolean(fixed);
  if(c){
    if(!portraits.has(c)){
      const g=new THREE.Group(),model=c.g.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);g.add(model);
      const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);g.scale.setScalar(1.35/Math.max(size.x,size.y,size.z));g.position.set(0,.105,-.12);
      portraits.set(c,launcherPortrait(renderer,g));
    }
    $("#garage-car").src=portraits.get(c);
    if(fixed){const opt=new Option(c.spec.station,'station');opt.dataset.station='1';departure.add(opt);departure.value='station'}
    else if(departure.value==='city')departure.value='East Pier';
  }else if(world.vehicleModels.stage(garage.value))$("#garage-car").src="/assets/garage/"+garage.value.replaceAll(" ","-")+".jpg";
}
garage.addEventListener("change",stageCar);
const keys = {};
let audioCtx;
function sound(freq, duration = 0.1, type = "sine", volume = 0.04, delay = 0) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(),
    g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const when=audioCtx.currentTime+delay;
  g.gain.setValueAtTime(volume,when);
  g.gain.exponentialRampToValueAtTime(0.001, when+duration);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(when);
  o.stop(when+duration);
}
function toast(t) {
  $("#toast").textContent = t;
  toastTime = 4;
  $("#toast").style.opacity = 1;
}
function dispatchLabel(domain,stars){
  if(!car && footPatrol.officers.some(u=>u.active))return "FOOT PURSUIT";
  if(domain==='water')return 'MARINE PATROL';
  if(domain==='air')return 'AIR PURSUIT';
  return responseFor(stars).label;
}
function heat(n = 1) {
  const next=Math.min(5,Math.max(wanted,n));
  if(next!==wanted)tierTime=0;
  wanted=next;
  heatTimer = 0;
}
const collisionCells = new Map();
for(const b of colliders){
  for(let x=Math.floor((b.x-b.w-2)/16);x<=Math.floor((b.x+b.w+2)/16);x++)
    for(let z=Math.floor((b.z-b.d-2)/16);z<=Math.floor((b.z+b.d+2)/16);z++){
      const key=x+','+z;
      if(!collisionCells.has(key))collisionCells.set(key,[]);
      collisionCells.get(key).push(b);
    }
}
function blocked(x, z, r = 0.7) {
  return (
    (outsideMap(x,z,r) && !atTerminal(x,z,r) && !atPier(x,z,r)) ||
    (collisionCells.get(Math.floor(x/16)+','+Math.floor(z/16)) || []).some(
      (b) => Math.abs(x - b.x) < b.w + r && Math.abs(z - b.z) < b.d + r && !(b.type==="water"&&world.isWaterWalkway(x,z,r)),
    )
  );
}
function moveEntity(e, dx, dz, r) {
  let hit = false;
  if (!blocked(e.x + dx, e.z, r) && !(e===p && blocks.hit(e.x+dx,e.z,r))) e.x += dx;
  else hit = true;
  if (!blocked(e.x, e.z + dz, r) && !(e===p && blocks.hit(e.x,e.z+dz,r))) e.z += dz;
  else hit = true;
  return hit;
}
// Elliptical footprints let pursuers pull alongside the player without
// entering the cabin, while keeping bumper-to-bumper contact farther apart.
function carRadius(entity, nx, nz) {
  const longitudinal = nx*Math.sin(entity.a) + nz*Math.cos(entity.a);
  const lateral = nx*Math.cos(entity.a) - nz*Math.sin(entity.a);
  return 1 / Math.hypot(longitudinal / ((entity.spec?.length || 4.5)*.5), lateral / 1.02);
}
function clearance(a,b,dx,dz,dist) {
  const nx=dx/(dist||1), nz=dz/(dist||1);
  return dist<.001 ? 3.2 : carRadius(a,nx,nz)+carRadius(b,nx,nz)+.14;
}
function canEnter(c){
  return Math.hypot(c.x-p.x,c.z-p.z)<(c.spec.special?5.8:4)&&(!c.spec.special||Math.abs(c.y-world.getGroundHeight(p.x,p.z))<3);
}
function interact() {
  if (!started || paused || bust) return;
  if (car) {
    if (Math.abs(car.speed) > 5) {
      toast("SLOW DOWN TO GET OUT");
      return;
    }
    if(transport.flight(car) && car.y-transport.floor(car.x,car.z)>1){toast("LAND BEFORE EXITING");return}
    let x=car.x+Math.cos(car.a)*2.5,z=car.z-Math.sin(car.a)*2.5;
    if(car.spec.special&&coastWater(car.x,car.z)){
      if(car.x<211||car.x>247||Math.abs(car.z)>8){toast("RETURN TO EAST PIER TO DISEMBARK");return}
      x=THREE.MathUtils.clamp(car.x,211,245);z=Math.sign(car.z)*1.3;
    }
    if (blocked(x, z)) {
      toast("DOOR BLOCKED — FIND SOME SPACE");
      return;
    }
    p.x = x;
    p.z = z;
    car.speed = 0;
    car = null;
    person.visible = true;
    toast("BACK ON FOOT");
    return;
  }
  const c = cars
    .filter(c=>canEnter(c))
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
  if (c) {
    car = c;
    c.traffic = false;
    person.visible = false;
    if(c===tourCar && job===0){toast("BACK IN YOUR CAR");return;}
    if (!wanted && !(cops[0].snackTime>0)) {
      const cop = cops[0];
      cop.x = roads.reduce(
        (a, b) => (Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a),
        roads[0],
      );
      cop.z = THREE.MathUtils.clamp(c.z + (c.z < 100 ? 48 : -48), -165, 165);
      cop.way = null;
      cop.speed = 0;
      cop.a = Math.atan2(cop.x - c.x, cop.z - c.z);
    }
    heat(1);
    sound(180, 0.2, "square");
    toast("VEHICLE TAKEN · POLICE ALERTED");
    if (job === 0) {
      job = 1;
      $("#objective").textContent = "Lose the heat.";
      $("#detail").textContent = "Keep moving. Break away from the police.";
    }
  }
}
function recover() {
  if (wanted) {
    toast("LOSE THE POLICE BEFORE RECOVERING");
    return;
  }
  const active=car||p;
  if(car?.spec.special){transport.reset(car);toast("BACK AT "+car.spec.station.toUpperCase());return}
  if(active.z < -176){
    const nearest=route.reduce((a,b)=>Math.hypot(active.x-a.x,active.z-a.z)<Math.hypot(active.x-b.x,active.z-b.z)?a:b);
    const index=route.indexOf(nearest),next=route[index+1]||route[index-1];
    Object.assign(active,{x:nearest.x,z:nearest.z,a:Math.atan2(nearest.x-next.x,nearest.z-next.z)});
    if(car)car.speed=0;
    toast("BACK ON THE COASTAL LOOP");return;
  }
  if (car) {
    car.x = 144;
    car.z = 0;
    car.a = 0;
    car.speed = 0;
    car.health = Math.max(50, car.health);
  } else {
    p.x = 1;
    p.z = 15;
    p.health = 100;
  }
  toast("RECOVERED TO A CLEAR ROAD");
}
addEventListener("keydown", (e) => {
  if(!started || bust>0 || (paused && e.code!=="Escape"))return;
  if(started && !paused && !bust && e.code==="Tab"){
    e.preventDefault();if(!e.repeat){pointerId=null;wheel.open()}return;
  }
  if(wheel.active){
    e.preventDefault();
    if(["ArrowLeft","Digit1"].includes(e.code))wheel.select(0);
    if(["ArrowRight","Digit2"].includes(e.code))wheel.select(1);
    if(e.code==="Escape")wheel.close(false);
    if(e.code==="Enter")wheel.close();
    return;
  }
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === "KeyF" && car && started && !paused) {
    toast(followCamera.toggleInterior() ? "DRIVER SEAT" : "EXTERIOR VIEW");
  }
  if (e.code === "KeyV" && started && !paused) toast(followCamera.cycle().toUpperCase() + " CAMERA");
  if (e.code === "KeyE") interact();
  if (e.code === "KeyR") recover();
  if (e.code === "Escape" && started) {
    clearInput();paused = !paused;
    $("#pause").hidden = !paused;
  }
});
addEventListener("keyup", (e) => {keys[e.code]=false;if(e.code==="Tab"&&wheel.active){e.preventDefault();wheel.close()}});
function clearInput(){
  wheel.close(false);
  if(pointerId!==null && canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
  pointerId = null;
  for (const k in keys) keys[k] = false;
}
addEventListener("blur", () => {
  clearInput();
  if (started && !bust) {
    paused = true;
    $("#pause").hidden = false;
  }
});
const departure = $("#departure");
departure.add(new Option('East Pier','East Pier'));
for(const place of trailheads)departure.add(new Option(place.name,place.name));
function craftHelp(c){
  if(c.spec.kind==='plane')return 'W builds water speed. Q climbs, Z descends. Land alongside East Pier to disembark.';
  if(c.spec.kind==='heli')return 'Q lifts, Z lowers. W/S controls forward speed. Land before exiting.';
  if(c.spec.kind==='boat')return 'Follow the channel buoys north. Slow alongside East Pier to disembark.';
  return 'Follow Ocean Avenue into town or head north for the coastal trail.';
}
let tourCar=null, sessionHomes=[], dispatched=0, dispatchDomain=null;
const patrolHomes=streetCops.map(({x,z,a})=>({x,z,a}));
function standDownReserves(){
  for(const unit of streetCops.slice(3))unit.active=unit.g.visible=false;
  dispatched=0;
}
function assignResponders(target){
  const domain=transport.domain;
  if(domain!==dispatchDomain){
    if(!(['rural','street'].includes(domain)&&['rural','street'].includes(dispatchDomain)))dispatched=0;
    dispatchDomain=domain;
  }
  const count=domain==='street'||domain==='rural'?responseFor(wanted).cruisers:0;
  if(!count){standDownReserves();return}
  for(let i=Math.max(1,dispatched);i<count;i++){
    const unit=streetCops[i];
    if(unit.snackTime>0)continue;
    const spot=reinforcementSite(target,i,domain,route,roads,streetCops.slice(0,i),cars,blocked);
    if(!spot)break;
    Object.assign(unit,{x:spot.x,z:spot.z,a:Math.atan2(spot.x-target.x,spot.z-target.z),
      speed:0,way:null,inContact:false});
    unit.active=unit.g.visible=true;
    dispatched=i+1;
  }
  // The local patrol is already on scene. Retry any unfilled slot next frame.
  dispatched=Math.min(count,Math.max(dispatched,1));
}
// Rear units keep their own lane or queue behind the lead unit on a narrow bend.
function moveCruiser(unit,dx,dz,index){
  let x=unit.x+dx,z=unit.z+dz;
  for(let i=0;i<index;i++){
    const lead=streetCops[i],sx=x-lead.x,sz=z-lead.z,dist=Math.hypot(sx,sz);
    const gap=clearance(unit,lead,sx,sz,dist)+.25;
    if(dist>=gap)continue;
    const side=index%2?1:-1;
    const nx=dist>.001?sx/dist:side*Math.cos(unit.a),nz=dist>.001?sz/dist:-side*Math.sin(unit.a);
    x=lead.x+nx*gap;z=lead.z+nz*gap;
    if(blocked(x,z,1.4))return true;
  }
  return moveEntity(unit,x-unit.x,z-unit.z,1.4);
}
function policeShotEvent(event,damage){
  if(event==='warn'){sound(615,.1,'sine',.045);return}
  if(event==='launch'){sound(185,.14,'triangle',.08);return}
  if(car){
    car.health=Math.max(0,car.health-damage);
    const exposed=['scooter','quad','boat'].includes(car.spec.kind);
    p.health=Math.max(0,p.health-Math.ceil(damage*(exposed?.55:.16)));
  }else p.health=Math.max(0,p.health-damage);
  toast("HIT BY A MEAT ROCKET");sound(82,.14,'triangle',.11);
}
function endRun(title){
  if(bust>0)return;
  bust=3;weapons.policeRockets.clear();clearInput();paused=false;
  $("#pause-title").textContent=title;$("#resume").textContent="RESPAWN DOWNTOWN";
  $("#pause").hidden=false;$("#resume").focus();
}
function resetSession(toMenu){
  bust=0;paused=false;started=!toMenu;clearInput();
  footPatrol.reset();assault.reset();assaultCount=0;lastAssault=null;
  for(const npc of world.pedestrians)npc.startled=0;
  car=tourCar=null;person.visible=true;
  Object.assign(p,{x:1,z:15,a:0,health:100});
  wanted=heatTimer=tierTime=delivery=job=dispatched=0;dispatchDomain=null;
  standDownReserves();blocks.reset();airWatch.reset();transport.pursue(p,0,0);weapons.reset();cockpit.leave();followCamera.reset();
  for(const [c,home] of sessionHomes)Object.assign(c,home);
  transport.vehicles.forEach(transport.reset);
  streetCops.forEach((c,i)=>Object.assign(c,patrolHomes[i],{speed:0,way:null,snackTime:0,inContact:false}));
  beacon.visible=false;
  $("#objective").textContent="Borrow something fast.";$("#detail").textContent="Find a car. Get in. Make it yours.";
  $("#pause").hidden=true;$("#pause-title").textContent="TAKE A BREATH.";$("#resume").textContent="BACK TO THE CITY";
  $("#intro").style.display=toMenu?"":"none";document.body.classList.toggle("menu-open",toMenu);
  if(toMenu){stageCar();$("#start").focus();toastTime=0;$("#toast").style.opacity=0}
  else {toast("BACK ON FOOT · ESC FOR A NEW SESSION");canvas.focus({preventScroll:true})}
}
$("#start").onclick = () => {
  if(!world.characters.getState().ready)return;
  document.body.classList.remove("menu-open");
  sessionHomes=cars.filter(c=>!c.spec.special).map(c=>[c,{x:c.x,z:c.z,a:c.a,speed:c.speed,traffic:c.traffic,health:100}]);
  started = true;
  $("#intro").style.display = "none";
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  clearInput();canvas.focus({preventScroll:true});
  const chosen=specialSelected(),start=trailheads.find(place=>place.name===departure.value),pier=departure.value==='East Pier';
  if(chosen||start||pier){
    car=tourCar=chosen||world.vehicleModels.starter;
    if(start||pier){const place=start||{x:159,z:0,a:Math.PI/2};Object.assign(car,{x:place.x,z:place.z,a:place.a,speed:0,traffic:false});
      if(car.spec.special)car.y=transport.floor(car.x,car.z);}
    p.x=car.x;p.z=car.z;person.visible=false;
    $("#objective").textContent=chosen?chosen.spec.name:"Coastal Loop";
    $("#detail").textContent=chosen?craftHelp(chosen):"Follow the marked road through the four trailheads and back to downtown.";
    toast((start?.name||(pier?"East Pier":chosen?.spec.station)||"East Pier").toUpperCase());
  }else toast("NORTH ON CENTRAL AVE · COASTAL LOOP");
  if($("#chase-start").checked){
    if(!car){car=tourCar=world.vehicleModels.starter;person.visible=false}
    if(!car.spec.special||['quad','scooter'].includes(car.spec.kind)){
      Object.assign(streetCops[0],{x:car.x,z:car.z+24,a:car.a,way:null,speed:0});
    }
    heat(1);toast("ONE STAR · DISPATCH ALERTED");
  }
};
$("#new-session").onclick=()=>resetSession(true);
$("#resume").onclick = () => {
  if(bust>0){resetSession(false);return}
  clearInput();paused = false;canvas.focus({preventScroll:true});
  $("#pause").hidden = true;
};
const canvas = $("#world");
let downX=0,downY=0,dragged=false;
canvas.addEventListener("pointerdown", (event) => {
  if (!started || paused || bust || wheel.active || event.button !== 0 || pointerId !== null) return;
  downX=event.clientX;downY=event.clientY;dragged=false;
  pointerId = event.pointerId;canvas.setPointerCapture(pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if(!wheel.active)weapons.setPointer(event.clientX,event.clientY);
  if (!paused && event.pointerId === pointerId){
    if(Math.hypot(event.clientX-downX,event.clientY-downY)>4)dragged=true;
    if(dragged)followCamera.orbit(event.movementX,event.movementY);
  }
});
canvas.addEventListener("pointerup",event=>{
  if(pointerId!==event.pointerId)return;
  pointerId=null;
  if(started && !paused && !bust && !wheel.active && !dragged && Math.hypot(event.clientX-downX,event.clientY-downY)<=4){
    weapons.setPointer(event.clientX,event.clientY);weapons.fire(car||p,car,followCamera.interior);
  }
});
for (const type of ["pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(type,event=>{if(pointerId===event.pointerId)pointerId=null});
}
const beacon = new THREE.Group();
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(5, 0.17, 6, 48),
  new THREE.MeshBasicMaterial({ color: "#ceff8e" }),
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.3;
beacon.add(ring);
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3, 28, 24, 1, true),
  new THREE.MeshBasicMaterial({
    color: "#ceff8e",
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
beam.position.y = 14;
beacon.add(beam);
beacon.position.set(144, 0, -130);
scene.add(beacon);
beacon.visible = false;
const map = $("#map").getContext("2d");
function drawMap(x, z, a) {
  map.clearRect(0, 0, 200, 200);
  map.fillStyle = "#143842";
  map.fillRect(0, 0, 200, 200);
  const sc = 0.69,
    tx = (v) => 100 + (v - x) * sc,
    tz = (v) => 100 + (v - z) * sc;
  map.fillStyle = "#69787c";
  for (const n of roads) {
    map.fillRect(tx(n - 9), tz(-177.5), 18 * sc, 355 * sc);
    map.fillRect(tx(-177.5), tz(n - 9), 355 * sc, 18 * sc);
  }
  map.fillStyle = "#a8b9a780";
  for (const b of buildings)
    map.fillRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * sc, b.d * sc);
  map.fillStyle = "#448d94";
  map.fillRect(tx(214), tz(-177), 1000, 355*sc);
  map.fillStyle="#b9a480";map.fillRect(tx(177.5),tz(-177),36.5*sc,355*sc);
  if(z< -28)drawCountryside(map,tx,tz,sc);
  for(const f of world.mapFeatures){map.fillStyle=f.type==='water'||f.type==='pool'?'#448d94':f.type==='bridge'?'#a3a79a':f.type==='dock'?'#ad9373':'#3b6b64';map.fillRect(tx(f.x-f.w/2),tz(f.z-f.d/2),f.w*sc,f.d*sc)}
  map.fillStyle="#c8a477";map.fillRect(tx(174),tz(-2.4),73*sc,4.8*sc);
  for (const c of cars) {
    map.fillStyle = c.spec.special?"#ffe38b":"#dae1cf";
    map.fillRect(tx(c.x) - 1.5, tz(c.z) - 1.5, 3, 3);
  }
  for(const b of blocks.slots){
    if(!b.root.visible||b.broken)continue;
    map.save();map.translate(tx(b.x),tz(b.z));map.rotate(-b.angle);
    map.fillStyle='#ffac46';map.fillRect(-4,-2,8,4);map.restore();
  }
  if(airWatch.lightPool.visible){
    const pos=airWatch.lightPool.position;
    map.beginPath();map.arc(tx(pos.x),tz(pos.z),airWatch.lightPool.scale.x*sc,0,Math.PI*2);
    map.fillStyle="#ffe7a129";map.strokeStyle="#ffe7a196";map.lineWidth=1;map.fill();map.stroke();
  }
  if (wanted)
    for (const c of cops) {
      if(c.active===false||(!c.spec?.special&&!streetCops.slice(0,dispatched).includes(c)))continue;
      map.fillStyle = c.snackTime>0?"#a2bdaf":elapsed % 1 < 0.5 ? "#ff6c69" : "#81b9ff";
      map.beginPath();
      if(c.spec?.kind==="heli"){
        const x=tx(c.x),y=tz(c.z);
        map.moveTo(x,y-5);map.lineTo(x+4,y);map.lineTo(x,y+5);map.lineTo(x-4,y);map.closePath();
      }else map.arc(tx(c.x), tz(c.z), 3.5, 0, 7);
      map.fill();
    }
  for(const unit of footPatrol.officers){
    if(!unit.active)continue;
    map.fillStyle=unit.snackTime>0?'#a2bdaf':'#ffb386';
    map.fillRect(tx(unit.x)-2,tz(unit.z)-2,4,4);
  }
  if (job === 2) {
    map.strokeStyle = "#ceff8e";
    map.lineWidth = 2;
    map.beginPath();
    map.arc(tx(144), tz(-130), 5, 0, 7);
    map.stroke();
  }
  map.save();
  map.translate(100, 100);
  map.rotate(-a);
  map.fillStyle = "#d5ffa8";
  map.beginPath();
  map.moveTo(0, -7);
  map.lineTo(-5, 5);
  map.lineTo(0, 2);
  map.lineTo(5, 5);
  map.fill();
  map.restore();
}
const rocketAlert=$("#rocket-warning");
const characterMeter=$("#character-health"),vehicleMeter=$("#vehicle-health");
function showHealth(meter,value){
  const hp=value==null?null:Math.max(0,Math.min(100,Math.ceil(value)));
  const text=hp==null?'—':hp+'%';
  if(meter.dataset.reading===text)return;
  meter.dataset.reading=text;
  meter.querySelector('b').textContent=text;
  const bar=meter.querySelector('meter');
  bar.value=hp??0;
  bar.setAttribute('aria-valuetext',hp==null?'On foot':text);
  meter.classList.toggle('inactive',hp==null);
  meter.classList.toggle('critical',hp!=null&&hp<=25);
}
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.04);
  last = now;
  if (paused || wheel.active) dt = 0;
  elapsed += dt;
  if(bust>0){
    bust=Math.max(0,bust-dt);
    if(bust===0)resetSession(false);
  }
  const target = car || p;
  if (started && !paused && !bust && !wheel.active) {
    const oldX=target.x,oldZ=target.z;
    if(car?.spec.special){
      transport.update(car,dt,keys,elapsed,moveEntity);
      if(car.health<=0){endRun("RIDE WRECKED.")}
    }else if (car) {
      const accel =
        (keys.KeyW || keys.ArrowUp ? 1 : 0) -
        (keys.KeyS || keys.ArrowDown ? 1 : 0);
      car.speed += accel * (accel * car.speed < 0 ? 27 : car.spec.power) * dt;
      car.speed *= Math.exp(-(keys.Space ? 4.5 : accel ? 0.13 : 0.85) * dt);
      car.speed = THREE.MathUtils.clamp(car.speed, -12, car.spec.limit);
      if(car.z < -176){
        const surface=groundType(car.x,car.z);
        const drag=surface==='sand'?.78:surface==='grass'?.38:surface==='rock'?.25:0;
        car.speed*=Math.exp(-drag*dt);
        // Gravity affects a moving car on a grade; a parked car stays put.
        if(Math.abs(car.speed)>.5 && !keys.Space)car.speed-=4.8*Math.sin(car.g.rotation.x)*dt;
      }
      const steer =
        (keys.KeyA || keys.ArrowLeft ? 1 : 0) -
        (keys.KeyD || keys.ArrowRight ? 1 : 0);
      car.a +=
        steer *
        dt *
        1.8 *
        Math.min(Math.abs(car.speed) / 9, 1) *
        Math.sign(car.speed);
      const hit = moveEntity(
        car,
        -Math.sin(car.a) * car.speed * dt,
        -Math.cos(car.a) * car.speed * dt,
        1.5,
      );
      if (hit && Math.abs(car.speed) > 3) {
        car.health -= Math.abs(car.speed) * 0.65;
        car.speed *= -0.25;
        heat(Math.max(1, wanted));
        sound(65, 0.15, "sawtooth", 0.07);
      }
      if (car.health <= 0) {
        endRun("RIDE WRECKED.");
      }
    } else {
      let x =
          (keys.KeyD || keys.ArrowRight ? 1 : 0) -
          (keys.KeyA || keys.ArrowLeft ? 1 : 0),
        z =
          (keys.KeyS || keys.ArrowDown ? 1 : 0) -
          (keys.KeyW || keys.ArrowUp ? 1 : 0);
      if (x || z) {
        const l = Math.hypot(x, z),
          s = keys.ShiftLeft || keys.ShiftRight ? 8 : 4.5;
        const heading = followCamera.heading;
        const dx = x * Math.cos(heading) + z * Math.sin(heading);
        const dz = z * Math.cos(heading) - x * Math.sin(heading);
        moveEntity(p, (dx / l) * s * dt, (dz / l) * s * dt, 0.5);
        p.a = Math.atan2(-dx, -dz);
        legs[0].rotation.x = Math.sin(elapsed * s * 2) * 0.6;
        legs[1].rotation.x = -legs[0].rotation.x;
      } else legs.forEach((l) => (l.rotation.x = 0));
    }
    const land=!transport.flight(target)&&target.spec?.kind!=='boat';
    if(!wanted||!land){blocks.reset();airWatch.reset()}
    if(car && land){
      const radius=car.spec.kind==='scooter'?.5:1.08;
      const steps=Math.max(1,Math.ceil(Math.hypot(car.x-oldX,car.z-oldZ)/.65));
      for(let i=1;i<=steps;i++){
        const block=blocks.hit(oldX+(car.x-oldX)*i/steps,oldZ+(car.z-oldZ)*i/steps,radius);
        if(block){blocks.drop(block);car.speed*=.53;car.health=Math.max(0,car.health-4);toast("BARRIER DOWN");break}
      }
    }
    if(!bust)assault.vehicleStep(car,oldX,oldZ);
    const pursuitRange=transport.pursue(target,wanted,dt);
    if (wanted) {
      assignResponders(target);
      const response=responseFor(wanted);
      footPatrol.deploy(target,dispatched,!car&&land&&footOption.checked,blocked,airWatch.groundContact);
      const groundUnits=streetCops.slice(0,dispatched).map((c,i)=>footPatrol.officers[i].active?footPatrol.officers[i]:c);
      const groundSeen=land && groundUnits.some(c=>airWatch.groundContact(c,target,response.range));
      const airSeen=land && airWatch.update(target,response,groundSeen,dt,transport.roof);
      const reported=groundSeen||airSeen;
      if(land)blocks.update(target,transport.domain,response.blocks,dt,reported,blocked);
      let nearest=reported?0:pursuitRange;
      let arresting=pursuitRange<(transport.domain==='air'?8:4.6)&&Math.abs(target.speed||0)<2;
      for (const [index,c] of streetCops.slice(0,dispatched).entries()) {
        const officer=footPatrol.officers[index];
        if(officer.active){
          if(footPatrol.update(officer,reported?target:airWatch.report,reported,target,wanted,dt,
            (x,z,r)=>blocked(x,z,r)||blocks.hit(x,z,r)))arresting=true;
          continue;
        }
        if(c.snackTime>0)continue;
        const dx = target.x - c.x,
          dz = target.z - c.z,
          dist = Math.hypot(dx, dz);
        let goal=reported?target:airWatch.report;
        if(index && reported && car && Math.abs(car.speed)>3 && dist<35){
          const side=index%2?2.9:-2.9;
          const behind=index<3?4:index<5?-6:10;
          const x=target.x+side*Math.cos(car.a)+behind*Math.sin(car.a);
          const z=target.z-side*Math.sin(car.a)+behind*Math.cos(car.a);
          if(!blocked(x,z,1.4))goal={x,z};
        }
        let wx=goal.x,wz=goal.z;
        // Route via intersections whenever the direct segment crosses a block.
        let clear = true;
        for (let t = 0.05; t < 1; t += 0.05)
          if (blocked(c.x + (goal.x-c.x) * t, c.z + (goal.z-c.z) * t, 1.5)) {
            clear = false;
            break;
          }
        if(!clear && transport.domain==='rural'){
          if(c.way && Math.hypot(c.x-c.way.x,c.z-c.way.z)<2)c.way=null;
          if(!c.way){
            const closest=(x,z)=>route.reduce((best,v,i)=>Math.hypot(v.x-x,v.z-z)<Math.hypot(route[best].x-x,route[best].z-z)?i:best,0);
            const from=closest(c.x,c.z),to=closest(goal.x,goal.z);
            const index=Math.hypot(c.x-route[from].x,c.z-route[from].z)>6?from:from+Math.sign(to-from)*Math.min(4,Math.abs(to-from));
            c.way=route[index];
          }
        }
        if (clear) c.way = null;
        if (!clear && c.way && Math.hypot(c.way.x - c.x, c.way.z - c.z) < 2)
          c.way = null;
        if (!clear && c.way) {
          wx = c.way.x;
          wz = c.way.z;
        } else if (!clear) {
          const snap = (v) =>
            roads.reduce(
              (best, n) => (Math.abs(n - v) < Math.abs(best - v) ? n : best),
              roads[0],
            );
          const nx = snap(c.x),
            nz = snap(c.z),
            tx = snap(goal.x),
            tz = snap(goal.z);
          wx = nx;
          wz = nz;
          if (Math.hypot(nx - c.x, nz - c.z) < 3) {
            if (Math.abs(tx - nx) > 1) wx = nx + Math.sign(tx - nx) * 48;
            else if (Math.abs(tz - nz) > 1) wz = nz + Math.sign(tz - nz) * 48;
          }
          c.way = { x: wx, z: wz };
        }
        const desired = Math.atan2(c.x - wx, c.z - wz),
          diff =
            THREE.MathUtils.euclideanModulo(
              desired - c.a + Math.PI,
              Math.PI * 2,
            ) - Math.PI;
        c.a += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
        c.speed = THREE.MathUtils.lerp(c.speed, car ? response.roadSpeed : response.footSpeed, dt);
        const wd = Math.hypot(wx - c.x, wz - c.z) || 1,
          contact = car ? clearance(c,car,dx,dz,dist) : 1.5,
          step = Math.min(c.speed * dt, wd, Math.max(0,dist-contact));
        if (car && dist < contact && dist > .001) {
          moveEntity(c,-dx/dist*(contact-dist),-dz/dist*(contact-dist),1.4);
        }
        if (
          moveCruiser(c, ((wx - c.x) / wd) * step, ((wz - c.z) / wd) * step,index)
        ) {
          c.a += dt * 4;
          c.speed *= 0.9;
        }
        if (dist < Math.max(4.1,contact+.18)) {
          if (car) {
            if(Math.abs(car.speed)<3){car.health-=dt*8;arresting=true}
            else if(!c.inContact && Math.abs(c.speed-Math.abs(car.speed))>9)car.health-=3;
            c.inContact=true;
          } else {
            p.health -= dt * 12;
            arresting = true;
          }
        }else if(dist>contact+2)c.inContact=false;
      }
      if(!bust && dt>0){
        const footResponse=!car&&groundUnits.some(c=>c.muzzle);
        const shooters=land?(footResponse?groundUnits.filter(c=>c.muzzle):groundUnits):transport.units.filter(c=>c.active);
        const rocketTier=footResponse&&!response.rocketInterval?
          {...response,rocketInterval:wanted===1?6.5:5.8,rocketDamage:wanted===1?4:5}:response;
        const canSee=land?airWatch.groundContact:(unit,actor,range)=>
          Math.hypot(unit.x-actor.x,unit.z-actor.z)<range && airWatch.visible(unit.x,unit.y+1.95,unit.z,actor.x,actor.y+1,actor.z);
        weapons.policeRockets.update(dt,target,car,shooters,rocketTier,canSee,(target.x-oldX)/dt,(target.z-oldZ)/dt,policeShotEvent);
      }
      delivery = arresting ? delivery + dt : 0;
      if(p.health<=0)endRun("WASTED.");
      else if(car && car.health<=0)endRun("RIDE WRECKED.");
      else if(delivery>=3)endRun("BUSTED.");
      if (nearest > response.range) {
        heatTimer += dt;
        $("#detail").textContent =
          `Stay out of sight. Heat fades in ${Math.max(0, Math.ceil(response.escape - heatTimer))}s.`;
      } else {
        heatTimer = 0;
        if(!bust && wanted<5){
          tierTime+=dt;
          if(tierTime>=escalationSeconds){heat(wanted+1);toast(wanted+" STARS · "+dispatchLabel(transport.domain,wanted))}
        }
        if (job === 1 || job === 2)
          $("#detail").textContent =
            "Police close by. Get some distance and keep moving.";
      }
      if (!bust && heatTimer >= response.escape) {
        wanted=tierTime=heatTimer=dispatched=0;dispatchDomain=null;footPatrol.reset();standDownReserves();blocks.reset();airWatch.reset();weapons.policeRockets.clear();transport.pursue(target,0,0);
        delivery = 0;
        toast("HEAT LOST · CLEAN GETAWAY");
        if (job === 2)
          $("#detail").textContent =
            "Reach the green marker on the coastal road.";
        if(job===0)$("#detail").textContent=car?.spec.special?craftHelp(car):tourCar?"Follow the marked road through the four trailheads and back to downtown.":"Find a car. Get in. Make it yours.";
        if (job === 3)
          $("#detail").textContent =
            "Job complete. The city is yours to explore.";
        if (job === 1) {
          job = 2;
          beacon.visible = true;
          $("#objective").textContent = "Bring it to the coast.";
          $("#detail").textContent =
            "Reach the green marker on the coastal road.";
          sound(620, 0.3);
        }
      }
    }
    if (
      job === 2 &&
      wanted === 0 &&
      car &&
      Math.hypot(car.x - 144, car.z + 130) < 8
    ) {
      job = 3;
      beacon.visible = false;
      $("#objective").textContent = "Welcome to the good life.";
      $("#detail").textContent = "Job complete. The city is yours to explore.";
      toast("JOB COMPLETE + $2,500");
      sound(880, 0.5);
    }
  }
  for (const c of cars) {
    if (c.traffic && c !== car && dt) {
      c.x -= Math.sin(c.a) * c.speed * dt;
      c.z -= Math.cos(c.a) * c.speed * dt;
      if (c.x < -170) c.x = 170;
      if (c.z < -170) c.z = 170;
      if (c.x > 170) c.x = -170;
      if (c.z > 170) c.z = -170;
    }
    if (car && car!==c && started && !bust && dt && Math.abs((car.y??world.getGroundHeight(car.x,car.z))-(c.y??world.getGroundHeight(c.x,c.z)))<2.3) {
      const dx=car.x-c.x, dz=car.z-c.z, dist=Math.hypot(dx,dz);
      const gap=clearance(car,c,dx,dz,dist);
      if (dist < gap && dist > .001) {
        if (Math.abs(car.speed)>7) {
          car.health-=Math.abs(car.speed-c.speed)*.55;
          car.speed*=-.2;
          heat(2);toast("TRAFFIC COLLISION · POLICE ALERTED");sound(70,.15,"sawtooth",.07);
        }
        const overlap=gap-dist;
        // Moving traffic yields when it reaches the occupied car.
        if(c.traffic) { c.x-=dx/dist*overlap; c.z-=dz/dist*overlap; }
        else moveEntity(car,dx/dist*overlap,dz/dist*overlap,1.5);
      }
    }
    if(car && car.health<=0 && !bust)endRun("RIDE WRECKED.");
    if(c.spec.special){transport.sync(c,dt,elapsed,c===car);continue}
    c.g.position.set(c.x, world.getGroundHeight(c.x,c.z), c.z);
    c.g.rotation.y = c.a;
  }
  for (const c of cops) {
    if(c.spec?.special){transport.sync(c,dt,elapsed,false);continue}
    c.g.position.set(c.x, world.getGroundHeight(c.x,c.z), c.z);
    c.g.rotation.y = c.a;
    c.light.material = mat(c.snackTime>0 ? "#b9a363" : Math.sin(elapsed * 14) > 0 ? "#ff5656" : "#438eff");
  }
  person.position.set(p.x, world.getGroundHeight(p.x,p.z), p.z);
  person.rotation.set(0,p.a,0);
  if (started) {
    const sprinting = !car && (keys.ShiftLeft || keys.ShiftRight) &&
      (keys.KeyA || keys.KeyD || keys.KeyW || keys.KeyS || keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown);
    followCamera.update(dt, car || p, Boolean(car), sprinting, pointerId !== null, keys.KeyC);
  } else {
    person.rotation.y = Math.PI;
    followCamera.showcase();
  }
  $("#wanted").textContent = "★".repeat(wanted) + "☆".repeat(5 - wanted);
  const dispatchHud=$("#chase-status");
  dispatchHud.hidden=!started||!wanted||bust>0;
  if(!dispatchHud.hidden)dispatchHud.textContent=heatTimer>0?"SEARCH · "+Math.ceil(responseFor(wanted).escape-heatTimer)+"s":
    dispatchLabel(transport.domain,wanted)+(airWatch.spotted?" · SPOTTED":"")+(wanted<5?" · NEXT STAR "+Math.max(1,Math.ceil(escalationSeconds-tierTime))+"s":"");
  $("#mode").textContent = car ? (car.model||"COAST SEDAN").toUpperCase() : (world.characters.getState().selected==="jean"?"JEAN / ON FOOT":"MARA / ON FOOT");
  $("#speed").innerHTML =
    Math.round(Math.abs(car ? car.speed : 0) * 2.237) + "<small> MPH</small>";
  showHealth(characterMeter,p.health);
  showHealth(vehicleMeter,car?.health);
  rocketAlert.textContent=weapons.policeRockets.warning;
  rocketAlert.hidden=!started||Boolean(bust)||!rocketAlert.textContent;
  $("#progress i").style.width =
    (job === 1 ? 25 + heatTimer * 4 : job === 2 ? 75 : job === 3 ? 100 : 0) +
    "%";
  const near = !car && cars.some(canEnter);
  $("#prompt").style.display =
    started && !paused && (near || car) ? "block" : "none";
  $("#prompt").innerHTML = car
    ? "<kbd>E</kbd> EXIT VEHICLE"
    : "<kbd>E</kbd> TAKE VEHICLE";
  if (toastTime > 0) {
    toastTime -= dt;
    if (toastTime <= 0) $("#toast").style.opacity = 0;
  }
  const district=world.districtAt(target.x,target.z);$(".district").innerHTML=district+' <span> // FREE ROAM</span>';$("#radar>span").textContent=district;
  drawMap(target.x, target.z, car ? car.a : p.a);
  world.updateVisuals(dt, elapsed, car, p, camera, started);
  if(car?.spec.special){
    cockpit.leave();person.visible=!followCamera.interior;
    if(person.visible)world.characters.sit(car);
    else{
      camera.position.set(...car.spec.eye).applyQuaternion(car.g.quaternion).add(car.g.position);
      camera.quaternion.copy(car.g.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08+followCamera.headPitch,followCamera.headYaw,0,'YXZ')));
      camera.fov=70;camera.updateProjectionMatrix();
    }
  }else if(car && followCamera.interior){
    const steering=Number(Boolean(keys.KeyA||keys.ArrowLeft))-Number(Boolean(keys.KeyD||keys.ArrowRight));
    cockpit.render(car,dt,elapsed,steering,followCamera.headYaw,followCamera.headPitch,map.canvas,district);
  } else cockpit.leave();
  $("#flight-controls").hidden=!started||!transport.flight(car);
  if(transport.flight(car))$("#flight-alt").textContent=Math.round(Math.max(0,car.y-transport.floor(car.x,car.z)))+" m";
  weapons.update(dt,car||p,car,Boolean(car&&followCamera.interior),started && !bust);
  $("#weapon-hint").hidden=!started||paused||wheel.active||!wheel.armed||Boolean(bust);
  canvas.classList.toggle("serving",started&&wheel.armed&&!paused&&!wheel.active);
  world.render();
}
requestAnimationFrame(tick);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  world.resize();
});
// Read-only state supports repeatable quality checks without altering play.
window.gameState = () => ({
  started,
  weapons:weapons.state(),
  paused,
  mode: car ? "driving" : "on foot",
  position: { x: (car || p).x, z: (car || p).z },
  angle: (car || p).a,
  speed: car?.speed || 0,
  wanted,
  health: car?.health ?? p.health, characterHealth:Math.max(0,p.health), vehicleHealth:car?Math.max(0,car.health):null, policeRockets:weapons.policeRockets.state(),
  job,
  heatTimer, tierTime, bustRemaining:bust,
  assaults:assaultCount,lastAssault,footPatrols:footOption.checked,
  officers:footPatrol.officers.filter(u=>u.active).map(u=>({x:u.x,z:u.z,stalled:u.snackTime,speed:u.speed})),
  pursuit:transport.domain, roadblocks:blocks.state(), airCover:airWatch.deployed, spotlightContact:airWatch.spotted,
  police: cops.filter(c=>c.active!==false).map(c=>({responding:wanted>0&&(c.spec?.special?c.active:streetCops.slice(0,dispatched).includes(c)),stalled:c.snackTime||0,speed:c.speed,x:c.x,z:c.z,y:c.y??world.getGroundHeight(c.x,c.z),type:c.model||"Cruiser"})),
  cars: cars.map((c) => ({ x: c.x, z: c.z, traffic: c.traffic,model:c.model||"Coast Sedan" })),
  vehicle:car?.spec.name ?? null,
  camera: followCamera.snapshot(),
  cockpit: cockpit.name,
  renderCalls: renderer.info.render.calls,
  visuals: world.visualState(),
  character: world.characters.getState(),
  vehicleModels: world.vehicleModels.getState(),
  altitude:car?.spec.special?car.y:world.getGroundHeight((car||p).x,(car||p).z),
  surface: car?.spec.special&&coastWater(car.x,car.z)?"water":groundType((car||p).x,(car||p).z),
  district: world.districtAt((car||p).x,(car||p).z),
  elevation: world.getGroundHeight((car||p).x,(car||p).z),
});

import {createPoliceRockets} from './police-rockets.js';
import {disablePatrol} from './pursuit.js';
import {craftLauncher} from './craft-launchers.js';
import * as T from 'three';
import {createImpactSurfaces} from './impact-surfaces.js';
import {createSauce} from './sauce.js';
import {makeHotdog, makeLauncher, launcherPortrait} from './sahur.js';

export function createWeaponWheel(portrait) {
  const overlay=document.querySelector('#weapon-wheel'), slots=[...overlay.querySelectorAll('[data-slot]')];
  const title=overlay.querySelector('h2'),desc=overlay.querySelector('p');
  const names=['Unarmed','The Meat Rocket'], descriptions=['Click a nearby person to strike','Hot-dog launcher  ·  Unlimited servings'];
  let equipped=0,selected=0;
  overlay.querySelector('img').src=portrait;
  function select(i){
    selected=i;title.textContent=names[i];desc.textContent=descriptions[i];
    for(const [j,b] of slots.entries())b.setAttribute('aria-pressed',String(i===j));
  }
  function close(commit=true){if(overlay.hidden)return;if(commit)equipped=selected;overlay.hidden=true;}
  for(const [i,b] of slots.entries()){
    b.addEventListener('pointerenter',()=>select(i));
    b.addEventListener('click',()=>{select(i);close()});
  }
  overlay.addEventListener('pointermove',e=>{
    const dx=e.clientX-innerWidth/2,dy=e.clientY-innerHeight/2;
    if(Math.hypot(dx,dy)>44 && Math.abs(dx)>10)select(dx<0?0:1);
  });
  return {configure(name,description,img){
    names[1]=name;descriptions[1]=description;slots[1].setAttribute('aria-label',name+' launcher');slots[1].querySelector('small').textContent=name;
    overlay.querySelector('img').src=img;document.querySelector('#weapon-hint b').textContent=name;select(selected);
  },reset(){close(false);equipped=0;select(0)},open(){if(overlay.hidden){select(equipped);overlay.hidden=false}},close,select,
    get active(){return !overlay.hidden},get armed(){return equipped===1}};
}

export function createWeapons(world,onTag,onLaunch,onAssault) {
  const {scene,renderer,camera,cops,cars,getGroundHeight}=world;
  const meat=makeLauncher(),images=new Map(),variants=new Map([['The Meat Rocket',meat],['Tralalero Splash',craftLauncher(true)],['Crocodilo Cannoli',craftLauncher(false)]]);
  let {model,load,mouth}=meat, weaponName='The Meat Rocket';
  images.set(weaponName,launcherPortrait(renderer,model));
  const wheel=createWeaponWheel(images.get(weaponName));
  for(const v of variants.values()){scene.add(v.model);v.model.visible=false}
  function loadout(car){
    const name=car?.spec.weapon||'The Meat Rocket';if(name===weaponName)return;
    model.visible=false;weaponName=name;
    const v=variants.get(name);({model,load,mouth}=v);
    if(!images.has(name)){const was=model.visible;model.visible=true;images.set(name,launcherPortrait(renderer,model));model.visible=was}
    wheel.configure(name,name==='The Meat Rocket'?'Hot-dog launcher · Unlimited servings':name==='Tralalero Splash'?'Sneaker sharks · Unlimited servings':'Flying cannoli · Unlimited servings',images.get(name));
  }
  const mount=new T.Group();
  const brass=new T.MeshStandardMaterial({color:0xaf8050,metalness:.45,roughness:.43});
  for(const [radius,height,y] of [[.31,.09,.01],[.105,.19,.12],[.20,.045,.22]]){
    const part=new T.Mesh(new T.CylinderGeometry(radius,radius*1.1,height,24),brass);
    part.position.y=y;part.castShadow=true;mount.add(part);
  }
  model.visible=mount.visible=false;scene.add(model,mount);
  const snack=makeHotdog(),surfaces=createImpactSurfaces(world),sauce=createSauce(scene);
  const policeRockets=createPoliceRockets(world,snack,surfaces,sauce);
  const shots=[],tags=[],forward=new T.Vector3(0,0,-1);
  const aimRay=new T.Ray(),cast=new T.Raycaster(),pos=new T.Vector3(),dir=new T.Vector3();
  const handOffset=new T.Vector3(),leftGrip=new T.Vector3();
  const point=new T.Vector3(),delta=new T.Vector3(),impact=new T.Vector3();
  const localRay=new T.Ray(),inverse=new T.Matrix4(),vehicleBox=new T.Box3(),pointer=new T.Vector2(0,0);
  const walls=[...world.buildings,...world.cameraObstacles].map(({x,z,w,d,h,base=-.2})=>
    new T.Box3(new T.Vector3(x-w/2,base,z-d/2),new T.Vector3(x+w/2,h,z+d/2)));
  let shotsFired=0,hits=0,cooldown=0,kick=0;

  function setPointer(x,y){pointer.set(x/innerWidth*2-1,1-y/innerHeight*2)}
  function intersect(ray,limit,skip){
    let nearest=limit,object=null;
    for(const wall of walls){
      if(wall.distanceToPoint(ray.origin)>nearest)continue;
      if(ray.intersectBox(wall,point)){const d=ray.origin.distanceTo(point);if(d<nearest){nearest=d;object=wall}}
    }
    for(const c of [...cops,...cars]){
      if(c.active===false||c===skip||Math.hypot(c.x-ray.origin.x,c.z-ray.origin.z)>nearest+4)continue;
      inverse.copy(c.g.matrixWorld).invert();localRay.copy(ray).applyMatrix4(inverse);
      vehicleBox.min.set(-1.05,-.08,-(c.spec?.length||4.6)*.5);
      vehicleBox.max.set(1.05,['truck','utility'].includes(c.spec?.kind)?1.88:1.6,(c.spec?.length||4.6)*.5);
      if(vehicleBox.containsPoint(localRay.origin)){point.copy(ray.origin)}
      else if(localRay.intersectBox(vehicleBox,point)){point.applyMatrix4(c.g.matrixWorld)}
      else continue;
      const d=ray.origin.distanceTo(point);if(d<nearest){nearest=d;object=c}
    }
    return {distance:nearest,object};
  }
  function targetPoint(skip){
    cast.setFromCamera(pointer,camera);const ray=cast.ray, hit=intersect(ray,100,skip);
    for(let t=.6;t<hit.distance;t+=.75){
      ray.at(t,point);if(point.y<getGroundHeight(point.x,point.z)+.06)return point.clone();
    }
    return ray.at(hit.distance,new T.Vector3());
  }
  function place(actor,car,interior){
    model.visible=wheel.armed&&!interior;
    mount.visible=model.visible&&Boolean(car);
    if(!wheel.armed)return;
    const dest=targetPoint(car);
    if(car){
      if(car.spec.port)mount.position.set(...car.spec.port);else mount.position.set(.10,(car.roofHeight||1.5)-.04,.03);
      mount.position.applyQuaternion(car.g.quaternion).add(car.g.position);
      mount.quaternion.copy(car.g.quaternion);
      pos.set(0,.35,0).applyQuaternion(car.g.quaternion).add(mount.position);
    }else{
      const yaw=Math.atan2(actor.x-dest.x,actor.z-dest.z);
      world.person.rotation.y=yaw;
      if(!world.characters.shoulderPosition(pos))pos.set(actor.x,getGroundHeight(actor.x,actor.z)+1.36,actor.z);
      pos.add(handOffset.set(-.025,-.17,-.24).applyQuaternion(world.person.quaternion));

    }
    model.position.copy(pos);
    dir.subVectors(dest,pos).normalize();
    // Yaw followed by pitch keeps the upright wooden face level at every bearing.
    model.rotation.order='YXZ';model.rotation.set(Math.asin(dir.y),Math.atan2(-dir.x,-dir.z),-.06*kick,'YXZ');
    model.scale.setScalar(car?1.28:.92);
    model.translateZ(kick*.045);load.visible=cooldown<.22;
    if(!car)world.characters.holdLauncher(model.localToWorld(handOffset.set(0,0,.04)),model.localToWorld(leftGrip.set(-.045,.055,-.33)));

  }
  function tag(c,kind="rocket"){
    hits++;disablePatrol(c);onTag(c,kind);
    if(tags.some(t=>t.c===c))return;
    const flag=document.createElement('div');flag.className='snack-tag';flag.setAttribute('role','presentation');
    document.body.append(flag);tags.push({flag,c});

  }
  let strikeTime=0;
  const strikePoint=new T.Vector3();
  function strike(actor){
    if(cooldown>0||wheel.active)return;
    cast.setFromCamera(pointer,camera);
    const hit=surfaces.cast(cast.ray,100);
    if(!hit?.civilian && hit?.kind!=='officer')return;
    pos.set(actor.x,getGroundHeight(actor.x,actor.z)+1.1,actor.z);
    if(pos.distanceTo(hit.point)>1.9)return;
    dir.subVectors(hit.point,pos);const reach=dir.length();
    const contact=surfaces.cast(aimRay.set(pos,dir.normalize()),reach+.08);
    if(!contact || (contact.civilian!==hit.civilian || contact.vehicle!==hit.vehicle))return;
    cooldown=.65;strikeTime=.24;strikePoint.copy(hit.point);
    actor.a=Math.atan2(actor.x-hit.point.x,actor.z-hit.point.z);
    if(hit.civilian)onAssault(hit.civilian,'strike');else tag(hit.vehicle,'strike');
  }
  function fire(actor,car,interior){
    if(!wheel.armed&&!car){strike(actor);return}
    if(!wheel.armed||wheel.active||cooldown>0)return;
    place(actor,car,interior);
    cast.setFromCamera(pointer,camera);
    const aimed=surfaces.cast(cast.ray,100,car);
    const dest=aimed?.point||cast.ray.at(100,new T.Vector3());
    const origin=model.localToWorld(mouth.clone());
    // Start at the hand/roof if the projecting toy would extend beyond a wall.
    delta.subVectors(origin,pos);const reach=delta.length();aimRay.set(pos,delta.normalize());
    if(surfaces.cast(aimRay,reach,car))origin.copy(pos);
    const distance=origin.distanceTo(dest),duration=Math.max(.07,distance/60);
    const m=(variants.get(weaponName).ammo||snack).clone(true);m.scale.setScalar(1.32);m.position.copy(origin);
    const tracked=aimed?.civilian?aimed.mesh:aimed?.vehicle?.police?aimed.vehicle.g:null;
    const localHit=tracked?tracked.worldToLocal(dest.clone()):null;
    scene.add(m);shots.push({m,origin,end:dest,age:0,duration,arc:Math.min(1.6,distance*.047),skip:car,tracked,localHit});
    shotsFired++;cooldown=.33;kick=1;onLaunch();
  }
  function update(dt,actor,car,interior,live){
    loadout(car);cooldown=Math.max(0,cooldown-dt);kick=Math.max(0,kick-dt*6);
    if(live)place(actor,car,interior);else model.visible=mount.visible=false;
    if(strikeTime>0){
      strikeTime=Math.max(0,strikeTime-dt);
      if(live&&!car&&!wheel.armed)world.characters.reachRight(strikePoint);
    }
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i];s.age+=dt;const t=Math.min(1,s.age/s.duration);
      if(s.tracked?.visible)s.end.copy(s.tracked.localToWorld(point.copy(s.localHit)));
      const next=impact.lerpVectors(s.origin,s.end,t);next.y+=4*s.arc*t*(1-t);
      delta.subVectors(next,s.m.position);const length=delta.length();if(length<.00001&&t<1)continue;
      aimRay.set(s.m.position,delta.normalize());
      const hit=surfaces.cast(aimRay,length+.012,s.skip);
      if(hit||t===1){
        if(hit){sauce.deposit(hit);if(hit.vehicle?.police)tag(hit.vehicle);else if(hit.civilian&&live)onAssault(hit.civilian,"rocket")}
        scene.remove(s.m);shots.splice(i,1);
      }else{s.m.position.copy(next);s.m.quaternion.setFromUnitVectors(forward,delta);s.m.rotateZ(s.age*5)}
    }
    sauce.update(dt);
    for(const c of [...cops,...world.footOfficers])c.snackTime=Math.max(0,(c.snackTime||0)-dt);
    for(let i=tags.length-1;i>=0;i--){
      const t=tags[i];
      if(t.c.snackTime<=0||!t.c.g.visible){t.flag.remove();tags.splice(i,1);continue}
      pos.set(t.c.x,(t.c.y??getGroundHeight(t.c.x,t.c.z))+2.9,t.c.z).project(camera);
      t.flag.hidden=pos.z>1||pos.z< -1;
      t.flag.style.left=(50+pos.x*50)+'%';t.flag.style.top=(50-pos.y*50)+'%';t.flag.textContent='STALLED · '+Math.ceil(t.c.snackTime)+'s';
    }
  }
  function reset(){
    for(const s of shots)scene.remove(s.m);
    sauce.reset();policeRockets.reset();
    for(const t of tags)t.flag.remove();
    shots.length=tags.length=shotsFired=hits=0;cooldown=kick=strikeTime=0;wheel.reset();
    for(const c of cops)c.snackTime=0;
  }
  return {policeRockets,wheel,setPointer,fire,update,reset,state:()=>({name:wheel.armed?weaponName:null,equipped:wheel.armed?(weaponName==='The Meat Rocket'?'sahur':weaponName):'unarmed',wheelOpen:wheel.active,shotsFired,hits,inFlight:shots.length,sauce:sauce.state()})};
}

import {createBananaHammer,hammerName,hammerPose,hammerSwing} from './bananini.js';
import {crocName,crocLauncher,spinProps} from './crocodilo.js';
import {beginBodyReaction} from './pedestrian-impact.js';
import {createBlasts} from './blast.js';
import {createPoliceRockets} from './police-rockets.js';
import {disablePatrol} from './pursuit.js';
import {craftLauncher} from './craft-launchers.js';
import * as T from 'three';
import {createImpactSurfaces} from './impact-surfaces.js';
import {createSauce} from './sauce.js';
import {makeHotdog, makeLauncher, launcherPortrait} from './sahur.js';

export function createWeaponWheel(portrait,crocPortrait,hammerPortrait) {
  const overlay=document.querySelector('#weapon-wheel'), slots=[...overlay.querySelectorAll('[data-slot]')];
  const title=overlay.querySelector('h2'),desc=overlay.querySelector('p');
  const names=['Unarmed','The Meat Rocket',crocName,hammerName], descriptions=['Click a nearby person to strike','Hot-dog launcher  ·  Unlimited servings','Propeller rocket · Explodes on impact','Banana mallet · Double punch damage'];
  let equipped=0,selected=0;
  slots[1].querySelector('img').src=portrait;
  slots[2].querySelector('img').src=crocPortrait;
  slots[3].querySelector('img').src=hammerPortrait;
  const hint=document.querySelector('#weapon-hint');
  function updateHint(){
    hint.querySelector('b').textContent=names[equipped];
    hint.querySelector('span').textContent=equipped===3?'Click or J to swing · On foot':equipped===2?'Click to launch · Drag to look':'Click to serve · Drag to look';
  }
  function select(i){
    selected=i;title.textContent=names[i];desc.textContent=descriptions[i];
    for(const [j,b] of slots.entries())b.setAttribute('aria-pressed',String(i===j));
  }
  function close(commit=true){if(overlay.hidden)return;if(commit){equipped=selected;updateHint()}overlay.hidden=true;}
  for(const [i,b] of slots.entries()){
    b.addEventListener('click',()=>{select(i);close()});
  }
  overlay.addEventListener('pointermove',e=>{
    // Opening the wheel under a stationary cursor can produce a boundary event.
    // Only deliberate motion should override a number-key selection.
    if(e.pointerType==='mouse' && !e.movementX && !e.movementY)return;
    const disc=overlay.querySelector('.weapon-disc').getBoundingClientRect();
    const dx=e.clientX-disc.left-disc.width/2,dy=e.clientY-disc.top-disc.height/2;
    if(Math.hypot(dx,dy)>disc.width*.09)select(Math.abs(dx)>Math.abs(dy)?(dx<0?0:1):(dy<0?2:3));
  });
  return {configure(name,description,img){
    names[1]=name;descriptions[1]=description;slots[1].setAttribute('aria-label',name+' launcher');slots[1].querySelector('small').textContent=name;
    slots[1].querySelector('img').src=img;updateHint();select(selected);
  },reset(){close(false);equipped=0;select(0)},open(){if(overlay.hidden){select(equipped);overlay.hidden=false}},close,select,
    get active(){return !overlay.hidden},get armed(){return equipped!==0},get melee(){return equipped===0||equipped===3},get hammer(){return equipped===3},get equipped(){return equipped}};
}

export function createWeapons(world,onTag,onLaunch,onAssault,blastOptions) {
  const {scene,renderer,camera,cops,cars,getGroundHeight}=world;
  const meat=makeLauncher(),croc=crocLauncher(),images=new Map(),variants=new Map([[crocName,croc],['The Meat Rocket',meat],['Tralalero Splash',craftLauncher(true)],['Crocodilo Cannoli',craftLauncher(false)]]);
  let {model,load,mouth}=meat, weaponName='The Meat Rocket';
  images.set(weaponName,launcherPortrait(renderer,model));
  const hammer=createBananaHammer(),preview=new T.Group();
  preview.userData.portraitView=[.82,.7,2.7];
  const prop=hammer.clone();prop.rotation.z=-.42;prop.position.set(-.11,-.15,0);preview.add(prop);
  const wheel=createWeaponWheel(images.get(weaponName),launcherPortrait(renderer,croc.model),launcherPortrait(renderer,preview));
  scene.add(hammer);hammer.visible=false;
  for(const v of variants.values()){scene.add(v.model);v.model.visible=false}
  let primaryName='The Meat Rocket',propTime=0;
  function loadout(car){
    const primary=car?.spec.weapon||'The Meat Rocket';
    if(primary!==primaryName){
      primaryName=primary;
      const variant=variants.get(primary);
      if(!images.has(primary)){
        const visible=variant.model.visible;
        variant.model.visible=true;images.set(primary,launcherPortrait(renderer,variant.model));variant.model.visible=visible;
      }
      const desc=primary==='The Meat Rocket'?'Hot-dog launcher':primary==='Tralalero Splash'?'Sneaker sharks':'Flying cannoli';
      wheel.configure(primary,desc+' · Unlimited servings',images.get(primary));
    }
    const name=wheel.equipped===2?crocName:primary;
    if(name===weaponName)return;
    model.visible=false;weaponName=name;
    ({model,load,mouth}=variants.get(name));
  }
  const mount=new T.Group();
  const brass=new T.MeshStandardMaterial({color:0xaf8050,metalness:.45,roughness:.43});
  for(const [radius,height,y] of [[.31,.09,.01],[.105,.19,.12],[.20,.045,.22]]){
    const part=new T.Mesh(new T.CylinderGeometry(radius,radius*1.1,height,24),brass);
    part.position.y=y;part.castShadow=true;mount.add(part);
  }
  model.visible=mount.visible=false;scene.add(model,mount);
  const snack=makeHotdog(),surfaces=createImpactSurfaces(world),sauce=createSauce(scene);
  const blasts=createBlasts(world,{...blastOptions,tag,onAssault,staticCast:(ray,distance)=>surfaces.cast(ray,distance,null,true)});
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
    hammer.visible=wheel.hammer&&!car;
    model.visible=wheel.armed&&!wheel.hammer&&!interior;
    mount.visible=model.visible&&Boolean(car);
    if(wheel.hammer){if(!car)hammerPose(hammer,world,swingAge,handOffset,leftGrip);return;}
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
  const punchSwing={duration:.36,contact:.145,cooldown:.46,reach:1.42};
  let swingAge=-1,swingKind=null,swings=0,hammerHits=0,punches=0,punchHits=0,pendingContact=null;
  let framingTime=0;
  const strikePoint=new T.Vector3();
  function findStrikeTarget(actor,autoAim,limit){
    pos.set(actor.x,getGroundHeight(actor.x,actor.z)+1.18,actor.z);
    let target=null;
    if(autoAim){
      let nearest=limit;
      for(const n of [...world.pedestrians,...world.footOfficers]){
        const root=n.root||n.g;
        if(!root.visible||n.behavior==='defeated'||n.behavior==='exiting')continue;
        const dx=root.position.x-actor.x,dz=root.position.z-actor.z,d=Math.hypot(dx,dz);
        if(d>=nearest||-dx*Math.sin(actor.a)-dz*Math.cos(actor.a)<-.12*d)continue;
        const torso=root.position.clone();torso.y+=1.2;
        delta.subVectors(torso,pos);const reach=delta.length();if(reach>limit+.04)continue;
        const h=surfaces.cast(aimRay.set(pos,delta.normalize()),reach+.2);
        if(h && (h.civilian===n||h.vehicle===n)){target=h;nearest=d;}
      }
    }else{
      cast.setFromCamera(pointer,camera);
      const h=surfaces.cast(cast.ray,100);
      if(h?.civilian||h?.kind==='officer'){
        delta.subVectors(h.point,pos);const reach=delta.length();
        if(reach<=limit){
          const contact=surfaces.cast(aimRay.set(pos,delta.normalize()),reach+.08);
          if(contact && contact.civilian===h.civilian && contact.vehicle===h.vehicle)target=h;
        }
      }
    }
    return target;
  }
  function strike(actor,autoAim=false){
    if(cooldown>0||wheel.active||!wheel.melee)return;
    const heavy=wheel.hammer, timing=heavy?hammerSwing:punchSwing;
    const target=findStrikeTarget(actor,autoAim,timing.reach);
    swingAge=0;swingKind=heavy?'hammer':'strike';cooldown=timing.cooldown;
    if(heavy)swings++;else punches++;
    pendingContact=null;
    strikePoint.set(actor.x-Math.sin(actor.a),getGroundHeight(actor.x,actor.z)+1.46,actor.z-Math.cos(actor.a));
    if(target){
      framingTime=1.5;
      actor.a=Math.atan2(actor.x-target.point.x,actor.z-target.point.z);
      strikePoint.copy(target.point);
      pendingContact={target,local:target.mesh.worldToLocal(target.point.clone())};
    }
  }
  function fire(actor,car,interior){
    if(wheel.melee){if(!car)strike(actor);return}
    if(!wheel.armed||wheel.active||cooldown>0)return;
    loadout(car);place(actor,car,interior);
    const explosive=weaponName===crocName;
    cast.setFromCamera(pointer,camera);
    const aimed=surfaces.cast(cast.ray,100,car);
    const dest=aimed?.point||cast.ray.at(100,new T.Vector3());
    const origin=model.localToWorld(mouth.clone());
    // Start at the hand/roof if the projecting toy would extend beyond a wall.
    delta.subVectors(origin,pos);const reach=delta.length();aimRay.set(pos,delta.normalize());
    if(surfaces.cast(aimRay,reach,car))origin.copy(pos);
    const distance=origin.distanceTo(dest),duration=Math.max(.07,distance/(explosive?46:60));
    const m=(variants.get(weaponName).ammo||snack).clone(true);m.scale.setScalar(1.32);m.position.copy(origin);
    const tracked=explosive?null:aimed?.civilian?aimed.mesh:aimed?.vehicle?.police?aimed.vehicle.g:null;
    const localHit=tracked?tracked.worldToLocal(dest.clone()):null;
    m.quaternion.setFromUnitVectors(forward,delta.subVectors(dest,origin).normalize());
    scene.add(m);shots.push({m,explosive,origin,end:dest,age:0,duration,arc:explosive?0:Math.min(1.6,distance*.047),skip:car,tracked,localHit});
    shotsFired++;cooldown=explosive?1.15:.33;kick=1;onLaunch(explosive);
  }
  function stepMelee(dt,actor,canSwing){
    if(!canSwing || (swingKind==='hammer')!==wheel.hammer){swingAge=-1;pendingContact=null;return;}
    if(swingAge<0)return;
    const heavy=swingKind==='hammer', timing=heavy?hammerSwing:punchSwing;
    swingAge+=dt;
    if(swingAge>=timing.contact && pendingContact){
      const {target,local}=pendingContact;pendingContact=null;
      const victim=target.civilian||target.vehicle;
      const root=victim.root||victim.g;
      if(root.visible&&victim.behavior!=='defeated'&&victim.behavior!=='exiting'){
        pos.set(actor.x,getGroundHeight(actor.x,actor.z)+1.18,actor.z);
        target.mesh.localToWorld(point.copy(local));delta.subVectors(point,pos);
        const reach=delta.length(),contact=reach<=timing.reach+.07 &&
          surfaces.cast(aimRay.set(pos,delta.normalize()),reach+.12);
        if(contact&&(contact.civilian===victim||contact.vehicle===victim)){
          if(target.civilian)onAssault(victim,swingKind);
          else {
            tag(victim,swingKind);
            beginBodyReaction(victim,victim.x-actor.x,victim.z-actor.z,heavy?5:2.7,heavy?2.4:0,blastOptions.blocked,heavy?.65:.12,"punch");
            if(heavy)victim.snackTime=Math.max(victim.snackTime,12);
          }
          if(heavy)hammerHits++;else punchHits++;
        }
      }
    }
    if(swingAge>=timing.duration)swingAge=-1;
  }
  function update(dt,actor,car,interior,live,handsBusy=false){
    framingTime=car||!wheel.melee ? 0 : Math.max(0,framingTime-dt);
    stepMelee(dt,actor,wheel.melee&&live&&!car&&!handsBusy);
    loadout(car);propTime+=dt;if(wheel.equipped===2)spinProps(model,propTime);cooldown=Math.max(0,cooldown-dt);kick=Math.max(0,kick-dt*6);
    if(live&&!handsBusy)place(actor,car,interior);else hammer.visible=model.visible=mount.visible=false;
    if(swingAge>=0 && !wheel.armed){
      const person=world.person, side=punches%2?1:-1;
      const wind=T.MathUtils.smoothstep(swingAge,0,.055);
      const extend=T.MathUtils.smoothstep(swingAge,.055,punchSwing.contact);
      const recover=T.MathUtils.smoothstep(swingAge,punchSwing.contact+.028,punchSwing.duration);
      const jab=extend*(1-recover), pull=wind*(1-extend);
      person.rotateY(side*(pull*.15-jab*.29));
      person.rotateX(jab*.105-pull*.06);
      person.translateZ(-.22*jab);
      const hand=person.localToWorld(handOffset.set(side*.21,1.42,-.24+pull*.09));
      hand.lerp(strikePoint,jab);
      const guard=person.localToWorld(leftGrip.set(-side*.21,1.47,-.26));
      world.characters.holdLauncher(side>0?hand:guard,side>0?guard:hand);
    }
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i];s.age+=dt;const t=Math.min(1,s.age/s.duration);
      if(s.tracked?.visible)s.end.copy(s.tracked.localToWorld(point.copy(s.localHit)));
      const next=impact.lerpVectors(s.origin,s.end,t);next.y+=4*s.arc*t*(1-t);
      delta.subVectors(next,s.m.position);const length=delta.length();if(length<.00001&&t<1)continue;
      aimRay.set(s.m.position,delta.normalize());
      const hit=surfaces.cast(aimRay,length+.012,s.skip);
      if(hit||t===1){
        if(hit&&s.explosive){if(live)blasts.detonate(hit,s.skip,delta)}
        else if(hit){sauce.deposit(hit);if(hit.vehicle?.police)tag(hit.vehicle);else if(hit.civilian&&live)onAssault(hit.civilian,"rocket")}
        scene.remove(s.m);shots.splice(i,1);
      }else{s.m.position.copy(next);s.m.quaternion.setFromUnitVectors(forward,delta);if(s.explosive)spinProps(s.m,s.age);else s.m.rotateZ(s.age*5)}
    }
    blasts.update(dt);sauce.update(dt);
    for(const c of [...cops,...world.footOfficers])c.snackTime=Math.max(0,(c.snackTime||0)-dt);
    for(let i=tags.length-1;i>=0;i--){
      const t=tags[i];
      if(t.c.snackTime<=0||!t.c.g.visible){t.flag.remove();tags.splice(i,1);continue}
      pos.set(t.c.x,(t.c.y??getGroundHeight(t.c.x,t.c.z))+2.9,t.c.z).project(camera);
      t.flag.hidden=pos.z>1||pos.z< -1;
      t.flag.style.left=(50+pos.x*50)+'%';t.flag.style.top=(50-pos.y*50)+'%';t.flag.textContent=(t.c.wrecked?'WRECKED · ':'STALLED · ')+Math.ceil(t.c.snackTime)+'s';
    }
  }
  function reset(){
    for(const s of shots)scene.remove(s.m);
    swingAge=-1;pendingContact=null;swings=hammerHits=punches=punchHits=0;hammer.visible=false;
    framingTime=0;
    blasts.reset();sauce.reset();policeRockets.reset();
    for(const t of tags)t.flag.remove();
    shots.length=tags.length=shotsFired=hits=0;cooldown=kick=0;wheel.reset();
    for(const c of cops)c.snackTime=0;
  }
  return {policeRockets,wheel,get framingMelee(){return framingTime>0},setPointer,fire,punch:actor=>strike(actor,true),update,reset,state:()=>({name:wheel.hammer?hammerName:wheel.armed?weaponName:null,punch:{swings:punches,hits:punchHits},hammer:{visible:hammer.visible,swings,hits:hammerHits,swinging:swingAge>=0&&wheel.hammer},equipped:wheel.hammer?'bananini':wheel.armed?(weaponName==='The Meat Rocket'?'sahur':weaponName):'unarmed',wheelOpen:wheel.active,shotsFired,hits,inFlight:shots.length,explosions:blasts.state(),sauce:sauce.state()})};
}

import {moveVehicle,impactDamage} from './crash.js';
import {responseFor} from './pursuit.js';
import * as T from 'three';
import {landHeight,route} from './terrain.js';
import {craftSpecs,makeCraft} from './craft-models.js';

const clamp=T.MathUtils.clamp, damp=T.MathUtils.damp;
const flight=c=>c?.spec?.kind==='plane'||c?.spec?.kind==='heli';
export const atPier=(x,z,r=0)=>x>=171&&x<=247-r&&Math.abs(z)<2.4-r;
export const atTerminal=(x,z,r=0)=>x>=170&&x<=213-r&&Math.abs(z)<19-r;
export function coastWater(x,z){
  if(x>530||x< -315||z< -700||z>235)return false;
  if(z>=-180&&z<=180)return x>214.2;
  if(z< -180&&z>=-662&&x>=-318&&x<=290)return landHeight(x,z)<-.98;
  return true;
}
function makeWake(scene){
  const geometry=new T.BufferGeometry(),points=[],colors=[],index=[];
  for(const side of [-1,1]){
    const start=points.length/3;
    for(let i=0;i<=15;i++){
      const t=i/15,edge=.76+t*2.2,width=.12+.35*Math.sin(Math.PI*t),alpha=(1-t)*.48;
      for(const offset of [0,width,width*2]){
        points.push(side*(edge+offset),.02,2+10*t);
        colors.push(.86,.96,1,offset===width?alpha:0);
      }
      if(i)for(let j=0;j<2;j++){
        const a=start+3*(i-1)+j;index.push(a,a+1,a+3,a+1,a+4,a+3);
      }
    }
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));geometry.setIndex(index);
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide}));
  mesh.visible=false;scene.add(mesh);return mesh;
}
function canFloat(x,z){
  return coastWater(x,z)&&!atPier(x,z,-1)&&coastWater(x-1,z)&&coastWater(x+1,z)&&coastWater(x,z+1)&&coastWater(x,z-1);
}
export const pierHeight=(x,z)=>atPier(x,z)?.36:atTerminal(x,z)?-.10:null;
export function buildLanding(scene){
  const wood=new T.MeshStandardMaterial({color:'#997553',roughness:.9}),concrete=new T.MeshStandardMaterial({color:'#555e60'}),mark=new T.MeshStandardMaterial({color:'#e6ce93'});
  function block(w,h,d,x,y,z,mat){
    const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.receiveShadow=m.castShadow=true;scene.add(m);return m;
  }
  block(42,.25,36,193,-.22,0,concrete);
  for(let x=210;x<247;x+=.64)block(.626,.20,4.8,x,.26,0,wood);
  for(let x=213;x<247;x+=5)for(const z of [-2.12,2.12])block(.19,2.0,.19,x,-.44,z,wood);
  const circle=new T.Mesh(new T.RingGeometry(5.25,5.48,64),mark);circle.rotation.x=-Math.PI/2;circle.position.set(199,-.079,9);scene.add(circle);
  for(const x of [198,200])block(.33,.025,3.6,x,-.065,9,mark);block(2,.025,.34,199,-.062,9,mark);
  for(let i=0;i<7;i++){const a=i*.898;const m=block(.18,.13,.18,199+5.75*Math.cos(a),.01,9+5.75*Math.sin(a),mark);m.material=new T.MeshBasicMaterial({color:'#ffdba0'})}
  // Channel markers give the coastal water route a visible heading and scale.
  for(const [x,z] of [[234,-40],[253,-110],[246,-189],[266,-268],[260,-355],[255,-445],[231,-539],[201,-630]]){
    for(const side of [-1,1]){
      const m=new T.Mesh(new T.ConeGeometry(.58,1.55,12),new T.MeshStandardMaterial({color:side<0?'#ab442d':'#357760'}));
      m.position.set(x+side*10,-.37,z);scene.add(m);
      block(.15,.28,.15,m.position.x,.53,z,mark);
    }
  }
}
export function installTransport(world){
  const {scene,cars,cops,getGroundHeight,buildings,cameraObstacles}=world;
  const obstacles=[...buildings,...cameraObstacles];
  const vehicles=craftSpecs.map(s=>makeCraft(scene,s));
  const marine=makeCraft(scene,craftSpecs[0],true),air=makeCraft(scene,craftSpecs[2],true);
  marine.model='Marine Patrol';air.model='Air Support';
  for(const v of [...vehicles,marine])if(v.spec.kind==='boat'||v.spec.kind==='plane')v.wake=makeWake(scene);
  const units=[marine,air];units.forEach(c=>{c.active=false;c.g.visible=false;c.snackTime=0});
  cars.push(...vehicles);cops.push(...units);
  const floor=(x,z)=>pierHeight(x,z)??(coastWater(x,z)?-.90:getGroundHeight(x,z));
  function reset(c){const [x,z,a]=c.spec.home;Object.assign(c,{x,z,a,y:floor(x,z),speed:0,slip:0,crashPitch:0,crashRoll:0,pitch:0,bank:0,health:100,snackTime:0});sync(c,0,0,false)}
  vehicles.forEach(reset);
  function roof(x,z,r){
    let h=floor(x,z);
    for(const o of obstacles)if(Math.abs(o.x-x)<o.w/2+r&&Math.abs(o.z-z)<o.d/2+r)h=Math.max(h,o.h+.3);
    return h;
  }
  function update(c,dt,keys,elapsed,move){
    const oldHeading=c.a,kind=c.spec.kind,throttle=Number(!!(keys.KeyW||keys.ArrowUp))-Number(!!(keys.KeyS||keys.ArrowDown));
    const steer=Number(!!(keys.KeyA||keys.ArrowLeft))-Number(!!(keys.KeyD||keys.ArrowRight));
    const lift=Number(!!keys.KeyQ)-Number(!!keys.KeyZ),flying=flight(c);
    const base=floor(c.x,c.z),agl=Math.max(0,c.y-base),heli=kind==='heli',plane=kind==='plane';
    const flyingNow=flying&&agl>.6;
    const drag=keys.Space?3.1:throttle?.10:plane&&flyingNow?.045:kind==='boat'?.34:.66;
    c.speed=clamp((c.speed+throttle*(throttle*c.speed<0?23:c.spec.power)*dt)*Math.exp(-drag*dt),plane?0:-5,c.spec.limit);
    if(plane&&!flyingNow&&!coastWater(c.x,c.z))c.speed=Math.min(c.speed,26);
    c.a+=steer*dt*(heli?1.45:plane?.98:kind==='boat'?1.1:2.05)*(heli?1:Math.min(Math.abs(c.speed)/5,1)*Math.sign(c.speed));
    if(flying){
      const climb=heli?lift*13:(c.speed<11?-5:lift?lift*14:c.speed>17&&agl<7?5:0);
      const support=roof(c.x,c.z,plane?2.2:1);
      c.y=clamp(c.y+climb*dt,c.y>=support-.01?support:base,140);
      if(heli&&c.y-base<.45)c.speed=0;
    }
    let impact;
    if(kind==='boat'||(plane&&c.y-base<.65&&coastWater(c.x,c.z))){
      impact=moveVehicle(c,dt,(x,z)=>!canFloat(x,z));
    }else if(flying){
      impact=moveVehicle(c,dt,(x,z)=>x< -310||x>525||z< -690||z>230||
        roof(x,z,plane?2.2:1)>c.y+.6||atPier(x,z)&&c.y<.6);
      c.y=Math.max(c.y,floor(c.x,c.z));
    }else{
      impact=move(c,dt,kind==='quad'?.82:.48,oldHeading);
      if(kind==='scooter'&&c.z<-176)c.speed*=Math.exp(-.14*dt);
    }
    if(impact>4.5)c.health=Math.max(0,c.health-impactDamage(impact)*.8);
    if(!flying)c.y=floor(c.x,c.z);
    c.bank=damp(c.bank,steer*(heli?.18:plane?.47:kind==='scooter'?.28:kind==='boat'?-.12:.07)*Math.min(1,Math.abs(c.speed)/6),5,dt);
    const pitch=flying?(heli?-c.speed*.006:lift*.17*Math.min(1,c.speed/10)):kind==='boat'?Math.min(.095,Math.abs(c.speed)*.005):Math.atan2(floor(c.x-Math.sin(c.a),c.z-Math.cos(c.a))-floor(c.x+Math.sin(c.a),c.z+Math.cos(c.a)),2);
    c.pitch=damp(c.pitch,pitch,4,dt);
  }
  function sync(c,dt,time,occupied){
    const bob=c.spec.kind==='boat'||(c.spec.kind==='plane'&&coastWater(c.x,c.z)&&c.y<0);
    c.g.position.set(c.x,c.y+(bob?.065*Math.sin(time*2+c.x):0),c.z);c.g.rotation.set(c.pitch+(c.crashPitch||0),c.a,c.bank+(c.crashRoll||0)+(bob?.025*Math.sin(time*1.6):0),'YXZ');
    if(c.wake){
      c.wake.visible=bob&&c.g.visible&&c.speed>1;
      if(c.wake.visible){c.wake.position.set(c.x,-.82,c.z);c.wake.rotation.y=c.a;c.wake.scale.z=.35+Math.min(1,c.speed/22);c.wake.material.opacity=Math.min(1,c.speed/10)}
    }
    for(const [rotor,axis] of c.rotors)rotor.rotation[axis]+=dt*(occupied||c.active?32:0);
    for(const w of c.wheels)w.rotation.x-=c.speed*dt/.30;
  }
  function waterLane(x,z,tx,tz){
    const n=Math.max(1,Math.ceil(Math.hypot(tx-x,tz-z)/2));
    for(let i=1;i<=n;i++)if(!canFloat(x+(tx-x)*i/n,z+(tz-z)*i/n))return false;
    return true;
  }
  let domain=null;
  function dispatch(target,type){
    const previous=domain;domain=type;
    for(const unit of units){unit.active=false;unit.g.visible=false}
    if(type==='water'||type==='air'){
      const c=type==='water'?marine:air;
      if(c.snackTime>0){c.active=true;c.g.visible=true;return}
      let x=target.x+Math.sin(target.a)*28+6,z=target.z+Math.cos(target.a)*28;
      if(type==='water'){
        // Dispatch on the same navigable side of the wharf as the occupied craft.
        for(const angle of [0,.6,-.6,1.2,-1.2,1.6,-1.6,Math.PI]){
          const a=target.a+angle;x=target.x+Math.sin(a)*28;z=target.z+Math.cos(a)*28;
          if(canFloat(x,z)&&waterLane(x,z,target.x,target.z))break;
        }
      }
      Object.assign(c,{x,z,a:target.a,y:type==='water'?-.9:Math.max(target.y+5,roof(x,z,2)+5),speed:0,active:true});c.g.visible=true;
    }else if(type==='street'&&!(cops[0].snackTime>0)&&(previous==='air'||previous==='water')){
      const lane=world.roads.reduce((a,b)=>Math.abs(b-target.z)<Math.abs(a-target.z)?b:a);
      Object.assign(cops[0],{x:clamp(target.x-22,-166,166),z:lane,a:-Math.PI/2,speed:0,way:null});
    }else if(type==='rural'&&!(cops[0].snackTime>0)){
      let best=0;for(let i=1;i<route.length;i++)if(Math.hypot(route[i].x-target.x,route[i].z-target.z)<Math.hypot(route[best].x-target.x,route[best].z-target.z))best=i;
      const q=route[clamp(best+(best>18?-16:16),0,route.length-1)];Object.assign(cops[0],{x:q.x,z:q.z,speed:0,way:null});
    }
  }
  function pursue(target,wanted,dt){
    if(!wanted){if(domain!==null)dispatch(target,null);return Infinity}
    const type=flight(target)?(target.spec.kind==='plane'&&coastWater(target.x,target.z)&&target.y<2?'water':'air'):target.spec?.kind==='boat'?'water':target.z< -176?'rural':'street';
    if(type!==domain){
      const ground=d=>d==='street'||d==='rural';
      if(ground(type)&&ground(domain))domain=type;
      else dispatch(target,type);
    }
    const c=type==='air'?air:type==='water'?marine:null;if(!c || c.snackTime>0)return Infinity;
    const ownAir=c===air,dx=target.x-c.x,dz=target.z-c.z,dist=Math.hypot(dx,dz),ty=target.y??floor(target.x,target.z);
    if(c.snackTime<=0){
      let wx=target.x,wz=target.z;
      if(!ownAir&&c.z*target.z<0&&Math.min(c.x,target.x)<249&&!waterLane(c.x,c.z,target.x,target.z)){
        wx=251;wz=c.x<249?Math.sign(c.z)*6:Math.sign(target.z)*6;
      }
      const angle=Math.atan2(c.x-wx,c.z-wz),diff=Math.atan2(Math.sin(angle-c.a),Math.cos(angle-c.a));c.a+=clamp(diff,-1.85*dt,1.85*dt);
      const speed=Math.min(ownAir?responseFor(wanted).airSpeed:responseFor(wanted).marineSpeed,Math.max(0,(dist-(ownAir?6:3))*.95+Math.max(0,target.speed||0)*.5));
      c.speed=damp(c.speed,speed,2.5,dt);
      const step=Math.min(c.speed*dt,Math.max(0,dist-3));let nx=c.x-Math.sin(c.a)*step,nz=c.z-Math.cos(c.a)*step;
      if(ownAir){
        const top=roof(nx,nz,1.6),goal=Math.max(ty+3.4,top+2.8);
        c.y+=clamp(goal-c.y,-14*dt,19*dt);
        if(c.y<top+1){nx=c.x;nz=c.z}
      }else if(!canFloat(nx,nz)){
        // Skirt piers and shallow shorelines while closing the distance to the player.
        let best=Infinity;
        for(const offset of [.5,-.5,1,-1,1.55,-1.55,2.2,-2.2,Math.PI]){
          const a=angle+offset,x=c.x-Math.sin(a)*step,z=c.z-Math.cos(a)*step;
          if(canFloat(x,z)&&canFloat(x-Math.sin(a)*3,z-Math.cos(a)*3)){
            const score=Math.hypot(target.x-x,target.z-z);if(score<best){best=score;nx=x;nz=z;c.a=a}
          }
        }
        if(best===Infinity){nx=c.x;nz=c.z}
      }
      c.x=nx;c.z=nz;c.bank=damp(c.bank,clamp(diff,-.4,.4)*(ownAir?.45:-.23),3,dt);
    }
    return Math.hypot(target.x-c.x,target.z-c.z,ty-c.y);
  }
  return {vehicles,units,flight,reset,update,sync,pursue,floor,roof,get domain(){return domain}};
}

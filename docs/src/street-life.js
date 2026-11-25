import * as T from 'three';
import {makeCart,makeCrosswalk,dressVendor,servingTray,corner,crossing} from './street-cart.js';
import {streetAudio} from './street-audio.js';
import {roadPosition} from './traffic-contact.js';

const nearCurb=-85.7, farCurb=-106.35;
const linePoint=i=>({x:10.15,z:-84.35+i*1.05});
const enabled=n=>!n.behavior && !n.impact;

export function createStreetLife(world,ctx,addScenery) {
  const {scene,cars,cops,getGroundHeight:ground}=world;
  const locals=world.pedestrians.filter(n=>!n.driver);
  const [vendor,...customers]=[0,4,7,10,13].map(i=>locals[i]);
  const walkers=[locals[2],locals[15]], ballPlayer=locals[8];
  const cast=[vendor,...customers,...walkers,ballPlayer];
  const homes=cast.map(n=>({x:n.homeX,z:n.homeZ}));
  const cart=makeCart(scene,ground(corner.x,corner.z)), stripes=makeCrosswalk(scene);
  cart.updateMatrixWorld(true);
  cart.traverse(part=>{if(part.isMesh)addScenery(part)});
  dressVendor(vendor);
  const trays=new Map(customers.map(n=>[n,servingTray(n)]));
  const ball=new T.Mesh(new T.SphereGeometry(.125,12,8),new T.MeshStandardMaterial({color:'#cf6227',roughness:1}));
  scene.add(ball);
  const ambience=streetAudio(ctx);
  let line=[],trip=new Map(),clock=0,service=0,served=0;
  let phase='waiting',direction=-1,wait=0,yields=0,honks=0,retreats=0,heardSiren=false;
  let approach=[],follower=null,hornAt=0,braking=new Set(),open=false;
  let listener={x:0,z:0},rx=1,rz=0;
  function place(n,x,z,yaw) {
    n.x=x;n.z=z;n.homeX=x;n.homeZ=z;n.root.position.set(x,ground(x,z),z);n.root.rotation.set(0,yaw,0);
  }
  function animate(n,dt,x,z,speed=1.5) {
    if(!enabled(n))return false;
    const pos=n.root.position,dx=x-pos.x,dz=z-pos.z,d=Math.hypot(dx,dz);
    const step=Math.min(d,speed*dt);
    if(d>.06){
      pos.x+=dx*step/d;pos.z+=dz*step/d;
      n.root.rotation.y=Math.atan2(-dx,-dz);
    }
    pos.y=ground(pos.x,pos.z);n.x=pos.x;n.z=pos.z;
    const stride=d>.08?.40:0;
    n.legs.forEach((limb,i)=>{limb.rotation.x=stride*Math.sin(clock*6+n.phase+i*Math.PI)});
    n.arms.forEach((limb,i)=>{limb.rotation.x=-n.legs[i].rotation.x*.72;limb.rotation.z=0});
    return d<.13;
  }
  function start(occupied) {
    open=true;clock=0;service=0;served=0;line=[...customers];trip.clear();
    phase='waiting';wait=.55;direction=-1;retreats=yields=honks=0;heardSiren=false;hornAt=0;braking.clear();
    cart.visible=stripes.visible=ball.visible=true;
    for(const n of cast)n.streetRole=true;
    for(const tray of trays.values())tray.visible=false;
    place(vendor,12.4,-86.35,Math.PI);
    customers.forEach((n,i)=>{const pos=linePoint(i);place(n,pos.x,pos.z,0)});
    walkers.forEach((n,i)=>place(n,crossing.x+i*.85,nearCurb,0));
    place(ballPlayer,24,24,Math.PI*.18);
    approach=cars.filter(c=>c!==occupied && c.traffic && c.driver && !c.wrecked).slice(-2);
    approach.forEach((c,i)=>Object.assign(c,{x:32+i*11,z:-92.3,a:Math.PI/2,speed:6.2+i*.7}));
    follower=approach[1];
  }
  function stop() {
    open=false;cart.visible=stripes.visible=ball.visible=false;
    ambience.update(false,listener,rx,rz,clock);
    cast.forEach((n,i)=>{n.streetRole=false;n.homeX=homes[i].x;n.homeZ=homes[i].z;n.rig.neck.rotation.y=0});
    for(const tray of trays.values())tray.visible=false;
    braking.clear();
  }
  function queue(dt) {
    // Round the stand and rejoin at the back without moving anyone instantly.
    line=line.filter(n=>enabled(n));
    for(const n of customers){
      if(!enabled(n)){trip.delete(n);trays.get(n).visible=false;continue}
      if(!line.includes(n)&&!trip.has(n))trip.set(n,0);
    }
    for(const [n,i] of trip){
      const route=[[10.4,-85.9],[9.45,-85.9],[9.45,-78.7],[10.15,-78.7]];
      if(animate(n,dt,...route[i])){
        if(i===route.length-1){trip.delete(n);line.push(n);trays.get(n).visible=false}else trip.set(n,i+1);
      }
      if(trays.get(n).visible)n.arms[1].rotation.x=.86;
    }
    let atCounter=false;
    line.forEach((n,i)=>{
      const pos=linePoint(i);
      if(animate(n,dt,pos.x,pos.z)){
        n.root.rotation.y=i===0?-Math.PI*.32:0;
        if(i===0){atCounter=true;n.arms[1].rotation.x=.23+.18*Math.sin(clock*3)}
      }
    });
    if(enabled(vendor)){
      animate(vendor,dt,12.4,-86.35);
      vendor.root.rotation.y=2.3;
      vendor.arms[0].rotation.x=.55+.32*Math.sin(clock*4);
      vendor.arms[1].rotation.x=service>2.6?1.05:.32;
    }
    if(!enabled(vendor)||!atCounter){service=0;return}
    service+=dt;
    if(service>=4){const customer=line.shift();trip.set(customer,0);trays.get(customer).visible=true;served++;service=0}
  }
  const inCrossStreet=c=>c.active!==false && !c.wrecked && Math.abs(c.z-crossing.z)<8.2 && Math.abs(Math.sin(c.a))>.68;
  function unsafe(c) {
    if(!inCrossStreet(c))return false;
    const bumper=roadPosition(c,crossing.x,c.z).front-(c.spec?.length||4.5)/2;
    return bumper>-4 && bumper<Math.max(18,Math.abs(c.speed)*2.4) && (Math.abs(c.speed)>1.2||Math.abs(bumper)<1.7);
  }
  function cross(dt,ride,siren) {
    const origin=direction<0?nearCurb:farCurb, dest=direction<0?farCurb:nearCurb;
    const nearPolice=siren && cops.some(c=>c.active!==false && Math.abs(c.speed)>2 && Math.hypot(c.x-crossing.x,c.z-crossing.z)<32);
    if(nearPolice && !heardSiren && phase!=='clearing'){
      retreats++;
      if(phase==='crossing' && walkers.some(n=>enabled(n)&&Math.abs(n.z-origin)>3))phase='clearing';
      else {phase='step back';wait=1.4}
    }
    heardSiren=nearPolice;
    wait=Math.max(0,wait-dt);
    const active=walkers.filter(enabled);
    if(!active.length)return;
    if(phase==='waiting' && !wait && !cars.some(unsafe) && !(ride&&unsafe(ride)) && !cops.some(unsafe))phase='crossing';
    const crossingNow=phase==='crossing'||phase==='clearing';
    const goal=crossingNow?dest:origin+(phase==='step back'?-direction*.95:0);
    let arrived=true;
    walkers.forEach((n,i)=>{
      if(!enabled(n))return;
      if(!animate(n,dt,crossing.x+i*.85,goal,phase==='clearing'?3.9:1.65+i*.15))arrived=false;
      else n.root.rotation.y=direction<0?0:Math.PI;
      if(!crossingNow && n.rig)n.rig.neck.rotation.y=.35*Math.sin(clock*2+n.phase);
    });
    if(phase==='step back' && !wait){phase='waiting';wait=.4}
    if(crossingNow && arrived){direction=-direction;phase='waiting';wait=4.5}
  }
  function trafficLimit(c) {
    if(!open||!cart.visible||!inCrossStreet(c)||Math.abs(c.x-crossing.x)>41)return Infinity;
    let limit=Infinity;
    const bumper=roadPosition(c,crossing.x,c.z).front-(c.spec?.length||4.5)/2;
    const giveWay=heardSiren || (walkers.some(enabled) && (phase==='crossing'||phase==='clearing'||(phase==='waiting'&&wait<=.6)));
    if(bumper>0 && giveWay){
      limit=Math.sqrt(14*Math.max(0,bumper-2.3));
    }
    // Drivers behind the yielding car leave a bumper gap even once walkers clear.
    for(const other of cars){
      if(c===other||!inCrossStreet(other)||Math.abs(c.x-other.x)>16)continue;
      const q=roadPosition(c,other.x,other.z);
      if(Math.abs(q.side)>1.8||q.front<=0)continue;
      const gap=q.front-((c.spec?.length||4.5)+(other.spec?.length||4.5))/2-1.25;
      limit=Math.min(limit,Math.sqrt(Math.max(0,other.speed**2+12*gap)));
    }
    if(limit<c.driver.cruise-.25){
      if(!braking.has(c)){yields++;braking.add(c)}
      if(c===follower && limit<2 && clock>hornAt){ambience.horn(c,listener,rx,rz);honks++;hornAt=clock+8}
    } else braking.delete(c);
    return limit;
  }
  function update(dt,target,ride,wanted,camera) {
    if(!open)return;
    listener=target;rx=camera.matrixWorld.elements[0];rz=camera.matrixWorld.elements[2];
    ambience.update(dt>0,target,rx,rz,clock);
    if(!dt)return;
    clock+=dt;
    const nearby=Math.hypot(target.x-corner.x,target.z-corner.z)<85;
    cart.visible=stripes.visible=nearby;
    const atCourt=Math.hypot(target.x-24,target.z-24)<65;
    ball.visible=atCourt&&enabled(ballPlayer);
    for(const n of cast)if(enabled(n))n.root.visible=n===ballPlayer?atCourt:nearby;
    if(nearby){queue(dt);cross(dt,ride,wanted>0)}
    if(ball.visible){
      animate(ballPlayer,dt,24,24);
      const bounce=Math.abs(Math.sin(Math.PI*clock/.6));
      ball.position.set(23.7,.58+bounce*.91,23.73);
      ballPlayer.arms[0].rotation.x=.38+bounce*.52;
    }
  }
  return {start,stop,update,trafficLimit,state:()=>({active:open,cart:corner,served,queue:line.length,phase,yields,honks,retreats,
    walkers:walkers.map(n=>({x:n.x,z:n.z})),approach:approach.map(c=>({x:c.x,z:c.z,speed:c.speed})),audio:ambience.state()})};
}

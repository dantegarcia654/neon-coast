import * as T from "three";
import {slide} from "./impact-motion.js";

const clamp=T.MathUtils.clamp;
const ramp=(x,a,b)=>T.MathUtils.smoothstep(x,a,b);
const axis=new T.Vector3(), support=new T.Vector3(), hip=new T.Vector3();
const tilt=new T.Quaternion(), up=new T.Vector3(0,1,0);

export function beginPedestrianImpact(npc,vx,vz,blocked) {
  const speed=Math.hypot(vx,vz);
  if(speed<.01)return;
  const hard=speed>=9, strength=clamp((speed-4)/27,0,1);
  beginBodyReaction(npc,vx,vz,hard ? 6+8.5*strength : 1.8+strength,
    hard ? 1.65+2.3*strength : 0,blocked,hard ? .95+.6*strength : .12,"vehicle");
}

export function beginBodyReaction(npc,dx,dz,shove,lift,blocked,hold=0,kind="blast") {
  const old=npc.impact;
  npc.root.rotation.reorder("YXZ");
  const yaw=old?.yaw ?? npc.root.rotation.y;
  const p=npc.root.position, length=Math.hypot(dx,dz);
  if(length>.0001){dx/=length;dz/=length}
  else {dx=-Math.sin(yaw);dz=-Math.cos(yaw)}
  const across=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  const side=Math.abs(across)>.16 ? Math.sign(across) : Math.cos((npc.phase||0)+yaw)>=0 ? 1 : -1;
  const hard=lift>0 || Boolean(old?.hard);
  // A second contact adds momentum without standing the victim up first.
  const carry=old?.hard ? .48 : .16;
  const onGround=old?.hard && old.groundedTime>.22 && old.rise<.55;
  const upward=kind==="punch" ? 0 : kind==="vehicle" && onGround ? lift*.20 : lift;
  const channels=old?.channels || new Map();
  npc.impact={kind,dynamic:true,hard,dx,dz,yaw,side,shove,hold,blocked,channels,
    x:old?.x??p.x,z:old?.z??p.z,y:old?.y??p.y,
    vx:dx*shove+(old?.vx||0)*carry,vz:dz*shove+(old?.vz||0)*carry,
    vy:upward+Math.max(0,old?.vy||0)*carry,
    pitch:old?.pitch||0,entryPitch:old?.pitch||0,turn:old?.turn||0,age:0,groundedTime:0,
    landingAge:-1, rise:0,
    initialRotation:npc.root.quaternion.clone(),recontact:Boolean(old)
  };
}

function bend(s,node,component,target,frequency,dt) {
  const key=node.uuid+component;
  let speed=s.channels.get(key)||0;
  // Exact critically damped spring with an independent response time per joint.
  const offset=node.rotation[component]-target, coefficient=speed+frequency*offset;
  const decay=Math.exp(-frequency*dt);
  node.rotation[component]=target+(offset+coefficient*dt)*decay;
  s.channels.set(key,(speed-frequency*coefficient*dt)*decay);
}

function poseBody(npc,s,dt) {
  const {rig}=npc, car=s.kind==="vehicle", punch=s.kind==="punch";
  const fall=ramp(s.age,0,punch?.43:car?.33:.26);
  const rise=s.rise, prone=fall*(1-rise);
  const kick=Math.sin(Math.PI*ramp(s.age,0,car?.46:.32))*(1-rise);
  const landed=s.landingAge<0 ? 0 : Math.exp(-s.landingAge*7)*Math.sin(s.landingAge*17);
  const brace=Math.sin(Math.PI*rise);
  const tuck=brace*(1.4-.6*rise);
  const bendKnees=punch ? .95 : car ? .65 : .34;
  const hard=s.hard?1:.27;
  const bank=s.side*hard;
  const extent=hard*prone;
  const target=s.hard ? 1.49 : .16+Math.min(.25,s.shove*.04);
  const fold=car ? -.38*kick : punch ? -.12*kick : .31*kick;
  // Legs are collected by a bumper before the upper body follows. Blast rotation
  // starts in the air. During get-up the torso stays low while a knee plants.
  s.pitch=target*prone + s.entryPitch*(1-fall) + fold*hard + landed*.15*hard + .27*brace;
  s.turn=bank*((car?.92:punch?.26:.66)*prone + .19*landed);
  const root=npc.root;
  axis.set(s.dz,0,-s.dx);
  tilt.setFromAxisAngle(axis,s.pitch);
  root.quaternion.setFromAxisAngle(up,s.yaw+s.turn).premultiply(tilt);
  if(s.recontact)root.quaternion.slerp(s.initialRotation,1-ramp(s.age,0,.16));
  if(rig) {
    bend(s,rig.torso,"x",.22*prone+(punch?.46:-.21)*kick+.54*tuck,18,dt);
    bend(s,rig.torso,"z",bank*(.22*prone+.22*kick-.18*brace),14,dt);
    bend(s,rig.torso,"y",bank*.46*brace,13,dt);
    bend(s,rig.neck,"x",.18*prone+(punch?-.48:.22)*kick+.3*tuck,13,dt);
    bend(s,rig.neck,"y",-bank*.35*prone,10,dt);
  }
  for(let i=0;i<npc.arms.length;i++) {
    const sign=i?1:-1, leading=sign===s.side;
    const arm=npc.arms[i],leg=npc.legs[i];
    const spread=punch ? .29 : car ? .52 : 1.02;
    const trail=leading ? .94 : .44;
    bend(s,arm,"x",extent*(leading?.33:-.27) + kick*(punch?.94:-.62)*trail + tuck*(leading?.95:.4),leading?19:12,dt);
    bend(s,arm,"z",sign*(extent*(.38+trail*spread)+kick*spread*trail+.33*brace),leading?16:10,dt);
    bend(s,leg,"x",hard*(prone*(leading?.24:-.09)+kick*(leading?1:-.44)*bendKnees) + tuck*(leading?1.43:.61),leading?18:11,dt);
    bend(s,leg,"z",sign*(extent*(leading?.31:.12)+.1*brace),13,dt);
    if(rig) {
      bend(s,rig.elbows[i],"x",hard*(prone*(leading?.67:.24)+kick*(punch?1.1:.55)) + tuck*(leading?.85:.45),leading?18:12,dt);
      bend(s,rig.knees[i],"x",-hard*(prone*(leading?.67:.19)+kick*(leading?.51:.92)) - tuck*(leading?1.88:1.3),leading?17:10,dt);
    }
  }
}

const start=new T.Vector3(), end=new T.Vector3(), segment=new T.Vector3(), goal=new T.Vector3();
const correction=new T.Quaternion(), parentRotation=new T.Quaternion();

function groundLimb(parent,child,radius,restHeight,settle,ground) {
  start.setFromMatrixPosition(parent.matrixWorld);end.setFromMatrixPosition(child.matrixWorld);
  const floor=ground(end.x,end.z)+radius;
  const target=Math.max(floor,T.MathUtils.lerp(end.y,floor+restHeight,settle));
  if(Math.abs(target-end.y)<.001)return;
  segment.subVectors(end,start);
  const length=segment.length();
  if(length<.001)return;
  const y=clamp(target-start.y,-length+.0001,length-.0001);
  const horizontal=Math.hypot(segment.x,segment.z);
  const scale=Math.sqrt(Math.max(0,length*length-y*y))/(horizontal||1);
  goal.set(segment.x*scale,y,segment.z*scale);
  if(horizontal<.0001)goal.z=Math.sqrt(length*length-y*y);
  correction.setFromUnitVectors(segment.normalize(),goal.normalize());
  parent.parent.getWorldQuaternion(parentRotation);
  correction.premultiply(parentRotation.invert());
  correction.multiply(parentRotation.invert());
  parent.quaternion.premultiply(correction);
  parent.updateWorldMatrix(false,true);
}

function placeBody(npc,s,ground) {
  const root=npc.root, floor=ground(s.x,s.z);
  // The pelvis carries horizontal momentum. The torso and head take weight
  // on landing; an extended wrist cannot prop the entire body above the road.
  hip.set(0,.95,0).applyQuaternion(root.quaternion);
  root.position.set(s.x-hip.x,0,s.z-hip.z);
  root.updateWorldMatrix(true,true);
  function supportY(node,radius) {
    support.setFromMatrixPosition(node.matrixWorld);
    return ground(support.x,support.z)+radius-support.y;
  }
  const air=Math.max(0,s.y-floor), r=npc.rig;
  if(!r){root.position.y=floor+air+.20*Math.sin(Math.abs(s.pitch));return}
  let core=Math.max(supportY(r.head,.16),supportY(r.neck,.14),supportY(r.torso,.19));
  let extremities=core;
  for(let i=0;i<2;i++) {
    core=Math.max(core,supportY(npc.arms[i],.12),supportY(npc.legs[i],.13));
    extremities=Math.max(extremities,supportY(r.elbows[i],.075),supportY(r.hands[i],.075),
      supportY(r.knees[i],.095),supportY(r.feet[i],.09));
  }
  const prone=ramp(Math.abs(s.pitch),.64,1.30);
  const standing=Math.max(core,extremities);
  root.position.y=T.MathUtils.lerp(standing,core,prone)+air + .04*(1-prone);
  root.updateWorldMatrix(false,true);
  if(prone>0 && air<.40){
    const settle=prone*ramp(s.groundedTime,.035,.4)*(1-ramp(air,0,.4));
    groundLimb(r.torso,r.neck,.15,.035,settle,ground);
    groundLimb(r.neck,r.head,.16,.02,settle,ground);
    const shoulderLift=Math.max(0,supportY(npc.arms[0],.11),supportY(npc.arms[1],.11),supportY(r.head,.16));
    root.position.y+=shoulderLift;
    root.updateWorldMatrix(false,true);
    for(let i=0;i<2;i++) {
      const lead=(i?1:-1)===s.side;
      groundLimb(npc.arms[i],r.elbows[i],.075,lead?.03:.09,settle,ground);
      groundLimb(r.elbows[i],r.hands[i],.075,.015,settle,ground);
      groundLimb(npc.legs[i],r.knees[i],.095,lead?.14:.035,settle,ground);
      groundLimb(r.knees[i],r.feet[i],.095,.012,settle,ground);
    }
  }
  // Keep the planted boot in place while the pelvis travels over the bent knee.
  if(s.hard && s.rise>.30 && s.rise<.91){
    support.setFromMatrixPosition(r.feet[s.side>0?1:0].matrixWorld);
    if(!s.planted)s.planted=support.clone();
    const dx=clamp(s.planted.x-support.x,-.08,.08), dz=clamp(s.planted.z-support.z,-.08,.08);
    if(!s.blocked(s.x+dx,s.z+dz,.34)){
      s.x+=dx;s.z+=dz;root.position.x+=dx;root.position.z+=dz;
    }
  }
}

export function clearBodyPose(npc) {
  npc.impact=null;
  for(const node of [...npc.legs,...npc.arms])node.rotation.set(0,0,0);
  const r=npc.rig;
  if(r)for(const node of [r.torso,r.neck,...r.knees,...r.elbows])node.rotation.set(0,0,0);
}

export function updatePedestrianImpact(npc,dt,time,ground) {
  const s=npc.impact;
  if(!s)return false;
  if(!dt)return true;
  const count=Math.ceil(dt*120), h=dt/count;
  for(let i=0;i<count;i++){
    const airborne=s.vy>0 || s.y>ground(s.x,s.z)+.012;
    slide(s,s,h,airborne?1.25:s.kind==="vehicle"?4.2:7.5,(x,z)=>s.blocked(x,z,.34));
    const floor=ground(s.x,s.z);
    s.y+=s.vy*h-9*h*h;
    s.vy-=18*h;
    if(s.y<=floor){
      if(s.landingAge<0 && (airborne || s.age>.3))s.landingAge=0;
      s.y=floor;s.vy=0;s.groundedTime+=h;
    }
    if(s.landingAge>=0)s.landingAge+=h;
    s.age+=h;
    s.rise=ramp(s.groundedTime,s.hold,s.hold+(s.hard?1.08:.29));
    poseBody(npc,s,h);
  }
  placeBody(npc,s,ground);
  if(s.rise>=1) {
    npc.root.rotation.set(0,s.yaw,0,"YXZ");
    npc.root.position.set(s.x,ground(s.x,s.z),s.z);
    if(!npc.behavior && Number.isFinite(npc.phase)) {
      npc.walkOffsetX=s.x-(npc.x+Math.sin(time*.08+npc.phase)*8);
      npc.walkOffsetZ=s.z-npc.z;
    }
    clearBodyPose(npc);
  }
  return true;
}

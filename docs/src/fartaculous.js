import * as T from 'three';
import {chaseMonster,gasExposure} from './monster-motion.js';

export function createFartaculous(world,{blocked,notify,hurt,sound}) {
  const group=new T.Group();world.scene.add(group);
  const sphere=new T.SphereGeometry(1,14,10);
  const skin=new T.MeshStandardMaterial({color:'#748c24',roughness:.85});
  const yellow=new T.MeshStandardMaterial({color:'#d4be34',roughness:.8});
  const dark=new T.MeshStandardMaterial({color:'#27381c'});
  const white=new T.MeshStandardMaterial({color:'#fff3c7'});
  const actors=[],clouds=[];let active=false,clock=0,damageCooldown=0,bursts=0;
  world.enemies=actors;
  function oval(g,mat,x,y,z,w,h,d) {
    const m=new T.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;g.add(m);return m;
  }
  function make(name,scale,health) {
    const root=new T.Group();group.add(root);root.scale.setScalar(scale);
    const body=new T.Group();root.add(body);
    oval(body,skin,0,2.3,0,1.25,1.65,.9);
    oval(body,yellow,0,2.25,-.76,.83,1.04,.22);
    oval(body,skin,0,3.8,-.12,1.04,.86,.82);
    for(const side of [-1,1]) {
      oval(body,white,side*.39,4.02,-.81,.3,.35,.15);
      oval(body,dark,side*.39,4,-.95,.13,.19,.07);
      const brow=oval(body,dark,side*.4,4.38,-.83,.38,.09,.13);brow.rotation.z=side*.25;
      oval(body,yellow,side*.8,4.59,0,.22,.35,.22);
      oval(body,skin,side*1.35,2.28,0,.4,1.06,.43);
      // Two distinct cartoon backsides, each with its own pair of cheeks.
      for(const cheek of [-1,1])oval(body,skin,side*.65+cheek*.25,1.52,.83,.35,.48,.48);
      oval(body,dark,side*.65,1.51,1.27,.035,.22,.025);
      for(let i=0;i<3;i++)oval(body,yellow,side*(.82+i*.16),2.65+i*.31,.47,.13,.17,.1);
    }
    oval(body,dark,0,3.45,-.85,.44,.14,.08);
    for(const x of [-.27,0,.27])oval(body,white,x,3.5,-.91,.09,.1,.06);
    const legs=[-1,1].map(side=>{const leg=new T.Group();leg.position.set(side*.65,.95,0);root.add(leg);oval(leg,skin,0,-.27,0,.43,.7,.48);oval(leg,yellow,0,-.7,-.3,.5,.26,.68);return leg});
    const a={name,root,body,legs,scale,x:0,z:0,hp:health,maxHealth:health,cool:4,wind:0,stun:0,behavior:'enemy',radius:1.4*scale};
    a.hit=kind=>{if(!root.visible)return;a.hp=Math.max(0,a.hp-(kind==='hammer'?3:kind==='strike'?1:2));a.stun=.65;a.wind=0;a.body.rotation.x=0;if(!a.hp){root.visible=false;notify(name.toUpperCase()+' DEFEATED')}else notify(name.toUpperCase()+' · '+a.hp+' HP')};
    actors.push(a);return a;
  }
  const boss=make('Fartaculous',1.55,12),friend=make('Diarrhea Pookie',.55,4);
  function place(a,target,distance) {
    for(const r of [distance,distance+8,distance+16])for(let i=0;i<20;i++) {
      const angle=Math.PI+i*Math.PI/10,x=target.x+Math.sin(angle)*r,z=target.z+Math.cos(angle)*r;
      if(blocked(x,z,a.radius))continue;
      a.x=x;a.z=z;a.root.position.set(x,world.getGroundHeight(x,z),z);return true;
    }
    return false;
  }
  function clearClouds(){for(const c of clouds){group.remove(c.mesh);c.mesh.material.dispose()}clouds.length=0}
  function stop(){active=false;clearClouds();for(const a of actors)a.root.visible=false}
  function start(target,enabled){
    stop();clock=bursts=damageCooldown=0;active=enabled;
    for(const a of actors){a.hp=a.maxHealth;a.wind=a.stun=0;a.cool=4;a.root.rotation.set(0,0,0);a.body.rotation.set(0,0,0)}
    if(active){boss.root.visible=place(boss,target,24);active=boss.root.visible;if(active)notify('FARTACULOUS IS COMING · RUN OR FIGHT!')}
  }
  function burst(a) {
    bursts++;sound();notify(a.name==='Fartaculous'?'DOUBLE-BUTT BLAST · GET CLEAR!':'POOKIE PUFF!');
    for(const side of [-1,1]) {
      const mat=new T.MeshStandardMaterial({color:side<0?'#9cbe38':'#d3c54a',transparent:true,opacity:.36,depthWrite:false,roughness:1});
      const mesh=new T.Mesh(sphere,mat);group.add(mesh);
      const x=a.x+Math.sin(a.root.rotation.y)*a.scale*.8+Math.cos(a.root.rotation.y)*side*a.scale*.65;
      const z=a.z+Math.cos(a.root.rotation.y)*a.scale*.8-Math.sin(a.root.rotation.y)*side*a.scale*.65;
      clouds.push({x,z,y:world.getGroundHeight(a.x,a.z)+1,age:0,radius:1,mesh});
    }
    if(a===boss&&!friend.root.visible&&friend.hp>0){friend.root.visible=place(friend,a,4);if(friend.root.visible)notify('FARTACULOUS MADE A FRIEND · DIARRHEA POOKIE!')}
  }
  function update(dt,target,inCar) {
    if(!active||dt<=0)return;
    clock+=dt;damageCooldown=Math.max(0,damageCooldown-dt);
    for(const a of actors){
      if(!a.root.visible||!a.hp)continue;
      a.stun=Math.max(0,a.stun-dt);a.cool=Math.max(0,a.cool-dt);
      const dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz);
      const facing=Math.atan2(-dx,-dz);
      if(a.wind>0){
        a.wind=Math.max(0,a.wind-dt);a.root.rotation.y=facing+Math.PI;a.body.rotation.x=.2*Math.sin(a.wind*18);
        if(!a.wind){a.body.rotation.x=0;burst(a);a.cool=a===boss?6:8}
      }else if(!a.stun){
        a.root.rotation.y=facing;
        const moved=chaseMonster(a,target,dt,blocked,a===boss?5.4:6,a.radius);
        a.body.position.y=moved>0?Math.abs(Math.sin(clock*7))*.13:0;
        a.legs.forEach((leg,i)=>leg.rotation.x=moved>0?Math.sin(clock*7+i*Math.PI)*.48:0);
        if(d<12&&!a.cool){a.wind=1.25;notify(a.name.toUpperCase()+' IS WINDING UP · MOVE!')}
      }
      a.root.position.set(a.x,world.getGroundHeight(a.x,a.z),a.z);
    }
    const person={x:target.x,z:target.z,y:inCar?target.y??world.getGroundHeight(target.x,target.z):world.getGroundHeight(target.x,target.z)};
    let exposed=false;
    for(let i=clouds.length-1;i>=0;i--){
      const c=clouds[i];c.age+=dt;c.radius=1+Math.min(3,c.age*1.9);
      c.mesh.position.set(c.x,c.y+Math.sin(c.age*2)*.2,c.z);c.mesh.scale.set(c.radius,c.radius*.6,c.radius);
      c.mesh.material.opacity=.34*Math.max(0,1-c.age/4.5);
      exposed ||=gasExposure(c,person,c.y,inCar,blocked);
      if(c.age>=4.5){group.remove(c.mesh);c.mesh.material.dispose();clouds.splice(i,1)}
    }
    if(exposed&&!damageCooldown){damageCooldown=1;hurt(6,'STINK CLOUD · GET TO FRESH AIR!')}
  }
  stop();
  return {start,stop,update,state:()=>({active,bursts,clouds:clouds.length,actors:actors.map(a=>({name:a.name,x:a.x,z:a.z,health:a.hp,visible:a.root.visible,winding:a.wind>0}))})};
}

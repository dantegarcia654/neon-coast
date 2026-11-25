import * as T from 'three';
import {updatePedestrianImpact} from './pedestrian-impact.js';
import {makeLauncher} from './sahur.js';

export function createFootPatrol(world,cruisers){
  const navy=new T.MeshStandardMaterial({color:0x23364a});
  const black=new T.MeshStandardMaterial({color:0x222720});
  const brass=new T.MeshStandardMaterial({color:0xf4c75a,metalness:.5,roughness:.32});
  const launcher=makeLauncher();
  function part(root,geometry,material,x,y,z){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);root.add(mesh);return mesh;
  }
  const officers=cruisers.map((cruiser,i)=>{
    const {root,legs,arms}=world.makeHuman('#304964',['#ab795c','#794f39','#d6a785'][i%3]);
    part(root,new T.CylinderGeometry(.16,.17,.1,12),navy,0,2,0);
    part(root,new T.BoxGeometry(.26,.026,.14),black,0,1.96,-.14);
    part(root,new T.BoxGeometry(.4,.09,.33),black,0,1.04,0);
    part(root,new T.BoxGeometry(.26,.12,.02),navy,0,1.41,.167);
    part(root,new T.CylinderGeometry(.043,.033,.016,5),brass,-.12,1.43,-.17).rotation.x=Math.PI/2;
    const gun=launcher.model.clone(true);
    gun.position.set(.19,1.16,-.36);gun.scale.setScalar(.68);root.add(gun);
    const muzzle=new T.Object3D();muzzle.position.copy(launcher.mouth);gun.add(muzzle);
    arms[0].rotation.set(1.04,0,-.35);arms[1].rotation.set(.94,0,.16);
    root.visible=false;world.scene.add(root);
    return {g:root,root,arms,cruiser,legs,muzzle,police:true,active:false,x:0,z:0,a:0,
      speed:0,snackTime:0,stride:i,model:'Foot officer'};
  });
  function dismiss(u){
    if(!u.active)return;
    u.cruiser.snackTime=Math.max(u.cruiser.snackTime||0,u.snackTime);
    u.impact=null;u.g.rotation.set(0,u.a,0);
    u.arms[0].rotation.set(1.04,0,-.35);u.arms[1].rotation.set(.94,0,.16);
    u.active=u.g.visible=false;u.snackTime=0;u.speed=0;
  }
  function deploy(target,count,allowed,blocked,canSee){
    for(const [i,u] of officers.entries()){
      if(!allowed||i>=count){dismiss(u);continue}
      const c=u.cruiser;
      if(u.active||c.snackTime>0||!canSee(c,target,32))continue;
      for(const side of [1,-1]){
        const x=c.x+side*Math.cos(c.a)*1.9,z=c.z-side*Math.sin(c.a)*1.9;
        if(blocked(x,z,.42))continue;
        u.x=x;u.z=z;u.a=Math.atan2(x-target.x,z-target.z);
        u.active=u.g.visible=true;c.speed=0;c.inContact=false;c.way=null;
        break;
      }
    }
  }
  function update(u,goal,seen,target,stars,dt,blocked){
    if(u.impact){
      updatePedestrianImpact(u,dt,0,world.getGroundHeight);
      u.x=u.g.position.x;u.z=u.g.position.z;u.speed=0;
      if(!u.impact){u.arms[0].rotation.set(1.04,0,-.35);u.arms[1].rotation.set(.94,0,.16);}
      return false;
    }
    let dx=goal.x-u.x,dz=goal.z-u.z,dist=Math.hypot(dx,dz);
    if(!u.snackTime && dist>.001){
      const hold=seen?(dist<2.5?1.15:7):.45;
      const step=Math.min(Math.max(0,dist-hold),(4.4+stars*.34)*dt);
      const heading=Math.atan2(dx,dz);
      u.speed=0;
      // Try the direct path, then walk around the edge of obstructing scenery.
      for(const turn of [0,.6,-.6,1.25,-1.25,1.55,-1.55]){
        if(!step)break;
        const x=u.x+Math.sin(heading+turn)*step,z=u.z+Math.cos(heading+turn)*step;
        if(blocked(x,z,.42)||officers.some(v=>v!==u&&v.active&&Math.hypot(v.x-x,v.z-z)<.75))continue;
        u.x=x;u.z=z;u.speed=step/dt;break;
      }
      u.a=Math.atan2(u.x-goal.x,u.z-goal.z);
    }else u.speed=0;
    u.stride+=u.speed*dt*2.7;
    u.legs.forEach((l,i)=>l.rotation.x=u.speed?Math.sin(u.stride+i*Math.PI)*.57:0);
    u.g.position.set(u.x,world.getGroundHeight(u.x,u.z),u.z);u.g.rotation.y=u.a;
    u.g.rotation.z=u.snackTime>0?.19:0;
    return seen&&!u.snackTime&&Math.hypot(target.x-u.x,target.z-u.z)<1.75;
  }
  return {officers,deploy,update,reset(){officers.forEach(dismiss)}};
}

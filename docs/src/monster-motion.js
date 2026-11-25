// Small swept steps keep a large pursuer from tunnelling through scenery.
export function chaseMonster(actor,target,dt,blocked,speed=5.3,radius=1.35) {
  let moved=0;
  for(let remaining=Math.min(Math.max(dt,0),.1)*speed;remaining>1e-8;) {
    const dx=target.x-actor.x,dz=target.z-actor.z,d=Math.hypot(dx,dz);
    if(d<=radius+.7+1e-6)break;
    const step=Math.min(.18,remaining,d-radius-.7);remaining-=step;
    let found=false;
    for(const angle of [0,.6,-.6,1.2,-1.2,1.7,-1.7]) {
      const x=actor.x+(dx*Math.cos(angle)-dz*Math.sin(angle))/d*step;
      const z=actor.z+(dz*Math.cos(angle)+dx*Math.sin(angle))/d*step;
      if(blocked(x,z,radius))continue;
      actor.x=x;actor.z=z;moved+=step;found=true;break;
    }
    if(!found)break;
  }
  return moved;
}
export function gasExposure(cloud,target,ground,inCar,blocked) {
  if(inCar || Math.abs(ground-target.y)>3)return false;
  const d=Math.hypot(target.x-cloud.x,target.z-cloud.z);
  if(d>=cloud.radius)return false;
  for(let i=1;i<=Math.ceil(d/.4);i++) {
    const t=i/Math.ceil(d/.4);
    if(blocked(cloud.x+(target.x-cloud.x)*t,cloud.z+(target.z-cloud.z)*t,.05))return false;
  }
  return true;
}

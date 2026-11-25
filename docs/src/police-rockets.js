// Dispatch authorizes one serving at a time. Once launched it travels along
// its original heading, so steering, cover and stalled shooters all matter.
import * as T from 'three';

export function createPoliceRockets(world, snack, surfaces, sauce) {
  const {scene, getGroundHeight} = world;
  const flash = new T.Mesh(new T.SphereGeometry(.24, 12, 8),
    new T.MeshBasicMaterial({color:0xffb737}));
  const streak = new T.Mesh(new T.ConeGeometry(.13, 1.1, 10),
    new T.MeshBasicMaterial({color:0xffac32,transparent:true,opacity:.85}));
  streak.rotation.x = Math.PI / 2;
  streak.position.z = .85;
  const projectile = snack.clone(true);
  projectile.add(streak);
  projectile.scale.setScalar(1.8);
  flash.visible = projectile.visible = false;
  scene.add(flash, projectile);

  const ray = new T.Ray(), origin = new T.Vector3(), aim = new T.Vector3(), velocity = new T.Vector3();
  const forward = new T.Vector3(0,0,-1), next = new T.Vector3(), delta = new T.Vector3();
  const body = new T.Box3(), point = new T.Vector3();
  let source=null, lastSource=null, windup=0, cooldown=1.5, age=0, damage=0;
  let fired=0, vehicleHits=0, characterHits=0, warning='';
  function clear() {
    flash.visible=projectile.visible=false;
    lastSource=source=null; windup=age=0; cooldown=1.5; warning='';
  }
  function reset(){clear();fired=vehicleHits=characterHits=0}
  function muzzle(unit) {
    if(unit.muzzle)return unit.muzzle.getWorldPosition(origin);
    return origin.set(unit.x,(unit.y ?? getGroundHeight(unit.x,unit.z))+1.95,unit.z);
  }
  function bearing(dx,dz,heading) {
    const side=dx*Math.cos(heading)-dz*Math.sin(heading);
    const ahead=-dx*Math.sin(heading)-dz*Math.cos(heading);
    if(Math.abs(side)>Math.abs(ahead))return side>0?'RIGHT':'LEFT';
    return ahead>0?'AHEAD':'BEHIND';
  }
  function update(dt,actor,car,units,tier,canSee,vx,vz,notify) {
    if(!tier.rocketInterval){clear();return}
    cooldown-=dt;
    if(!source && !projectile.visible && cooldown<=0){
      // Prefer a different unit and give shots room to travel between cars.
      let best=Infinity;
      for(const unit of units){
        const distance=Math.hypot(unit.x-actor.x,unit.z-actor.z);
        if(distance<3.4 || distance>tier.range || unit.snackTime>0 || !canSee(unit,actor,tier.range))continue;
        const score=Math.abs(distance-22)+(lastSource===unit?18:0);
        if(score<best){source=unit;best=score}
      }
      if(source){windup=.95;flash.visible=true;notify('warn')}
      else cooldown=.2;
    }
    if(!source && !projectile.visible)return;
    if(!projectile.visible){
      if(!units.includes(source)||source.snackTime>0||!canSee(source,actor,tier.range)){
        source=null;flash.visible=false;warning='';cooldown=.75;return;
      }
      flash.position.copy(muzzle(source));
      flash.scale.setScalar(.85+.45*Math.cos(windup*26));
      warning='MEAT ROCKET · '+bearing(source.x-actor.x,source.z-actor.z,actor.a);
      windup-=dt;
      if(windup>0)return;
      const speed=30, lead=Math.min(.5,Math.hypot(actor.x-origin.x,actor.z-origin.z)/speed)*.82;
      aim.set(actor.x+vx*lead,(actor.y??getGroundHeight(actor.x,actor.z))+(car?.spec.kind==='boat'?1.25:.95),actor.z+vz*lead);
      velocity.subVectors(aim,origin).normalize().multiplyScalar(speed);
      projectile.position.copy(origin);
      projectile.quaternion.setFromUnitVectors(forward,delta.copy(velocity).normalize());
      projectile.visible=true;flash.visible=false;age=0;damage=tier.rocketDamage;
      fired++;lastSource=source;cooldown=tier.rocketInterval;notify('launch');
    }
    age+=dt;
    const length=velocity.length()*dt;
    ray.set(projectile.position,delta.copy(velocity).normalize());
    next.copy(projectile.position).addScaledVector(velocity,dt);
    const hit=surfaces.cast(ray,length,source);
    let hitPerson=false;
    if(!car){
      const floor=getGroundHeight(actor.x,actor.z);
      body.min.set(actor.x-.4,floor,actor.z-.4);
      body.max.set(actor.x+.4,floor+1.85,actor.z+.4);
      hitPerson=Boolean(ray.intersectBox(body,point)) && point.distanceTo(ray.origin)<=Math.min(length,hit?.distance??Infinity);
    }
    if(hitPerson){
      sauce.spray(point,delta.copy(ray.direction).negate());
      characterHits++;notify('hit',damage*2);
    }else if(hit){
      sauce.deposit(hit);
      if(car && hit.vehicle===car){vehicleHits++;notify('hit',damage)}
    }
    if(hitPerson || hit || age>2.7 || next.y<getGroundHeight(next.x,next.z)-.1){
      projectile.visible=false;source=null;warning='';
    }else projectile.position.copy(next);
  }
  return {update,clear,reset,get warning(){return warning},state:()=>({fired,vehicleHits,characterHits,
    warning,inFlight:projectile.visible})};
}

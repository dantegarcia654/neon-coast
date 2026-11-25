import * as T from 'three';

// A supporting helicopter searches the last reported position. Only its illuminated
// patch can reacquire the player. Buildings and terrain obstruct both kinds of unit.
export function installAirWatch(world,air){
  const walls=[...world.buildings,...world.cameraObstacles].map(o=>new T.Box3(
    new T.Vector3(o.x-o.w/2,o.base??-.3,o.z-o.d/2),new T.Vector3(o.x+o.w/2,o.h,o.z+o.d/2)));
  const ray=new T.Ray(),from=new T.Vector3(),to=new T.Vector3(),intersection=new T.Vector3();
  function visible(ax,ay,az,bx,by,bz){
    from.set(ax,ay,az);to.set(bx,by,bz);
    const distance=from.distanceTo(to);
    ray.set(from,to.sub(from).normalize());
    for(const wall of walls){
      if(wall.max.x<Math.min(ax,bx)||wall.min.x>Math.max(ax,bx)||wall.max.z<Math.min(az,bz)||wall.min.z>Math.max(az,bz))continue;
      if(ray.intersectBox(wall,intersection)&&intersection.distanceTo(from)<distance-.2)return false;
    }
    if(az< -176||bz< -176)for(let i=1;i<8;i++){
      const t=i/8;if(world.getGroundHeight(ax+(bx-ax)*t,az+(bz-az)*t)>ay+(by-ay)*t)return false;
    }
    return true;
  }
  const material=new T.MeshBasicMaterial({color:0xffefb5,transparent:true,opacity:.095,depthWrite:false,side:T.DoubleSide});
  const beam=new T.Mesh(new T.ConeGeometry(1,1,24,1,true).translate(0,-.5,0),material);
  const pool=new T.Mesh(new T.CircleGeometry(1,32),new T.MeshBasicMaterial({color:0xffe69a,transparent:true,opacity:.20,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  pool.rotation.x=-Math.PI/2;world.scene.add(beam,pool);beam.visible=pool.visible=false;
  let deployed=false,spotted=false,phase=0;const down=new T.Vector3(0,-1,0),axis=new T.Vector3();
  const report={x:0,z:0};let hasReport=false;
  function groundContact(unit,target,range){
    if(unit.snackTime>0||Math.hypot(target.x-unit.x,target.z-unit.z)>range)return false;
    return visible(unit.x,world.getGroundHeight(unit.x,unit.z)+1.6,unit.z,target.x,world.getGroundHeight(target.x,target.z)+1.1,target.z);
  }
  function reset(){
    if(deployed){air.active=false;air.g.visible=false}
    deployed=spotted=hasReport=false;phase=0;beam.visible=pool.visible=false;
  }
  function update(target,tier,groundSeen,dt,roof){
    if(groundSeen||!hasReport){report.x=target.x;report.z=target.z;hasReport=true}
    if(!tier.airCover)return false;
    if(!deployed){
      deployed=true;air.active=air.g.visible=true;
      if(!(air.snackTime>0)){
        air.x=report.x+25;air.z=report.z+27;air.y=roof(air.x,air.z,2)+24;air.a=target.a;air.speed=0;
      }
    }
    if(air.snackTime>0){beam.visible=pool.visible=spotted=false;return false}
    phase+=dt*(tier.blocks===2?.62:.47);
    const wx=report.x+Math.sin(phase)*13,wz=report.z+Math.cos(phase)*13;
    const dx=wx-air.x,dz=wz-air.z,d=Math.hypot(dx,dz);
    const pace=tier.coverSpeed,step=Math.min(d,pace*dt);
    const nx=air.x+dx/(d||1)*step,nz=air.z+dz/(d||1)*step;
    const top=roof(nx,nz,1.6),alt=Math.max(top+7,world.getGroundHeight(report.x,report.z)+24);
    air.y+=T.MathUtils.clamp(alt-air.y,-12*dt,20*dt);air.speed=dt?step/dt:0;
    if(air.y>=top+1){air.x=nx;air.z=nz}
    if(d>1){const a=Math.atan2(-dx,-dz);air.a+=Math.atan2(Math.sin(a-air.a),Math.cos(a-air.a))*Math.min(1,dt*3)}
    const aimX=report.x+Math.sin(phase*1.7)*3-air.x,aimZ=report.z+Math.cos(phase*1.7)*3-air.z;
    const reach=Math.min(1,22/(Math.hypot(aimX,aimZ)||1));
    const x=air.x+aimX*reach,z=air.z+aimZ*reach,y=world.getGroundHeight(x,z)+.15;
    const width=tier.beamRadius;beam.position.set(air.x,air.y+.45,air.z);
    axis.set(x,y,z).sub(beam.position);beam.scale.set(width,axis.length(),width);
    beam.quaternion.setFromUnitVectors(down,axis.normalize());beam.visible=true;
    pool.position.set(x,y,z);pool.scale.setScalar(width);
    pool.visible=visible(air.x,air.y+.45,air.z,x,y+.1,z);
    spotted=Math.hypot(target.x-x,target.z-z)<width &&
      visible(air.x,air.y+.45,air.z,target.x,world.getGroundHeight(target.x,target.z)+1.1,target.z);
    if(spotted){report.x=target.x;report.z=target.z}
    return spotted;
  }
  return {visible,update,groundContact,reset,report,lightPool:pool,get spotted(){return spotted},get deployed(){return deployed}};
}

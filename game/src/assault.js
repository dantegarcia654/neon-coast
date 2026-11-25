// Report a moving vehicle's entry into a pedestrian's footprint once per contact.
export function createAssaultTracker(world,report){
  const contacts=new Set();
  function vehicleStep(car,oldX,oldZ){
    if(!car){contacts.clear();return}
    const dx=car.x-oldX,dz=car.z-oldZ,lengthSq=dx*dx+dz*dz;
    const halfLength=(car.spec.length||4.5)/2;
    const radius=['scooter','quad'].includes(car.spec.kind)?.76:1.22;
    const sn=Math.sin(car.a),cs=Math.cos(car.a);
    for(const npc of world.pedestrians){
      const pos=npc.root.position;
      if(!npc.root.visible || Math.abs((car.y??world.getGroundHeight(car.x,car.z))-pos.y)>1.7){contacts.delete(npc);continue}
      const t=lengthSq?Math.max(0,Math.min(1,((pos.x-oldX)*dx+(pos.z-oldZ)*dz)/lengthSq)):0;
      const x=pos.x-oldX-t*dx,z=pos.z-oldZ-t*dz;
      const inside=Math.abs(x*cs-z*sn)<radius && Math.abs(x*sn+z*cs)<halfLength+.26;
      if(!inside){contacts.delete(npc);continue}
      if(!contacts.has(npc)&&Math.abs(car.speed)>=4&&lengthSq>0)report(npc,'vehicle');
      contacts.add(npc);
    }
  }
  return {vehicleStep,reset(){contacts.clear()}};
}

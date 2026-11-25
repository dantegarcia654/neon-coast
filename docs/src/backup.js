// Pick legal road entrances relative to the player's heading. Penalize approaches
// already covered by other units. On a trail this favors opposite ends of the bend.
export function reinforcementSite(actor,index,domain,route,roads,responders,traffic,blocked) {
  const candidates=[];
  if(domain==='rural'){
    for(let i=1;i<route.length-1;i+=2)candidates.push(route[i]);
  }else{
    for(const road of roads)for(let v=-168;v<=168;v+=12){
      candidates.push({x:road+2.4,z:v},{x:v,z:road-2.4});
    }
  }
  const bearings=[0,Math.PI/2,-Math.PI/2,0,Math.PI,-Math.PI/3,Math.PI/3];
  const angle=actor.a+bearings[index], wantX=-Math.sin(angle),wantZ=-Math.cos(angle);
  let best=null,low=Infinity;
  for(const spot of candidates){
    const x=spot.x-actor.x,z=spot.z-actor.z,d=Math.hypot(x,z);
    if(d<35 || d>98 || blocked(spot.x,spot.z,1.6))continue;
    if(traffic.some(c=>Math.hypot(c.x-spot.x,c.z-spot.z)<6))continue;
    let crowd=0;
    for(const c of responders){
      const dx=c.x-actor.x,dz=c.z-actor.z,dist=Math.hypot(dx,dz);
      if(dist<.1)continue;
      if(Math.hypot(c.x-spot.x,c.z-spot.z)<12){crowd=Infinity;break}
      crowd+=Math.max(0,(x*dx+z*dz)/(dist*d)-.25)*29;
    }
    const score=Math.abs(d-(44+index*2))+16*(1-(x*wantX+z*wantZ)/d)+crowd;
    if(score<low){low=score;best=spot}
  }
  return best;
}

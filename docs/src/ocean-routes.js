import * as T from 'three';
export const desert={x:860,z:-144,radius:94,height:3.2};
export const routeNames=['Tidal Slalom','Sky Loop','Corkscrew Run'];
export function desertContains(x,z,margin=0){return Math.hypot((x-desert.x)/1.1,z-desert.z)<desert.radius-margin}
function curve(points){return new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal')}
export function createOceanRoutes(){
 const loop=[[330,8,-144],[395,8,-144],[444,8,-144]];
 for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;loop.push([465+24*Math.sin(a)+16*i/64,8+24*(1-Math.cos(a)),-144])}
 loop.push([535,8,-144],[620,8,-144],[700,8,-144]);
 const cork=[[330,8,-144],[365,8,-130],[390,8,-144]];
 for(let i=1;i<=64;i++){const t=i/64,a=t*2*Math.PI;cork.push([390+230*t,8+22*(1-Math.cos(a)),-144+22*Math.sin(a)])}
 cork.push([660,8,-164],[700,8,-144]);
 const specs=[
  {id:'bridge',name:'Ocean Gateway',color:'#76e9ec',points:[[164,0,-144],[195,1,-144],[242,5,-144],[290,8,-144],[330,8,-144]]},
  {id:'slalom',name:routeNames[0],color:'#ffba59',points:[[330,8,-144],[380,10,-200],[433,13,-220],[480,9,-80],[540,14,-70],[590,10,-218],[644,8,-194],[700,8,-144]]},
  {id:'loop',name:routeNames[1],color:'#77eaff',points:loop},
  {id:'corkscrew',name:routeNames[2],color:'#ef8bb6',points:cork},
  {id:'arrival',name:'Cactus Crossing',color:'#f8df86',points:[[700,8,-144],[744,7,-144],[782,4,-144],[808,3.25,-144]]}
 ];
 return specs.map(s=>{
  const c=curve(s.points),length=c.getLength(),count=Math.ceil(length/2),frames=[];
  let previous=c.getTangentAt(0),up=new T.Vector3(0,1,0);
  for(let i=0;i<=count;i++){
   const t=i/count,p=c.getPointAt(t),forward=c.getTangentAt(t);
   up.applyQuaternion(new T.Quaternion().setFromUnitVectors(previous,forward));previous=forward.clone();
   const normal=up.clone();
   if(s.id==='corkscrew'){normal.set(0,1,0).addScaledVector(forward,-forward.y).normalize();normal.applyAxisAngle(forward,T.MathUtils.clamp((p.x-390)/230,0,1)*Math.PI*2)}
   const right=forward.clone().cross(normal).normalize();normal.crossVectors(right,forward).normalize();
   const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,normal,forward.clone().negate()));
   frames.push({p,forward,right,up:normal,q});
  }
  return {...s,length,frames,at(distance){const f=T.MathUtils.clamp(distance/length,0,1)*count,i=Math.min(count-1,Math.floor(f)),t=f-i,a=frames[i],b=frames[i+1];return {p:a.p.clone().lerp(b.p,t),q:a.q.clone().slerp(b.q,t),forward:a.forward.clone().lerp(b.forward,t).normalize(),up:a.up.clone().lerp(b.up,t).normalize(),right:a.right.clone().lerp(b.right,t).normalize()}}};
 });
}

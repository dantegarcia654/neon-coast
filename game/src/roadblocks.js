import * as T from 'three';
import {route} from './terrain.js';

export function installRoadblocks(world){
  const white=new T.MeshStandardMaterial({color:'#f4eada'}),steel=new T.MeshStandardMaterial({color:'#323d42'});
  const red=new T.MeshStandardMaterial({color:'#c35035'}),amber=new T.MeshBasicMaterial({color:'#ffc54c'});
  const sign=document.createElement('canvas');sign.width=256;sign.height=64;
  const ink=sign.getContext('2d');ink.fillStyle='#193344';ink.fillRect(0,0,256,64);
  ink.fillStyle='#fff5df';ink.font='bold 45px sans-serif';ink.textAlign='center';ink.fillText('POLICE',128,49);
  const print=new T.CanvasTexture(sign);print.colorSpace=T.SRGBColorSpace;
  const badge=new T.MeshBasicMaterial({map:print});
  const beamWidth=6.4;
  function build(){
    const root=new T.Group(),panel=new T.Group();root.add(panel);world.scene.add(root);
    const box=(w,h,d,x,y,z,mat,parent=panel)=>{
      const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
    };
    for(const x of [-2.62,2.62]){
      box(.38,.13,1.05,x,.12,0,steel);
      box(.14,1.13,.14,x,.65,0,steel);
    }
    box(beamWidth,.44,.18,0,.92,0,white);
    for(let i=-4;i<=4;i++)box(.27,.42,.20,i*.68,.92,0,red).rotation.z=-.35;
    for(const side of [1,-1]){
      const signFace=new T.Mesh(new T.PlaneGeometry(1.38,.35),badge);
      signFace.position.set(0,.92,side*.108);signFace.rotation.y=side>0?0:Math.PI;panel.add(signFace);
    }
    for(const x of [-2.65,2.65]){
      box(.25,.10,.24,x,1.2,0,steel);box(.17,.18,.17,x,1.34,0,amber);
    }
    root.visible=false;
    return {root,panel,x:0,z:0,angle:0,width:beamWidth,broken:false,age:0};
  }
  const slots=[build(),build()];let placements=0;
  function reset(){for(const b of slots)b.root.visible=false;placements=0}
  function drop(b){b.broken=true;b.panel.rotation.x=-1.22}
  function place(b,where){
    const {x,z,angle,width}=where;
    Object.assign(b,{x,z,angle,width,age:0,broken:false});
    b.root.position.set(x,world.getGroundHeight(x,z)+.12,z);b.root.rotation.y=angle;
    b.root.scale.x=width/beamWidth;b.panel.rotation.x=0;b.root.visible=true;placements++;
  }
  function sites(actor,domain,look,side){
    const dx=-Math.sin(actor.a),dz=-Math.cos(actor.a);
    if(domain==='rural'){
      const pos=new T.Vector3(actor.x,0,actor.z);let best=0;
      for(let i=1;i<route.length;i++)if(route[i].distanceToSquared(pos)<route[best].distanceToSquared(pos))best=i;
      const near=route[Math.max(0,best-1)],far=route[Math.min(route.length-1,best+1)];
      const dir=dx*(far.x-near.x)+dz*(far.z-near.z)>=0?1:-1;
      const out=[];
      for(const extra of [0,8,16,-6]){
        const j=best+dir*(Math.round(look/2)+extra);if(j<1||j>=route.length-1)continue;
        const a=route[j-1],b=route[j+1],angle=Math.atan2(a.x-b.x,a.z-b.z);
        out.push({x:route[j].x+side*2.55*Math.cos(angle),z:route[j].z-side*2.55*Math.sin(angle),angle,width:3.8});
      }
      return out;
    }
    const out=[];
    for(const n of world.roads)for(let m=-168;m<=168;m+=48){
      out.push({x:n+side*4,z:m,angle:0,width:6.4},{x:m,z:n+side*4,angle:Math.PI/2,width:6.4});
    }
    const score=v=>Math.hypot(v.x-actor.x-dx*look,v.z-actor.z-dz*look)+
      18*(1-Math.abs(Math.cos(v.angle)*dz+Math.sin(v.angle)*dx));
    return out.sort((a,b)=>score(a)-score(b));
  }
  function update(actor,domain,count,dt,reported,blocked){
    if(!count||!['rural','street'].includes(domain)){reset();return}
    for(const [i,b] of slots.entries()){
      if(i>=count){b.root.visible=false;continue}
      b.age+=dt;
      if(b.root.visible){
        const dist=Math.hypot(actor.x-b.x,actor.z-b.z);
        if(b.age<16||dist<108)continue;
        b.root.visible=false;
      }
      if(!reported)continue;
      const look=Math.min(96,Math.max(48,Math.abs(actor.speed||0)*2.2))+i*42;
      const side=placements%2?-1:1;
      const next=sites(actor,domain,look,side).find(v=>
        Math.hypot(v.x-actor.x,v.z-actor.z)>32 &&
        slots.every(other=>other===b||!other.root.visible||Math.hypot(v.x-other.x,v.z-other.z)>32) &&
        !blocked(v.x,v.z,1) && world.cars.every(c=>Math.hypot(v.x-c.x,v.z-c.z)>5));
      if(next)place(b,next);
    }
  }
  function contains(x,z,r,b){
    const dx=x-b.x,dz=z-b.z,cs=Math.cos(b.angle),sn=Math.sin(b.angle);
    return Math.abs(dx*cs-dz*sn)<b.width/2+r && Math.abs(dx*sn+dz*cs)<.32+r;
  }
  function hit(x,z,r){return slots.find(b=>b.root.visible&&!b.broken&&contains(x,z,r,b))}
  return {reset,update,hit,drop,slots,
    state:()=>slots.filter(b=>b.root.visible).map(({x,z,angle,width,broken})=>({x,z,angle,width,broken}))};
}

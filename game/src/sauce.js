import * as T from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';

function saucePrint(seed) {
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');
  function pool(x,y,r,color,highlight){
    const count=36,points=[];
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count,l=r*(.66+random()*.42+(i%5===0?random()*.53:0));
      points.push([x+Math.cos(a)*l,y+Math.sin(a)*l*.78]);
    }
    const glaze=ctx.createRadialGradient(x-r*.2,y-r*.28,r*.06,x,y,r*1.15);
    glaze.addColorStop(0,highlight);glaze.addColorStop(.32,color);glaze.addColorStop(.83,color);glaze.addColorStop(1,color==='#a71909'?'#6b1509':'#b87406');
    ctx.fillStyle=glaze;ctx.beginPath();
    const last=points[count-1];ctx.moveTo((last[0]+points[0][0])/2,(last[1]+points[0][1])/2);
    for(let i=0;i<count;i++){const a=points[i],b=points[(i+1)%count];ctx.quadraticCurveTo(...a,(a[0]+b[0])/2,(a[1]+b[1])/2)}
    ctx.closePath();ctx.fill();
    ctx.strokeStyle=highlight;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x-r*.22,y-r*.18,r*.33,r*.22,-.4,3.1,4.8);ctx.stroke();
  }
  function splash(x,y,r,col,light){
    ctx.strokeStyle=col;ctx.lineCap='round';
    for(let i=0;i<10;i++){
      const a=random()*Math.PI*2,l=r*(.9+random()*.9),dx=Math.cos(a),dy=Math.sin(a);
      const ex=x+dx*l,ey=y+dy*l*.84,wide=1.8+random()*6;
      ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x+dx*r*.36+dy*wide,y+dy*r*.36-dx*wide);
      ctx.quadraticCurveTo(x+dx*l*.72+dy*wide,y+dy*l*.64,ex,ey);
      ctx.quadraticCurveTo(x+dx*l*.75-dy*2,y+dy*l*.65,x+dx*r*.36-dy*wide,y+dy*r*.36+dx*wide);
      ctx.fill();
      if(random()>.23)pool(ex+dx*9,ey+dy*8,2+random()*4,col,light);
    }
    pool(x,y,r,col,light);
  }
  splash(116,133,50,'#a71909','#d84119');
  splash(151,109,27,'#dd9504','#ffd346');
  // Mustard keeps a raised, winding strand across the heavier ketchup pool.
  const ribbon=new Path2D();ribbon.moveTo(82,154);ribbon.bezierCurveTo(96,166,104,122,120,136);
  ribbon.bezierCurveTo(136,152,131,98,156,115);ribbon.bezierCurveTo(166,122,177,108,187,105);
  ctx.lineCap='round';ctx.lineWidth=7;ctx.strokeStyle='#d08a05';ctx.stroke(ribbon);
  ctx.lineWidth=2;ctx.strokeStyle='#ffc436';ctx.stroke(ribbon);
  for(let i=0;i<14;i++){
    const a=random()*Math.PI*2,r=58+random()*49;
    const yellow=i%3===0;pool(128+Math.cos(a)*r,128+Math.sin(a)*r*.78,2+random()*4,yellow?'#dd9504':'#a71909',yellow?'#ffd346':'#d84119');
  }
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  const relief=document.createElement('canvas');relief.width=relief.height=256;
  const h=relief.getContext('2d');h.drawImage(c,0,0);h.globalCompositeOperation='source-in';h.fillStyle='#fff';h.fillRect(0,0,256,256);
  const mask=document.createElement('canvas');mask.width=mask.height=256;
  const hc=mask.getContext('2d');hc.fillStyle='#000';hc.fillRect(0,0,256,256);
  hc.filter='blur(4px)';hc.drawImage(relief,0,0);hc.filter='none';hc.globalAlpha=.25;hc.drawImage(c,0,0);
  return {map,bumpMap:new T.CanvasTexture(mask),bumpScale:.032};

}

// Restrict projection to nearby faces before clipping. City road meshes can be large,
// and the imported cars have far more triangles than a single serving covers.
function patch(hit,size,roll){
  const g=hit.mesh.geometry,attr=g.attributes.position,idx=g.index;
  const localBox=new T.Box3().setFromCenterAndSize(hit.point,new T.Vector3(size*1.6,size*1.6,size*1.6))
    .applyMatrix4(hit.matrix.clone().invert());
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),bounds=new T.Box3(),v=new T.Vector3(),w=new T.Vector3();
  const positions=[];
  for(let i=0,n=idx?idx.count:attr.count;i<n;i+=3){
    a.fromBufferAttribute(attr,idx?idx.getX(i):i);b.fromBufferAttribute(attr,idx?idx.getX(i+1):i+1);c.fromBufferAttribute(attr,idx?idx.getX(i+2):i+2);
    bounds.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
    if(!bounds.intersectsBox(localBox))continue;
    a.applyMatrix4(hit.matrix);b.applyMatrix4(hit.matrix);c.applyMatrix4(hit.matrix);
    v.subVectors(b,a).cross(w.subVectors(c,a)).normalize();
    if(Math.abs(v.dot(hit.normal))<.23)continue;
    for(const p of [a,b,c])positions.push(p.x,p.y,p.z);
  }
  const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(positions,3));source.computeVertexNormals();
  const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),hit.normal);
  rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll));
  const projector=new T.Mesh(source);const geo=new DecalGeometry(projector,hit.point,new T.Euler().setFromQuaternion(rotation),new T.Vector3(size,size,.18));
  source.dispose();if(hit.owner)geo.applyMatrix4(hit.owner.matrixWorld.clone().invert());
  return geo;
}

export function createSauce(scene){
  const ink=Array.from({length:6},(_,i)=>new T.MeshStandardMaterial({...saucePrint(49+579*i),roughness:.23,
    metalness:0,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-5,side:T.DoubleSide}));
  const ketchup=new T.MeshStandardMaterial({color:'#d82b17',roughness:.25});
  const mustard=new T.MeshStandardMaterial({color:'#ffc21c',roughness:.3});
  const bead=new T.SphereGeometry(1,9,6),marks=[],drops=[];
  let total=0,last=null;
  function discard(){const mark=marks.shift();mark.mesh.removeFromParent();mark.mesh.geometry.dispose()}
  function deposit(hit){
    const size=hit.vehicle?1.4:hit.kind==='pedestrian'?.72:1.85;
    const geometry=patch(hit,size*(.92+.16*Math.random()),Math.random()*2*Math.PI);
    const mesh=new T.Mesh(geometry,ink[total%ink.length]);mesh.userData.sauce=true;mesh.renderOrder=3;
    (hit.owner||scene).add(mesh);
    marks.push({mesh,age:0});if(marks.length>40)discard();
    total++;last={kind:hit.kind,point:hit.point.toArray(),normal:hit.normal.toArray(),attached:Boolean(hit.owner)};
    spray(hit.point,hit.normal);
  }
  function spray(point,normal){
    const tangent=new T.Vector3().crossVectors(normal,Math.abs(normal.y)>.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0)).normalize();
    const bitangent=new T.Vector3().crossVectors(normal,tangent);
    for(let i=0;i<20;i++){
      const angle=i*2.4,r=1.1+Math.random()*3.2;
      const velocity=normal.clone().multiplyScalar(1+Math.random()*2.3)
        .addScaledVector(tangent,Math.cos(angle)*r).addScaledVector(bitangent,Math.sin(angle)*r);
      const m=new T.Mesh(bead,i%2?ketchup:mustard);m.position.copy(point).addScaledVector(normal,.025);
      const scale=.013+Math.random()**2*.042;m.scale.set(scale,scale,scale*(2+Math.random()*1.7));
      scene.add(m);drops.push({m,velocity,age:0,life:.23+Math.random()*.24});
    }
  }
  const axis=new T.Vector3(0,0,1),unit=new T.Vector3();
  function update(dt){
    for(const m of marks)m.age+=dt;
    while(marks[0]?.age>28)discard();
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];d.age+=dt;d.velocity.y-=7*dt;
      d.m.position.addScaledVector(d.velocity,dt);
      d.m.quaternion.setFromUnitVectors(axis,unit.copy(d.velocity).normalize());
      if(d.age>d.life){d.m.removeFromParent();drops.splice(i,1)}
    }
  }
  function reset(){while(marks.length)discard();for(const d of drops)d.m.removeFromParent();drops.length=0;total=0;last=null}
  return {deposit,spray,update,reset,state:()=>({total,visible:marks.length,last})};
}

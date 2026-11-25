import * as T from 'three';

const { smoothstep, lerp, clamp } = T.MathUtils;
const NORTH = -662, SOUTH = -176, WEST = -318, EAST = 290, STEP = 3;
const cols = Math.ceil((EAST-WEST)/STEP)+1, rows = Math.ceil((SOUTH-NORTH)/STEP)+1;
const heights = new Float32Array(cols*rows);
const ridge = (x,z,cx,cz,rx,rz) => Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
const shore = z => 210+17*Math.sin((z+220)*.022)+8*Math.sin(z*.055);
const creek = x => -271-19*Math.sin(x*.024);
const tide = -.9;
function relief(x,z) {
  const edge = smoothstep(-z,176,217);
  const rock = 46*ridge(x,z,-70,-491,122,88)+25*ridge(x,z,-205,-485,61,94);
  const dunes = smoothstep(x,60,142)*(1.9+2*Math.sin(x*.10+z*.049))*(.6+.4*Math.cos(z*.045));
  const woods = smoothstep(-x,30,130)*(2.3+1.8*Math.sin(x*.06)*Math.cos(z*.038));
  const base = 2.1 + rock + dunes + woods + .65*Math.sin(x*.061+z*.048);
  const cut = 6.3*Math.exp(-((z-creek(x))**2)/165)*smoothstep(x,-90,4);
  const land = lerp(base-cut,-4,smoothstep(x,shore(z)-12,shore(z)+7));
  const northRim=smoothstep(-z,610,656), westRim=smoothstep(-x,256,308);
  const cityShore=lerp(0,-4,smoothstep(x,207,215));
  return lerp(cityShore,lerp(land,-5,Math.max(northRim,westRim)),edge);
}
for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++)
  heights[iz*cols+ix]=relief(WEST+ix*STEP,NORTH+iz*STEP);

// Interpolate the same triangles used by the renderer so tires and feet
// follow small undulations without sinking into a separately sampled mesh.
export function landHeight(x,z) {
  if(z>SOUTH)return 0;
  const u=clamp((x-WEST)/STEP,0,cols-1.00001),v=clamp((z-NORTH)/STEP,0,rows-1.00001);
  const i=Math.floor(u),j=Math.floor(v),fx=u-i,fz=v-j,k=j*cols+i;
  const a=heights[k],b=heights[k+1],c=heights[k+cols],d=heights[k+cols+1];
  return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
}
const routeNodes=[[0,-173],[0,-212],[21,-238],[68,-256],[92,-285],[127,-328],[168,-354],[170,-394],[134,-425],[87,-446],[38,-440],[16,-468],[-28,-490],[-63,-518],[-105,-508],[-142,-470],[-175,-451],[-190,-419],[-170,-389],[-138,-374],[-131,-342],[-158,-311],[-151,-272],[-117,-245],[-96,-211],[-96,-173]];
const curve=new T.CatmullRomCurve3(routeNodes.map(([x,z])=>new T.Vector3(x,0,z)));
export const route=curve.getSpacedPoints(Math.ceil(curve.getLength()/2));
const spans=[];
const bins=new Map();
const key=(x,z)=>Math.floor(x/24)+','+Math.floor(z/24);
for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],dx=b.x-a.x,dz=b.z-a.z;
  const segment={a,dx,dz,sq:dx*dx+dz*dz};spans.push(segment);
  for(let x=Math.floor((Math.min(a.x,b.x)-12)/24);x<=Math.floor((Math.max(a.x,b.x)+12)/24);x++)
    for(let z=Math.floor((Math.min(a.z,b.z)-12)/24);z<=Math.floor((Math.max(a.z,b.z)+12)/24);z++){
      const id=x+','+z;if(!bins.has(id))bins.set(id,[]);bins.get(id).push(segment);
    }
}
function trailDistance(x,z) {
  let best=Infinity;
  for(const {a,dx,dz,sq} of bins.get(key(x,z))||[]){
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/sq,0,1);
    best=Math.min(best,(x-a.x-t*dx)**2+(z-a.z-t*dz)**2);
  }
  return Math.sqrt(best);
}
function isSpan(x,z){return x>28 && x<132 && Math.abs(z-creek(x))<19}
function roadLevel(x,z){return (isSpan(x,z)?Math.max(landHeight(x,z),1.36):landHeight(x,z))+.095}
export function ruralHeight(x,z){
  return trailDistance(x,z)<5.4?roadLevel(x,z):landHeight(x,z);
}
export function region(x,z) {
  if(z> -176)return null;
  if(z< -410 && x<95)return 'SAWTOOTH RIDGE';
  if(x< -55)return 'LONGLEAF FOREST';
  if(x>105 && z< -298)return 'EGRET DUNES';
  return 'BLACKWATER MARSH';
}
export function groundType(x,z){
  if(z> -176 || trailDistance(x,z)<5.5)return 'pavement';
  if(landHeight(x,z)<tide+.14)return 'water';
  if(x>100 && z< -298)return 'sand';
  if(region(x,z)==='SAWTOOTH RIDGE')return 'rock';
  return 'grass';
}
export function outsideMap(x,z,r){
  if(z>=-176)return Math.abs(x)>174 || z>174;
  if(x<WEST+5 || x>EAST-5 || z<NORTH+5)return true;
  if(z> -215 && Math.abs(x)>174+(-176-z)*1.9)return true;
  if(isSpan(x,z)&&trailDistance(x,z)<=5.4-r)return false;
  return landHeight(x,z)<tide+.12 || landHeight(x+r,z)<tide || landHeight(x-r,z)<tide ||
    landHeight(x,z+r)<tide || landHeight(x,z-r)<tide;
}
export const trailheads=[
  ['Blackwater Marsh',2],['Egret Dunes',6],['Sawtooth Ridge',13],['Longleaf Forest',19]
].map(([name,index])=>{
  const [x,z]=routeNodes[index],tangent=curve.getTangent(index/(routeNodes.length-1));
  return {name,x,z,a:Math.atan2(-tangent.x,-tangent.z)};
});
const colors={pine:new T.Color('#596947'),meadow:new T.Color('#889052'),rock:new T.Color('#928a7f'),sand:new T.Color('#dac292'),mud:new T.Color('#636950'),bed:new T.Color('#566d68')};
function groundColor(x,z,h){
  const c=colors.meadow.clone().lerp(colors.pine,smoothstep(-x,30,100))
    .lerp(colors.rock,smoothstep(h,16,38)).lerp(colors.sand,smoothstep(x,78,143)*smoothstep(-z,291,339))
    .lerp(colors.mud,1-smoothstep(h,.1,1.9)).lerp(colors.bed,1-smoothstep(h,-1,0));
  return c.multiplyScalar(.94+.06*Math.sin(x*.17+z*.12)+.035*Math.sin(z*.43-x*.67));
}
function makeGround(){
  const xyz=[],rgb=[],indices=[],uv=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const k=j*cols+i,x=WEST+i*STEP,z=NORTH+j*STEP,h=heights[k];
    xyz.push(x,h,z);groundColor(x,z,h).toArray(rgb,k*3);uv.push(x/14,z/14);
    if(i<cols-1&&j<rows-1)indices.push(k,k+cols,k+1,k+1,k+cols,k+cols+1);
  }
  let seed=123;const bytes=new Uint8Array(128*128*4);
  for(let i=0;i<bytes.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=195+(seed>>>26);bytes.set([n,n,n,255],i)}
  const tex=new T.DataTexture(bytes,128,128);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const land=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,map:tex,roughness:.96}));land.receiveShadow=true;return land;
}
// Mesh each cross-section independently on the sampled terrain, including a
// raised timber crossing over the tide channel.
function ribbon(left,right,lift,material,visible=()=>true){
  const p=[],uv=[],ix=[];let distance=0;
  for(let i=0;i<route.length;i++){
    const a=route[i],before=route[Math.max(0,i-1)],after=route[Math.min(i+1,route.length-1)];
    const angle=Math.atan2(after.z-before.z,after.x-before.x),nx=-Math.sin(angle),nz=Math.cos(angle);
    if(i)distance+=a.distanceTo(before);
    const cuts=4;
    for(let j=0;j<=cuts;j++){
      const offset=lerp(left,right,j/cuts),x=a.x+nx*offset,z=a.z+nz*offset;
      p.push(x,roadLevel(x,z)+lift,z);uv.push(offset/5,distance/5);
      if(i && j<cuts && visible(a,i)){const b=(i-1)*(cuts+1)+j;ix.push(b,b+1,b+cuts+1,b+1,b+cuts+2,b+cuts+1)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;return mesh;
}
// One tuft or whorl is instanced as a unit so a field of reeds and a pine
// canopy can have broken silhouettes without a draw call per branch.
function grassTuft() {
  const points=[],indices=[];
  for(let i=0;i<9;i++){
    const a=i*2.39996, length=.55+.42*(i%4)/3, bend=.14+.19*(i%3)/2;
    const x=Math.cos(a),z=Math.sin(a), w=.026+(i%3)*.007,base=i*5;
    points.push(x*.065-z*w,0,z*.065+x*w,x*.065+z*w,0,z*.065-x*w,
      x*bend*.52-z*w*.65,length*.56,z*bend*.52+x*w*.65,
      x*bend*.52+z*w*.65,length*.56,z*bend*.52-x*w*.65,
      x*bend,length,z*bend);
    indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function pineWhorl() {
  const xyz=[],ix=[];
  for(let i=0;i<11;i++){
    const a=i*2.39996, b=i*5, r=.7+.28*Math.cos(i*2),h=.18*Math.sin(i*3.3);
    xyz.push(0,.60,0,Math.cos(a-.4)*r*.57,h,Math.sin(a-.4)*r*.57,
      Math.cos(a)*r,h-.22,Math.sin(a)*r,Math.cos(a+.4)*r*.68,h,Math.sin(a+.4)*r*.68,
      Math.cos(a)*r*.48,h+.16,Math.sin(a)*r*.48);
    ix.push(b,b+1,b+4,b+1,b+2,b+4,b+2,b+3,b+4,b+3,b,b+4);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function createRuralWorld(scene,roadMaterial,box,label,colliders,cameraObstacles){
  scene.add(makeGround());
  const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.85,side:T.DoubleSide});
  const paving=roadMaterial.clone();paving.side=T.DoubleSide;
  scene.add(ribbon(-5.4,5.4,0,mat('#b1a18b')),ribbon(-4.65,4.65,.024,paving),
    ribbon(-.09,.09,.044,mat('#e5be72'),(p,i)=>i%8<4),
    ribbon(-4.48,-4.37,.045,mat('#d8d0ba')),ribbon(4.37,4.48,.045,mat('#d8d0ba')));
  let seed=426;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const sets=new Map(),dummy=new T.Object3D();
  function place(id,geo,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
    if(!sets.has(id))sets.set(id,{geo,mat:mat(color),items:[]});
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();sets.get(id).items.push(dummy.matrix.clone());
  }
  const grass=grassTuft(),needles=pineWhorl();
  const trunk=new T.CylinderGeometry(.75,1,1,8),crown=new T.ConeGeometry(1,1,9),leaf=new T.IcosahedronGeometry(1,1),stone=new T.DodecahedronGeometry(1,0);
  for(let i=0;i<12000;i++){
    const x=lerp(-285,228,rand()),z=lerp(-620,-183,rand()),h=landHeight(x,z);
    if(h<tide-.2||trailDistance(x,z)<8)continue;
    const district=region(x,z),s=.65+rand()*.85;
    if(district==='LONGLEAF FOREST' && i%4===0 && h>0 || district==='SAWTOOTH RIDGE' && h<31 && i%12===0 && h>0){
      const y=7*s;place('bark',trunk,'#665446',x,h+y*.5,z,.24*s,y,.24*s);
      for(let n=0;n<5;n++)place('pine'+n,needles,['#364e3e','#405c44','#526b48','#5e754f','#70805b'][n],x,h+y*(.53+n*.11),z,(2.5-.35*n)*s,2.6*s,(2.5-.35*n)*s,0,rand()*6);
      colliders.push({x,z,w:.25*s,d:.25*s});
    } else if(district==='BLACKWATER MARSH' && h>.1 && i%40===0){
      place('cypress',trunk,'#786f55',x,h+2.7*s,z,.48*s,5.4*s,.48*s);
      for(let n=0;n<7;n++){
        const a=n*2.399, off=n===6?0:1.12*s;
        place('canopy'+(n%2),leaf,n%2?'#627448':'#708255',x+Math.cos(a)*off,h+(4.8+n*.24)*s,z+Math.sin(a)*off,1.35*s,1.5*s,1.45*s,0,a);
      }
      for(let k=0;k<4;k++)place('knees',crown,'#766b55',x+rand()*3-1.5,h+.45*s,z+rand()*3-1.5,.24*s,.9*s,.24*s);
      colliders.push({x,z,w:.4*s,d:.4*s});
    } else if(district==='SAWTOOTH RIDGE' && i%5===0 && h>13){
      place('granite',stone,'#938c83',x,h+.5*s,z,2.4*s,1.6*s,1.7*s,.2,rand()*6,.2);
      colliders.push({x,z,w:1.25*s,d:1.12*s});
      cameraObstacles.push({x,z,w:4*s,d:3.2*s,h:h+2.15*s,base:h-.7*s});
    } else if(i%2===0){
      const sandy=district==='EGRET DUNES',wet=h<1.1;
      place(sandy?'oats':wet?'rushes':'brush',grass,sandy?'#ad9d59':wet?'#65723c':'#71824d',x,h-.025,z,s*1.7,(wet?1.7:.90)*s,s*1.7,0,rand()*6);
      if(sandy && i%11===0 && x<shore(z)-17){
        for(let k=0;k<4;k++)place('seaGrape',leaf,'#788853',x+Math.cos(k*2)*s,h+.37*s,z+Math.sin(k*2)*s,.92*s,.57*s,.9*s,0,k);
      }
    }
  }
  // Slatted sand fencing follows the crest above the beach.
  const slat=new T.BoxGeometry(1,1,1);
  for(let z=-426;z< -326;z+=.74){
    if(z> -382&&z< -376)continue;
    const x=shore(z)-21,h=landHeight(x,z),tilt=.10*Math.sin(z*2.9);
    place('fence',slat,'#9e8968',x,h+.64,z,.065,1.3,.16,tilt,0,-tilt);
  }
  for(const {geo,mat,items} of sets.values()){
    const m=new T.InstancedMesh(geo,mat,items.length);items.forEach((v,i)=>m.setMatrixAt(i,v));m.castShadow=true;m.receiveShadow=true;scene.add(m);
  }
  for(let i=2;i<route.length-2;i+=2){
    const p=route[i],next=route[i+1];if(!isSpan(p.x,p.z)||landHeight(p.x,p.z)>1.3)continue;
    const dx=next.x-p.x,dz=next.z-p.z,l=Math.hypot(dx,dz);
    for(const s of [-1,1]){
      const x=p.x-s*dz/l*5.6,z=p.z+s*dx/l*5.6,y=roadLevel(p.x,p.z);
      box(.22,y+2,.22,'#796b58',x,(y-2)/2,z);
      const rail=box(.16,.23,4.3,'#bca88e',x,y+.67,z);rail.rotation.y=Math.atan2(dx,dz);
    }
  }
  // Survey tower at the summit makes the ridge identifiable from the approach.
  const tx=-64,tz=-535,base=landHeight(tx,tz);
  for(const x of [-2,2])for(const z of [-2,2])box(.35,10,.35,'#79634c',tx+x,base+5,tz+z);
  box(5.6,.4,5.6,'#8b7157',tx,base+10,tz);box(4.8,2.6,4.8,'#829390',tx,base+11.4,tz);box(5.7,.35,5.7,'#9b5844',tx,base+12.85,tz);
  colliders.push({x:tx,z:tz,w:2.4,d:2.4});
  const lx=188,lz=-395,ly=landHeight(lx,lz);
  for(let i=0;i<6;i++){
    const section=new T.Mesh(new T.CylinderGeometry(2.2-i*.18,2.38-i*.18,3.5,18),mat(i%2?'#aa5141':'#e4dbc4'));
    section.position.set(lx,ly+1.75+i*3.5,lz);scene.add(section);
  }
  box(3,1.7,3,'#c4dece',lx,ly+21.8,lz);box(4,.4,4,'#5c625f',lx,ly+22.8,lz);
  colliders.push({x:lx,z:lz,w:2.2,d:2.2});
  for(const [text,x,z,yaw] of [['COASTAL LOOP  ↑',-9,-168,0],['BLACKWATER',11,-219,-.3],['EGRET DUNES',147,-337,-.7],['SUMMIT  /  48 M',-54,-508,1.5],['LONGLEAF',-147,-385,2.4]]){
    const h=landHeight(x,z);box(.18,2,.18,'#766a52',x,h+1,z);
    const face=label(text,'#e2ebc7',5.5,1.1);face.position.set(x,h+2.25,z);face.rotation.y=yaw;face.material.side=T.DoubleSide;scene.add(face);
  }
}
let radar;
export function ruralRadar(){
  if(radar)return radar;
  radar=document.createElement('canvas');radar.width=cols;radar.height=rows;
  const ctx=radar.getContext('2d'),data=ctx.createImageData(cols,rows);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const x=WEST+i*STEP,z=NORTH+j*STEP,h=landHeight(x,z),c=groundColor(x,z,h).convertLinearToSRGB();
    data.data.set(h<tide?[53,104,116,255]:[c.r*150,c.g*159,c.b*148,255],(j*cols+i)*4);
  }
  ctx.putImageData(data,0,0);return radar;
}
export function drawCountryside(map,tx,tz,sc){
  const img=ruralRadar();map.drawImage(img,tx(WEST),tz(NORTH),cols*STEP*sc,rows*STEP*sc);
  map.beginPath();route.forEach((p,i)=>i?map.lineTo(tx(p.x),tz(p.z)):map.moveTo(tx(p.x),tz(p.z)));map.strokeStyle='#c7b695';map.lineWidth=7*sc;map.stroke();
}

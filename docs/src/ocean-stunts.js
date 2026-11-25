import * as T from 'three';
import {createOceanRoutes,desert,desertContains,routeNames} from './ocean-routes.js';
export function installOceanStunts(world,{notify}) {
 const routes=createOceanRoutes(),group=new T.Group();group.name='Ocean stunt roads and Cactus Crossing';world.scene.add(group);
 const materials=new Map(),geo=new T.BoxGeometry(1,1,1);
 const material=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.76}));return materials.get(c)};
 function box(x,y,z,w,h,d,color){const m=new T.Mesh(geo,material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=m.receiveShadow=true;group.add(m);return m}
 function sign(text,x,y,z,color='#f7d78b',angle=-Math.PI/2,width=16){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#143d45';ctx.fillRect(0,0,1024,192);ctx.strokeStyle=color;ctx.lineWidth=12;ctx.strokeRect(8,8,1008,176);
  ctx.fillStyle=color;ctx.font='bold 56px sans-serif';ctx.textAlign='center';ctx.fillText(text,512,116,980);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const m=new T.Mesh(new T.PlaneGeometry(width,width*.1875),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.y=angle;group.add(m);
 }
 for(const road of routes){
  const vertices=[],indices=[],left=[],right=[];
  road.frames.forEach((f,i)=>{
   for(const side of [-1,1]){const p=f.p.clone().addScaledVector(f.right,side*5.8);vertices.push(...p.toArray());(side<0?left:right).push(p.clone().addScaledVector(f.up,.7))}
   if(i){const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n)}
   if(i%8===0){const dash=box(f.p.x,f.p.y+.04,f.p.z,.18,.045,2.1,'#fff1ba');dash.quaternion.copy(f.q);dash.position.copy(f.p).addScaledVector(f.up,.04)}
   if(i%20===0 && road.id==='bridge')box(f.p.x,(f.p.y-1)/2,f.p.z,1.3,f.p.y+1,1.3,'#51656b');
  });
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  const roadMat=new T.MeshStandardMaterial({color:'#344953',roughness:.87,side:T.DoubleSide});const mesh=new T.Mesh(g,roadMat);mesh.receiveShadow=true;group.add(mesh);
  const railMat=new T.MeshStandardMaterial({color:road.color,emissive:road.color,emissiveIntensity:.24});
  for(const points of [left,right])group.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),points.length,.17,5,false),railMat));
  if(road.id==='slalom')for(const t of [.22,.63]){const f=road.at(road.length*t);for(let j=0;j<3;j++){const pad=box(0,0,0,8,.08,.4,'#ffcf69');pad.position.copy(f.p).addScaledVector(f.forward,j*1.5).addScaledVector(f.up,.05);pad.quaternion.copy(f.q)}}
 }
 // The branches depart at different heights/directions; their luminous rails reveal the whole junction.
 sign('OCEAN RUN → CACTUS CROSSING',174,7,-144,'#8cf4e8',-Math.PI/2,24);
 sign('1 SLALOM · 2 LOOP · 3 CORKSCREW',302,13,-144,'#ffe0a1',-Math.PI/2,27);
 sign('MAGNETIC TRACK · W GO · S BRAKE',245,10,-144,'#b6edf2',-Math.PI/2,25);
 for(const z of [-153,-135])box(174,3.5,z,.4,7,.4,'#35545a');
 const island=new T.Mesh(new T.CylinderGeometry(desert.radius,desert.radius+7,7,64),material('#e6b96f'));island.scale.x=1.1;island.position.set(desert.x,desert.height-3.5,desert.z);island.receiveShadow=true;group.add(island);
 const street=box(853,3.23,-144,108,.06,13,'#d0a06a');
 box(860,3.24,-144,18,.08,98,'#d0a06a');
 const townColors=['#e99375','#59b9b0','#f2c45f','#e7a0ba','#faf0c8','#83b6dc'];
 for(const side of [-1,1])for(let i=0;i<5;i++){
  const x=823+i*17,z=-144+side*(23+(i%2)*9),height=7+(i%3)*2,color=townColors[(i+(side>0?2:0))%6];
  box(x,3.2+height/2,z,12,height,11,color);box(x,3.2+height,z,12.6,.45,11.6,'#f5d5aa');
  const front=z-side*5.55;
  box(x,5,front,2.4,3.6,.13,'#2f6671');
  for(const dx of [-3.7,3.7]){box(x+dx,7,front,1.8,1.8,.14,'#35788a');box(x+dx,5.95,front,2.2,.15,.4,'#f9dfa8')}
  world.colliders.push({x,z,w:6,d:5.5});world.cameraObstacles.push({x,z,w:12,d:11,h:height,base:3.2});
 }
 // A stepped sun tower, plaza and rows of festival flags make a place worth reaching.
 for(let i=0;i<4;i++)box(890,3.2+i*3.5+1.75,-91,18-i*3,3.5,18-i*3,i%2?'#e9b05f':'#d88a60');
 world.colliders.push({x:890,z:-91,w:9,d:9});
 const fountain=new T.Mesh(new T.CylinderGeometry(4,4.8,.7,20),material('#5aadb5'));fountain.position.set(860,3.7,-144);group.add(fountain);world.colliders.push({x:860,z:-144,w:4.5,d:4.5});
 for(let row=0;row<3;row++)for(let i=0;i<13;i++){
  const flag=new T.Mesh(new T.ConeGeometry(.7,1.4,3),material(townColors[(i+row)%6]));flag.position.set(815+i*6.5,14+Math.sin(i*.5),-157+row*13);flag.rotation.z=Math.PI;group.add(flag);
 }
 function cactus(x,z,h){
  const g=new T.Group();g.position.set(x,desert.height,z);group.add(g);const mat=material('#638b4e');
  function stem(x,y,z,r,h){const m=new T.Mesh(new T.CapsuleGeometry(r,h,3,7),mat);m.position.set(x,y,z);g.add(m);return m}
  stem(0,h/2,0,.42,h);for(const side of [-1,1]){const arm=stem(side*.8,h*.5,0,.25,1.2);arm.rotation.z=Math.PI/2;stem(side*1.4,h*.5+.7,0,.26,1.2)}
 }
 for(let i=0;i<38;i++){const a=i*2.399,r=65+(i%4)*6,x=860+Math.cos(a)*r,z=-144+Math.sin(a)*r;if(Math.abs(z+144)<9)continue;cactus(x,z,2.5+i%4)}
 for(let i=0;i<7;i++){const x=820+i*15,z=-215;box(x,6+i%3,z,12,7+i%3*2,9,'#ce9560')}
 sign('CACTUS CROSSING',802,9,-144,'#ffe2a1',-Math.PI/2,23);
 sign('R: BACK TO THE FORK · TRY EVERY ROUTE',833,8,-144,'#ffe2a1',Math.PI/2,25);
 group.updateMatrixWorld(true);
 const batches=new Map();for(const m of [...group.children])if(m.isMesh&&m.geometry===geo){if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(m)}
 for(const [mat,meshes] of batches){const inst=new T.InstancedMesh(geo,mat,meshes.length);meshes.forEach((m,i)=>{inst.setMatrixAt(i,m.matrix);group.remove(m)});inst.castShadow=inst.receiveShadow=true;group.add(inst)}
 let current=null,selected=0,stage=0,distance=0,lane=0,boosted=new Set(),trips=0,completed=new Set(),invertedTracks=new Set();
 const track=()=>routes[stage===0?0:stage===1?selected+1:4];
 const oldGround=world.getGroundHeight,oldWalkway=world.isWaterWalkway,oldDistrict=world.districtAt;
 const bins=new Map(),key=(x,z)=>Math.floor(x/16)+','+Math.floor(z/16);
 for(const r of routes)for(const f of r.frames)for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++){const k=key(f.p.x+ix*16,f.p.z+iz*16);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(f)}
 function deck(x,z,margin=0){let best=null,d=Math.max(0,5.7-margin)**2;for(const f of bins.get(key(x,z))||[]){const q=(f.p.x-x)**2+(f.p.z-z)**2;if(q<d){d=q;best=f.p.y}}return best}
 world.getGroundHeight=(x,z)=>desertContains(x,z)?desert.height:deck(x,z)??oldGround(x,z);
 world.isWaterWalkway=(x,z,r)=>desertContains(x,z,r)||deck(x,z)!==null||oldWalkway(x,z,r);
 world.districtAt=(x,z)=>desertContains(x,z)?'CACTUS CROSSING':x>175&&deck(x,z)!==null?'OCEAN STUNT ROADS':oldDistrict(x,z);
 function reset(){if(current){current.stunt=false;delete current.y;current.g.rotation.set(0,current.a,0)}current=null;stage=0;distance=lane=0;boosted.clear();world.camera.up.set(0,1,0)}
 function start(c,atFork=false){reset();current=c;current.stunt=true;stage=atFork?1:0;distance=0;current.speed=0;current.slip=0;notify(atFork?'CHOOSE A TRACK · 1 SLALOM · 2 LOOP · 3 CORKSCREW':'OCEAN RUN · W GO · S BRAKE · 1/2/3 CHOOSE TRACK');sync();camera(1)}
 function choose(index){if(current&&(stage===0||(stage===1&&distance<1))&&index>=0&&index<3){selected=index;notify(routeNames[selected].toUpperCase()+' SELECTED')}}
 function release(c){current=null;c.stunt=false;delete c.y;c.g.rotation.set(0,c.a,0);world.camera.up.set(0,1,0)}
 function update(c,dt,keys){
  if(!current){if(c&&!c.spec.special&&Math.hypot(c.x-164,c.z+144)<7&&c.speed>1&&-Math.sin(c.a)>.6)start(c);return false}
  if(c!==current){reset();return false}
  if(!dt)return true;
  const accel=Number(Boolean(keys.KeyW||keys.ArrowUp)),brake=Number(Boolean(keys.KeyS||keys.ArrowDown||keys.Space));
  c.speed=T.MathUtils.clamp(c.speed+(accel?16:0)*dt-(brake?29:1.2)*dt,0,42);
  lane=T.MathUtils.clamp(lane+((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0))*dt*3,-3.6,3.6);
  for(const wheel of c.wheels||[])wheel.rotation.x-=c.speed*dt/.45;
  distance+=c.speed*dt;
  const road=track();
  if(stage===1&&selected===0)for(const t of [.22,.63])if(distance>=road.length*t&&!boosted.has(t)){boosted.add(t);c.speed=Math.min(48,c.speed+10);notify('TIDAL BOOST!')}
  if(distance>=road.length){
   distance-=road.length;stage++;
   if(stage===1){boosted.clear();notify(routeNames[selected].toUpperCase()+' · MAGNETIC GRIP ACTIVE')}
   if(stage===2){completed.add(selected);notify('TRACK COMPLETE · NEXT STOP: CACTUS CROSSING')}
   if(stage>2){c.x=810;c.z=-144;c.a=-Math.PI/2;c.speed=0;release(c);trips++;notify('WELCOME TO CACTUS CROSSING · E TO EXPLORE · R TO RIDE AGAIN');return true}
  }
  if(stage===1&&track().at(distance).up.y<-.5)invertedTracks.add(selected);
  sync();return true;
 }
 function sync(){if(!current)return;const f=track().at(distance);current.x=f.p.x+f.right.x*lane;current.z=f.p.z+f.right.z*lane;current.y=f.p.y+f.right.y*lane;current.a=Math.atan2(-f.forward.x,-f.forward.z);current.g.position.copy(f.p).addScaledVector(f.right,lane);current.g.quaternion.copy(f.q)}
 function camera(dt){
  if(!current||dt<=0)return;
  sync();const f=track().at(distance),aim=current.g.position.clone().addScaledVector(f.up,1.2).addScaledVector(f.forward,5);
  const eye=current.g.position.clone().addScaledVector(f.forward,-12).addScaledVector(f.up,5.2);
  world.camera.position.lerp(eye,1-Math.exp(-7*Math.max(dt,.001)));world.camera.up.copy(f.up);world.camera.lookAt(aim);world.camera.fov=64;world.camera.updateProjectionMatrix();
 }
 function drawMap(ctx,tx,tz,scale){
  ctx.fillStyle='#e6b96f';ctx.beginPath();ctx.ellipse(tx(860),tz(-144),desert.radius*1.1*scale,desert.radius*scale,0,0,Math.PI*2);ctx.fill();
  for(const r of routes){ctx.strokeStyle=r.color;ctx.lineWidth=5*scale;ctx.beginPath();r.frames.forEach((f,i)=>i?ctx.lineTo(tx(f.p.x),tz(f.p.z)):ctx.moveTo(tx(f.p.x),tz(f.p.z)));ctx.stroke()}
 }
 return {routes,start,reset,update,sync,camera,choose,drawMap,contains:(x,z,r=0)=>desertContains(x,z,r)||deck(x,z,r)!==null,
  get active(){return Boolean(current)},recover(c){if(c&&(current||desertContains(c.x,c.z))){start(c);distance=routes[0].length-22;sync();return true}return false},
  state:()=>({active:Boolean(current),route:track().name,selected:routeNames[selected],stage,distance,length:track().length,lane,trips,completed:[...completed].map(i=>routeNames[i]),invertedTracks:[...invertedTracks].map(i=>routeNames[i]),inverted:Boolean(current&&track().at(distance).up.y<0)})};
}

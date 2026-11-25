import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const corner = {x:12.4,z:-85.5};
export const crossing = {x:14,z:-96};

function cartSign() {
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=144;
  const g=canvas.getContext('2d');
  g.fillStyle='#631f1b';g.fillRect(0,0,512,144);
  g.strokeStyle='#ffcf75';g.lineWidth=5;g.strokeRect(6,6,500,132);
  g.fillStyle='#ffd481';g.font='bold 23px sans-serif';g.textAlign='center';
  g.fillText('L A S T   O R D E R',256,38);
  g.fillStyle='#fff3ce';g.font='900 81px sans-serif';g.fillText('HOT DOGS',256,115);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map,side:T.DoubleSide});
}

export function makeCart(scene, height) {
  const pieces=[];
  const paint=new T.Color(), transform=new T.Object3D();
  function add(shape,color,x,y,z,rx=0,ry=0,rz=0) {
    const geo=shape.index?shape.toNonIndexed():shape;
    if(geo!==shape)shape.dispose();
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.updateMatrix();
    geo.applyMatrix4(transform.matrix);geo.deleteAttribute('uv');
    const count=geo.attributes.position.count, colors=new Float32Array(count*3);
    paint.set(color);
    for(let i=0;i<count;i++)paint.toArray(colors,i*3);
    geo.setAttribute('color',new T.BufferAttribute(colors,3));pieces.push(geo);
  }
  const box=(x,y,z,w,h,d,color)=>add(new T.BoxGeometry(w,h,d),color,x,y,z);
  const tube=(x,y,z,r,h,color,rx=0,rz=0)=>add(new T.CylinderGeometry(r,r,h,12),color,x,y,z,rx,0,rz);
  const red='#bc3a29',cream='#ffe4a1',steel='#abb7ad';
  box(0,.72,0,2.35,.76,.96,red);
  box(0,1.13,0,2.52,.12,1.07,steel);
  box(0,.56,.502,2.28,.07,.018,cream);
  for(const x of [-.88,.88])for(const z of [-.5,.5]){
    tube(x,.33,z,.29,.12,'#293238',Math.PI/2);
    tube(x,.33,z*1.14,.12,.02,steel,Math.PI/2);
  }
  for(const x of [-1,1])tube(x,1.75,-.32,.035,1.38,steel);
  for(let i=0;i<9;i++) {
    const x=(i-4)*.33, color=i%2?cream:red;
    for(const side of [-1,1])
      add(new T.BoxGeometry(.335,.055,.86),color,x,2.48,side*.39,side*.21);
    box(x,2.29,.81,.33,.20,.05,color);
    tube(x,2.20,.81,.163,.045,color,Math.PI/2);
  }
  // An oversized bun-and-sausage roof sign reads from a moving car.
  function oval(x,y,z,w,h,d,color) {
    add(new T.SphereGeometry(1,18,9).scale(w,h,d),color,x,y,z);
  }
  for(const side of [-1,1])oval(0,2.81,side*.17,1.10,.18,.18,'#e8a34b');
  oval(0,2.93,0,1.18,.16,.16,'#a93b22');
  for(let i=0;i<8;i++){
    const x=-.68+i*.19,angle=(i%2?1:-1)*.62;
    add(new T.BoxGeometry(.245,.039,.046),'#ffcf3d',x,3.084,0,0,angle);
  }
  box(-.35,1.23,.02,1.04,.10,.63,'#384541');
  for(let i=0;i<5;i++)tube(-.73+i*.18,1.31,.03,.062,.46,'#ae4c22',Math.PI/2);
  for(const [x,color] of [[.48,'#c82319'],[.67,'#f6be2a']]){
    tube(x,1.36,.15,.07,.33,color);tube(x,1.57,.15,.029,.09,cream);
  }
  box(.94,1.29,-.06,.24,.23,.30,'#e7cc91');
  const geo=mergeGeometries(pieces);
  pieces.forEach(p=>p.dispose());
  const root=new T.Group();
  root.position.set(corner.x,height,corner.z);
  const body=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.72}));
  body.castShadow=body.receiveShadow=true;root.add(body);
  const sign=cartSign();
  for(const [x,y,z,w,h,yaw] of [[0,.85,.5,2.15,.58,0],[-1.19,1.81,-.29,1.09,.36,-Math.PI/2]]){
    const panel=new T.Mesh(new T.PlaneGeometry(w,h),sign);
    panel.position.set(x,y,z);panel.rotation.y=yaw;root.add(panel);
  }
  scene.add(root);
  return root;
}

// Stripes mark the side street. The northbound getaway lane stays open.
export function makeCrosswalk(scene) {
  const stripes=[];
  for(let i=-7;i<=7;i+=2)stripes.push(new T.BoxGeometry(2.8,.014,.82).translate(crossing.x,.092,crossing.z+i));
  const geo=mergeGeometries(stripes);stripes.forEach(g=>g.dispose());
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:'#d5ceb0',roughness:1}));
  scene.add(mesh);return mesh;
}

export function dressVendor(npc) {
  const cloth=new T.MeshStandardMaterial({color:'#e9bf7d'}),wood=new T.MeshStandardMaterial({color:'#a55f2b'});
  const head=new T.Mesh(new T.CylinderGeometry(.225,.195,.46,14),wood);
  head.position.y=.235;npc.rig.neck.add(head);
  for(const x of [-.083,.083]){
    const eye=new T.Mesh(new T.SphereGeometry(.049,8,6),cloth);
    eye.position.set(x,.255,-.196);npc.rig.neck.add(eye);
    const pupil=new T.Mesh(new T.SphereGeometry(.023,8,6),new T.MeshBasicMaterial({color:'#34241a'}));
    pupil.position.set(x,.253,-.238);npc.rig.neck.add(pupil);
  }
  const apron=new T.Mesh(new T.BoxGeometry(.41,.54,.035),cloth);
  apron.position.set(0,.22,-.168);npc.rig.torso.add(apron);
}

export function servingTray(npc) {
  const tray=new T.Group();
  const paper=new T.Mesh(new T.BoxGeometry(.24,.028,.13),new T.MeshStandardMaterial({color:'#fff2c5'}));
  const bun=new T.Mesh(new T.CapsuleGeometry(.044,.12,2,8),new T.MeshStandardMaterial({color:'#e5a452'}));
  const sausage=new T.Mesh(new T.CapsuleGeometry(.024,.16,2,8),new T.MeshStandardMaterial({color:'#ad4324'}));
  bun.rotation.z=sausage.rotation.z=Math.PI/2;bun.position.y=.033;sausage.position.y=.062;
  tray.add(paper,bun,sausage);tray.position.set(0,-.30,-.045);
  npc.rig.elbows[1].add(tray);tray.visible=false;return tray;
}

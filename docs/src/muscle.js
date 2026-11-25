import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function buildMuscleCar() {
  const root=new T.Group(), wheels=[];
  const metal=(c,m=0)=>new T.MeshStandardMaterial({color:c,metalness:m,roughness:m?.28:.62,side:T.DoubleSide});
  const paint=metal(0x70243b,.62),chrome=metal(0xc3c9c5,.9),black=metal(0x191a1b),glass=metal(0x284251,.45);
  function add(geo,mat,x,y,z,parent=root){
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);m.castShadow=m.receiveShadow=true;return m;
  }
  function box(w,h,d,mat,x,y,z,r=.025){
    return add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,h/3,d/3)),mat,x,y,z);
  }
  // Sweep paired door sills and shoulder creases from the nose to the tail.
  function shell(stations,mat) {
    const pos=[],idx=[];
    for(const [z,bottom,top,width,roof] of stations)pos.push(-width,bottom,z,width,bottom,z,roof,top,z,-roof,top,z);
    for(let k=0;k<stations.length-1;k++)for(let j=0;j<4;j++){
      const a=4*k+j,b=4*k+(j+1)%4;idx.push(a,b,a+4,b,b+4,a+4);
    }
    idx.push(0,2,1,0,3,2);const n=stations.length*4-4;idx.push(n,n+1,n+2,n,n+2,n+3);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();add(g,mat,0,0,0);
  }
  shell([[-2.35,.45,.82,.86,.88],[-1.85,.40,.98,.96,.94],[-.59,.43,1.01,.97,.91],[.48,.43,1,.99,.91],[1.35,.44,1.04,.99,.92],[2.32,.48,.87,.87,.89]],paint);
  shell([[-.7,.99,1.02,.85,.84],[-.10,.99,1.44,.88,.72],[.56,.98,1.44,.88,.72],[1.38,.96,1.01,.85,.82]],glass);
  box(1.48,.065,.74,paint,0,1.45,.23);
  for(const side of [-1,1]){
    box(.08,.40,.07,chrome,side*.80,1.21,.39);
    box(.12,.03,1.31,black,side*.24,.996,-1.31);
    box(.08,.095,.22,chrome,side*.94,1.03,-.37);
    for(const z of [-1.45,1.42]){
      const wheel=new T.Group();wheel.position.set(side*.92,.40,z);root.add(wheel);
      const tire=add(new T.CylinderGeometry(.394,.394,.22,32),black,0,0,0,wheel);tire.rotation.z=Math.PI/2;
      const hub=add(new T.CylinderGeometry(.255,.255,.05,30),chrome,side*.12,0,0,wheel);hub.rotation.z=Math.PI/2;
      for(let j=0;j<5;j++){
        const angle=j*Math.PI*2/5;
        const hole=add(new T.SphereGeometry(.058,10,6),black,side*.147,Math.sin(angle)*.15,Math.cos(angle)*.15,wheel);hole.scale.x=.24;
      }
      wheels.push(wheel);
    }
  }
  box(1.75,.19,.08,black,0,.72,-2.34);
  for(let i=-6;i<=6;i++)box(.012,.13,.018,chrome,i*.069,.72,-2.39);
  for(const x of [-.76,-.55,.55,.76]){
    const lamp=add(new T.CylinderGeometry(.087,.087,.045,18),metal(0xffe5ae,.3),x,.75,-2.39);
    lamp.rotation.x=Math.PI/2;
  }
  box(1.82,.09,.14,chrome,0,.52,-2.34);
  box(1.82,.09,.14,chrome,0,.54,2.32);
  for(const x of [-.64,.64])box(.38,.10,.052,metal(0xb12026),x,.77,2.335);
  box(.48,.11,.39,black,0,1.027,-1.12);
  return {root,wheels};
}

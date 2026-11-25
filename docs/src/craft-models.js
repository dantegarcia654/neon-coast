import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const paint=(color,metalness=.18,roughness=.42)=>new T.MeshStandardMaterial({color,metalness,roughness});
const white=paint('#f0e7cf'),navy=paint('#16364b'),steel=paint('#bec8c5',.68,.29),tyre=paint('#212729',.02,.9),seat=paint('#43372d',.03,.78);
const glass=new T.MeshPhysicalMaterial({color:'#a1d6d8',transparent:true,opacity:.36,roughness:.16,metalness:.16,side:T.DoubleSide,depthWrite:false});
const lamp=color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.7});
const red=lamp('#fa5848'),green=lamp('#54eab2'),blue=lamp('#468bff'),ivory=lamp('#ffe8ac');
function part(g,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m}
function box(g,w,h,d,m,x,y,z,r=.04){return part(g,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),m,x,y,z)}
function oval(g,x,y,z,rx,ry,rz,m){const o=part(g,new T.SphereGeometry(1,20,12),m,x,y,z);o.scale.set(rx,ry,rz);return o}
function rod(g,a,b,r,m){
  const p=new T.Vector3(...a),v=new T.Vector3(...b).sub(p),mid=p.addScaledVector(v,.5);
  const o=part(g,new T.CylinderGeometry(r,r,v.length(),10),m,mid.x,mid.y,mid.z);
  o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;
}
function panel(g,coords,m){const v=coords.flat(),geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return part(g,geo,m)}
function tyreWheel(g,x,y,z,r,width,quad){
  const wheel=new T.Group();g.add(wheel);wheel.position.set(x,y,z);
  const drum=(radius,length,mat)=>{const o=part(wheel,new T.CylinderGeometry(radius,radius,length,24),mat);o.rotation.z=Math.PI/2};
  drum(r,width,tyre);drum(r*.62,width+.015,steel);drum(r*.36,width+.023,navy);
  if(quad)for(let i=0;i<12;i++){const a=i*Math.PI/6;box(wheel,width+.015,.043,.13,tyre,0,r*Math.cos(a),r*Math.sin(a),.009).rotation.x=a}
  return wheel;
}
function lettering(g,text,size,x,y,z,side){
  const c=document.createElement('canvas');c.width=512;c.height=96;const cx=c.getContext('2d');
  cx.fillStyle='#f6f0d9';cx.font='italic bold 70px sans-serif';cx.textAlign='center';cx.fillText(text,256,76,492);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  const m=part(g,new T.PlaneGeometry(size,size*96/512),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),x,y,z);
  m.rotation.y=side*Math.PI/2;
}
function chair(g,x,y,z){
  box(g,.52,.12,.54,seat,x,y,z,.05);box(g,.52,.5,.11,seat,x,y+.22,z+.22,.05).rotation.x=-.13;
}
function boat(g,police){
  const accent=police?navy:paint('#cc4c32');
  // Chine, sheer line and keel converge at the bow. A recessed well breaks the deck silhouette.
  const stations=[[-3.65,.035,.8],[-2.95,.67,.72],[-1.65,1.03,.63],[.45,1.14,.58],[2.82,1.02,.55],[3.03,.87,.55]];
  const bands=[white,accent,white];bands.forEach(m=>m.side=T.DoubleSide);
  const section=([z,w,h])=>[[-w,h,z],[-w*.98,h-.12,z],[-w*.73,h-.46,z],[0,-.27,z],[w*.73,h-.46,z],[w*.98,h-.12,z],[w,h,z]];
  for(let i=1;i<stations.length;i++){
    const a=section(stations[i-1]),b=section(stations[i]);
    for(let j=0;j<6;j++)panel(g,[a[j],b[j],b[j+1],a[j+1]],bands[Math.min(j,5-j)]);
    if(i<=2||i===5)panel(g,[a[0],a[6],b[6],b[0]],white);
  }
  const back=section(stations.at(-1));panel(g,[back[0],back[6],back[4],back[2]],accent);
  box(g,1.89,.15,3.65,paint('#b5885f'),0,.26,.65);
  for(const s of [-1,1]){
    box(g,.16,.22,3.9,white,s*1.015,.53,.52);
    for(let i=1;i<4;i++){const [z,w,h]=stations[i];rod(g,[s*w,h,z],[s*w,h+.20,z],.021,steel);const [z0,w0,h0]=stations[i-1];rod(g,[s*w0,h0+.20,z0],[s*w,h+.20,z],.027,steel)}
    oval(g,s*1.01,.69,-1.33,.061,.041,.08,s<0?red:green);
    rod(g,[s*.86,.56,-.96],[s*.73,1.2,-.58],.035,steel);
    rod(g,[s*.73,1.2,-.58],[s*.86,.65,-.13],.028,steel);
    lettering(g,police?'MARINE PATROL':'SOLSTICE',1.47,s*1.042,.47,1.7,s);
  }
  panel(g,[[-.86,.56,-.96],[.86,.56,-.96],[.73,1.2,-.58],[-.73,1.2,-.58]],glass);
  rod(g,[-.73,1.2,-.58],[.73,1.2,-.58],.031,steel);
  chair(g,-.43,.52,.32);chair(g,.43,.52,.32);box(g,1.6,.25,.48,white,0,.53,1.88);
  box(g,1.52,.19,.36,navy,0,.8,-.55);const helm=part(g,new T.TorusGeometry(.16,.026,8,20),tyre,-.43,.86,-.33);helm.rotation.x=-.22;
  for(const x of [-.41,.41]){box(g,.39,.6,.45,navy,x,.32,3.06);box(g,.1,.45,.12,steel,x,-.12,3.15);oval(g,x,-.30,3.17,.19,.05,.05,tyre)}
  if(police){for(const x of [-.88,.88])rod(g,[x,.57,1.75],[x,1.75,1.45],.05,steel);box(g,1.89,.10,.29,navy,0,1.77,1.45);box(g,.45,.1,.18,red,-.32,1.87,1.45);box(g,.45,.1,.18,blue,.32,1.87,1.45)}
}
function dashboard(g,w,y,z){
  box(g,w,.23,.22,navy,0,y,z);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#1a272a';ctx.fillRect(0,0,512,128);
  for(let i=0;i<5;i++){
    const x=55+i*100,y=62;ctx.strokeStyle='#a4b3aa';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,43,0,2*Math.PI);ctx.stroke();
    for(let j=0;j<11;j++){const a=.7*Math.PI+j*.16*Math.PI;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*31,y+Math.sin(a)*31);ctx.lineTo(x+Math.cos(a)*37,y+Math.sin(a)*37);ctx.stroke()}
    ctx.strokeStyle='#efab65';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+26*Math.sin(i*1.7),y-21*Math.cos(i*1.7));ctx.stroke();
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  part(g,new T.PlaneGeometry(w*.96,.21),new T.MeshBasicMaterial({map}),0,y,z+.116);
}
function aircraft(g,heli,police,rotors){
  const enamel=police?navy:paint(heli?'#196d70':'#db9038'),trim=police?white:paint('#ede0b8');
  if(heli){
    oval(g,0,1.20,.1,.91,.83,1.49,enamel);oval(g,0,1.16,-.94,.82,.68,.87,glass);
    oval(g,0,.81,-.77,.85,.37,1.03,enamel);
    oval(g,0,.65,-.93,.70,.25,.82,enamel);
    const boom=part(g,new T.ConeGeometry(.45,3.9,14),enamel,0,1.35,2.64);boom.rotation.x=Math.PI/2-.12;
    box(g,.1,.93,.61,trim,0,1.89,4.43).rotation.x=.28;box(g,1.36,.10,.42,trim,0,1.56,3.55);
    oval(g,0,1.98,.27,.54,.37,.95,enamel);
    for(const side of [-1,1]){
      rod(g,[side*.64,.95,-.7],[side*.77,1.76,-.57],.045,trim);rod(g,[side*.77,1.76,-.57],[side*.47,1.68,-1.48],.041,trim);
      box(g,.11,.10,2.72,steel,side*.84,.12,.05);rod(g,[side*.84,.12,-1.3],[side*.81,.25,-1.55],.052,steel);
      for(const z of [-.70,.85])rod(g,[side*.55,.72,z],[side*.84,.15,z],.045,steel);
      lettering(g,police?'AIR PATROL':'COAST AIR',1.12,side*.902,1.12,.1,side);
    }
    rod(g,[0,2.0,0],[0,2.6,0],.085,steel);
    const main=new T.Group();main.position.y=2.57;g.add(main);
    for(let i=0;i<3;i++){const pivot=new T.Group();main.add(pivot);pivot.rotation.y=i*Math.PI*2/3;box(pivot,.2,.045,3.45,tyre,0,0,-1.86);box(pivot,.2,.048,.22,trim,0,0,-3.42)}
    const tail=new T.Group();tail.position.set(.16,1.76,4.40);g.add(tail);box(tail,.05,1.07,.12,tyre,0,0,0);box(tail,.05,.12,1.07,tyre,0,0,0);
    rotors.push([main,'y'],[tail,'x']);dashboard(g,1.12,1.13,-1.43);
    if(police){box(g,.26,.15,.22,red,-.56,1.81,-.30);box(g,.26,.15,.22,blue,.56,1.81,-.30)}
  }else{
    oval(g,0,1.12,-.05,.69,.49,2.49,enamel);
    const aft=part(g,new T.ConeGeometry(.61,3.25,16),enamel,0,1.26,2.08);aft.rotation.x=Math.PI/2;
    oval(g,0,1.67,-.64,.63,.58,.98,glass);
    for(const s of [-1,1]){
      rod(g,[s*.60,1.36,-1.42],[s*.42,2.02,-1.08],.043,trim);
      rod(g,[s*.68,1.05,.32],[s*3.31,2.1,-.11],.05,steel);
      oval(g,s*1.08,.13,-.02,.31,.32,2.13,trim);
      for(const z of [-.74,.85])rod(g,[s*.45,.9,z],[s*1.08,.37,z],.056,steel);
      lettering(g,'NC · 72',1.15,s*.65,1.31,.4,s);
    }
    box(g,9.4,.16,1.23,trim,0,2.1,-.38,.079);box(g,3.17,.1,.73,trim,0,1.33,3.11);
    box(g,.11,1.25,.85,enamel,0,1.86,3.15).rotation.x=.28;
    for(const s of [-1,1]){box(g,.53,.168,1.17,enamel,s*4.31,2.10,-.38);oval(g,s*4.69,2.11,-.47,.065,.06,.12,s<0?red:green)}
    const prop=new T.Group();g.add(prop);prop.position.set(0,1.25,-2.53);
    box(prop,.14,2.05,.055,tyre,0,0,0);for(const s of [-1,1])box(prop,.14,.20,.067,trim,0,s*.91,0);
    oval(g,0,1.25,-2.49,.18,.18,.26,steel);rotors.push([prop,'z']);dashboard(g,.97,1.65,-1.22);
  }
}
function smallRide(g,quad,wheels){
  const color=paint(quad?'#bc642c':'#58aba6'),wax=paint('#eee9d8');
  if(quad){
    box(g,.84,.32,1.48,navy,0,.52,0);box(g,.78,.27,.88,color,0,.82,-.43);
    box(g,.49,.17,.74,seat,0,.91,.25);box(g,.87,.17,.44,color,0,.78,.85);
    for(const s of [-1,1]){
      for(const z of [-.7,.7]){wheels.push(tyreWheel(g,s*.59,.35,z,.36,.32,true));box(g,.35,.14,.67,color,s*.55,.70,z)}
      box(g,.27,.09,.76,tyre,s*.53,.39,0);box(g,.23,.14,.09,ivory,s*.31,.78,-.94);
      rod(g,[s*.42,.9,-.63],[s*.42,.9,-1.03],.028,steel);
    }
    for(const z of [-.64,-.82,-1.0])rod(g,[-.43,.9,z],[.43,.9,z],.028,steel);
  }else{
    for(const z of [-.64,.66])wheels.push(tyreWheel(g,0,.265,z,.262,.135,false));
    box(g,.43,.09,.76,tyre,0,.30,-.13);
    oval(g,0,.60,.44,.32,.31,.52,color);box(g,.46,.10,.67,seat,0,.87,.38);
    box(g,.46,.58,.16,color,0,.61,-.46,.07).rotation.x=-.23;
    oval(g,0,.45,-.63,.17,.11,.36,color);
    box(g,.23,.22,.20,color,0,1.12,-.55);oval(g,0,1.13,-.66,.089,.085,.027,ivory);
    oval(g,0,.67,.92,.115,.05,.03,red);box(g,.30,.12,.04,wax,0,.51,.91);
  }
  const h=quad?1.18:1.13,z=quad?-.44:-.52;
  rod(g,[0,.74,z],[0,h,z],.038,steel);
  for(const s of [-1,1]){rod(g,[0,h,z],[s*.34,h+.04,z+.09],.028,steel);box(g,.14,.055,.066,tyre,s*.33,h+.04,z+.09);
    if(!quad){rod(g,[s*.23,h,z],[s*.35,h+.22,z],.013,steel);oval(g,s*.35,h+.22,z,.078,.048,.025,steel)}}
}
export const craftSpecs=[
  {name:'Solstice Runabout',kind:'boat',length:6.8,power:10,limit:31,home:[225,-4.2,0],seat:[-.43,.56,.32],eye:[-.43,1.40,.26],port:[.78,.76,-.65],weapon:'Tralalero Splash',station:'East Pier'},
  {name:'Keys Floatplane',kind:'plane',length:6.5,power:10,limit:48,home:[237,5.6,Math.PI],seat:[-.23,1.15,-.53],eye:[-.23,1.89,-.69],port:[1.9,1.89,-.42],weapon:'Crocodilo Cannoli',station:'Seaplane Dock'},
  {name:'Heron Scout',kind:'heli',length:6.5,power:13,limit:34,home:[199,9,0],seat:[-.31,.93,-.63],eye:[-.34,1.55,-.96],port:[1.03,.68,-.36],weapon:'Crocodilo Cannoli',station:'Coast Helipad'},
  {name:'Lido 50 Scooter',kind:'scooter',length:1.95,power:11,limit:20,home:[9.6,-74,0],seat:[0,.88,.26],eye:[0,1.68,.10],port:[.27,.84,-.50],station:'Ocean Avenue'},
  {name:'Scrubrunner ATV',kind:'quad',length:2.2,power:15,limit:28,home:[163,-3.8,-Math.PI/2],seat:[0,.99,.24],eye:[0,1.76,.11],port:[.4,.86,-.63],station:'Ocean Avenue'},
].map(s=>({...s,special:true,paint:0x41767d,trim:0xead6af}));
export function makeCraft(scene,spec,police=false){
  const g=new T.Group(),rotors=[],wheels=[];scene.add(g);
  if(spec.kind==='boat')boat(g,police);
  else if(['plane','heli'].includes(spec.kind))aircraft(g,spec.kind==='heli',police,rotors);
  else smallRide(g,spec.kind==='quad',wheels);
  const [x,z,a]=spec.home;
  return {x,z,a,y:0,pitch:0,bank:0,speed:0,health:100,traffic:false,police,g,rotors,wheels,spec,model:spec.name};
}

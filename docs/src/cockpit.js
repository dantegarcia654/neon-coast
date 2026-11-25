import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const material = (color,metalness=0) => new T.MeshStandardMaterial({color,metalness,roughness:metalness ? .32 : .75});
const graphite = material(0x23272a), leather = material(0x36393b), rubber = material(0x17191b);
const aluminum = material(0x98a3a5,.7);
function mesh(parent,geometry,surface,x,y,z) {
  const piece = new T.Mesh(geometry,surface);
  piece.position.set(x,y,z); parent.add(piece); return piece;
}
function panel(parent,w,h,d,surface,x,y,z,r=.025) {
  return mesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),surface,x,y,z);
}
function rod(parent,a,b,r,surface) {
  const start=new T.Vector3(...a), end=new T.Vector3(...b), axis=end.clone().sub(start);
  const center=start.addScaledVector(axis,.5);
  const part=mesh(parent,new T.CylinderGeometry(r,r,axis.length(),10),surface,...center.toArray());
  part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());
}
function makeCluster(car,classic) {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=224;
  const ctx=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  let lastSpeed=-1,lastGear='';
  function draw(speed){
    const mph=Math.round(Math.abs(speed)*2.237),gear=speed<-.5?'R':mph<1?'N':String(Math.min(6,1+Math.floor(mph/19)));
    if(lastSpeed===mph && lastGear===gear)return;
    lastSpeed=mph;lastGear=gear;
    ctx.fillStyle='#11181a';ctx.fillRect(0,0,640,224);
    const accent=classic?'#f7cb86':'#95e8d2';
    function dial(x,label,value,max){
      const cy=124,r=90;
      ctx.strokeStyle='#536263';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,cy,r,Math.PI*.78,Math.PI*2.22);ctx.stroke();
      for(let i=0;i<=24;i++){
        const a=Math.PI*(.78+i/24*1.44),u=Math.cos(a),v=Math.sin(a);
        ctx.strokeStyle=i>19?'#e98b68':'#dee7dc';ctx.lineWidth=i%4===0?4:2;
        ctx.beginPath();ctx.moveTo(x+u*(r-4),cy+v*(r-4));ctx.lineTo(x+u*(r-(i%4===0?17:10)),cy+v*(r-(i%4===0?17:10)));ctx.stroke();
        if(i%4===0){ctx.fillStyle='#e7e7de';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(String(Math.round(max*i/24)),x+u*(r-31),cy+v*(r-31)+5)}
      }
      const angle=Math.PI*(.78+1.44*Math.min(1,value/max));
      ctx.strokeStyle='#ff764b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,cy);ctx.lineTo(x+Math.cos(angle)*64,cy+Math.sin(angle)*64);ctx.stroke();
      ctx.fillStyle='#e7e0cb';ctx.beginPath();ctx.arc(x,cy,7,0,Math.PI*2);ctx.fill();
      ctx.font='14px sans-serif';ctx.fillText(label,x,cy+36);
    }
    dial(117,'MPH',mph,120);dial(523,'RPM × 1000',mph?2+mph%19/5:.85,8);
    ctx.fillStyle=accent;ctx.textAlign='center';ctx.font='bold 63px sans-serif';ctx.fillText(String(mph),316,110);
    ctx.font='19px sans-serif';ctx.fillText('MPH   /   '+gear,316,140);
    ctx.font='15px sans-serif';ctx.fillStyle='#d9dfd9';ctx.fillText(car.toUpperCase(),320,190,245);
    texture.needsUpdate=true;
  }
  draw(0);return {draw,surface:new T.MeshBasicMaterial({map:texture,toneMapped:false})};
}

function buildCabin(spec,mirrorTexture){
  const root=new T.Group(),tall=['utility','truck'].includes(spec.kind);
  const classic=spec.kind==='classic'||spec.kind==='truck', height=tall?.34:0;
  const eye=new T.Vector3(-.38,1.26+height,.33);
  const paint=material(spec.paint,.48),accent=material(spec.trim,.3);
  // All coordinates are in vehicle space. The seat and controls shift together
  // between a low sports cockpit and an upright utility cab.
  const upper=new T.Group();upper.position.y=height;root.add(upper);
  const dash=panel(upper,1.94,.25,.48,graphite,0,.90,-.58,.08);
  dash.rotation.x=.05;
  panel(upper,1.88,.045,.06,accent,0,.87,-.322);
  const hood=panel(upper,1.76,.08,1.14,paint,0,.82,-1.49,.05);hood.rotation.x=-.055;
  for(const s of [-1,1]){
    rod(upper,[s*.98,.94,-.90],[s*.76,1.62,tall?-.7:-.34],tall?.052:.045,graphite);
    rod(upper,[s*.82,1.57,.79],[s*.91,.82,.75],.05,graphite);
    rod(upper,[s*.80,1.54,1.04],[s*.94,.87,1.53],.055,graphite);
    panel(upper,.11,.49,2.22,leather,s*.94,.64,.24,.04);
    panel(upper,.12,.055,1.88,accent,s*.88,.75,.20,.015);
    panel(upper,.13,.07,.31,aluminum,s*.85,.69,.04);
    panel(upper,.46,.18,.57,leather,s*.38,.41,.38,.07);
    panel(upper,.46,.55,.16,leather,s*.38,.68,.67,.07).rotation.x=-.13;
    panel(upper,.29,.19,.14,graphite,s*.38,1.03,.74,.06);
  }
  panel(upper,1.57,.08,tall?1.83:1.49,graphite,0,1.62,tall?.21:.37);
  panel(upper,1.65,.36,.26,leather,0,.70,1.18,.06);
  panel(root,1.82,.13,2.5,rubber,0,.32,.11);
  panel(upper,.24,.19,.87,graphite,0,.57,.04,.055);
  rod(upper,[0,.65,-.12],[0,.77,-.17],.023,aluminum);
  panel(upper,.078,.068,.11,rubber,0,.79,-.17);
  const cluster=makeCluster(spec.name,classic);
  panel(upper,.58,.205,.14,graphite,-.38,1.033,-.395,.04);
  const screen=mesh(upper,new T.PlaneGeometry(.53,.186),cluster.surface,-.38,1.037,-.315);
  screen.rotation.x=-.08;
  let updateNavigation;
  if(tall){
    panel(upper,.36,.20,.10,graphite,.21,1.044,-.365);
    const info=document.createElement('canvas');info.width=384;info.height=160;
    const ctx=info.getContext('2d');
    const map=new T.CanvasTexture(info);map.colorSpace=T.SRGBColorSpace;
    updateNavigation=(radar,district)=>{
      const height=radar.width*(info.height-30)/info.width;
      ctx.drawImage(radar,0,(radar.height-height)/2,radar.width,height,0,30,info.width,info.height-30);
      ctx.fillStyle='#182227';ctx.fillRect(0,0,info.width,30);
      ctx.fillStyle='#e0ecd6';ctx.font='bold 19px sans-serif';ctx.fillText(district,12,22);
      map.needsUpdate=true;
    };
    mesh(upper,new T.PlaneGeometry(.32,.136),new T.MeshBasicMaterial({map,toneMapped:false}),.21,1.058,-.303);
    for(let i=0;i<5;i++)panel(upper,.035,.012,.016,aluminum,.10+i*.052,.947,-.433);
  }
  for(const x of tall?[-.81,.76]:[-.78,.13,.37,.71]){
    panel(upper,.14,.068,.035,rubber,x,.916,-.318);
    for(let i=0;i<3;i++)panel(upper,.114,.006,.014,aluminum,x,.897+i*.018,-.293,.002);
  }
  const wheel=new T.Group();upper.add(wheel);wheel.position.set(-.38,.866,-.18);wheel.rotation.x=-.22;
  const rotor=new T.Group();wheel.add(rotor);
  mesh(rotor,new T.TorusGeometry(.19,.024,12,64),classic?accent:rubber,0,0,0);
  for (const [x,y] of [[-.17,.016],[.17,.016],[0,-.17]])rod(rotor,[0,0,.003],[x,y,0],.021,aluminum);
  panel(rotor,.14,.091,.046,leather,0,0,.025,.028);
  // Leather driving gloves stay attached to the two grip points as the wheel turns.
  for(const s of [-1,1]){
    const palm=mesh(rotor,new T.SphereGeometry(1,14,10),leather,s*.173,.052,.017);
    palm.scale.set(.035,.057,.036);palm.rotation.z=-s*.32;
    rod(rotor,[s*.181,.031,.035],[s*.22,-.145,.19],.035,graphite);
    for(let f=0;f<3;f++)panel(rotor,.044,.014,.023,graphite,s*.175,.031+f*.018,.039,.006);
  }
  rod(upper,[0,1.55,-.68],[0,1.45,-.60],.014,graphite);
  panel(upper,.324,.097,.034,graphite,0,1.434,-.61);
  const mirror=mesh(upper,new T.PlaneGeometry(.299,.076),new T.MeshBasicMaterial({map:mirrorTexture,toneMapped:false}),0,1.434,-.588);
  const uv=mirror.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
  return {root,eye,rotor,cluster,updateNavigation};
}

export function createCockpit(scene,renderer,camera) {
  const buffer=new T.WebGLRenderTarget(320,96);
  const rear=new T.PerspectiveCamera(36,320/96,.1,camera.far);
  const cabins=new Map(),head=new T.Euler(0,0,0,'YXZ'),offset=new T.Vector3(),turn=new T.Quaternion();
  let current=null,cabin=null,lastMirror=-1;
  function leave() {
    if(!current)return;
    current.g.visible=true;cabin.root.visible=false;current=null;
  }
  function render(car,dt,time,steering,headYaw,headPitch,radar,district){
    if(current!==car){
      leave();current=car;
      if(!cabins.has(car.spec.name))cabins.set(car.spec.name,buildCabin(car.spec,buffer.texture));
      cabin=cabins.get(car.spec.name);scene.add(cabin.root);cabin.root.visible=true;car.g.visible=false;lastMirror=-1;
    }
    cabin.root.position.copy(car.g.position);cabin.root.quaternion.copy(car.g.quaternion);
    camera.position.copy(cabin.eye).applyQuaternion(car.g.quaternion).add(car.g.position);
    camera.quaternion.copy(car.g.quaternion).multiply(turn.setFromEuler(head.set(-.105+headPitch,headYaw,0,'YXZ')));
    camera.fov=70;camera.updateProjectionMatrix();
    cabin.rotor.rotation.z=T.MathUtils.damp(cabin.rotor.rotation.z,steering*.68,12,dt);
    cabin.cluster.draw(car.speed);
    if(lastMirror<0 || time-lastMirror>=.125){
      cabin.updateNavigation?.(radar,district);
      rear.position.copy(offset.set(0,cabin.eye.y,1.8)).applyQuaternion(car.g.quaternion).add(car.g.position);
      rear.quaternion.copy(car.g.quaternion).multiply(turn.setFromAxisAngle(T.Object3D.DEFAULT_UP,Math.PI));
      cabin.root.visible=false;
      const previous=renderer.getRenderTarget(), shadows=renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(buffer);renderer.render(scene,rear);
      renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadows;cabin.root.visible=true;
      lastMirror=time;
    }
  }
  return {render,leave,get name(){return current?.spec.name||null}};
}

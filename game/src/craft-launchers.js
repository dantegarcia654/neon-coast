import * as T from 'three';

const paint=color=>new T.MeshStandardMaterial({color,roughness:.48,metalness:.12});
const sea=paint('#43758c'),foam=paint('#eee0c4'),sole=paint('#305dcc'),green=paint('#668849'),olive=paint('#3b603d'),brown=paint('#bc7842'),choc=paint('#4c3628'),eye=paint('#201d20');
const ball=new T.SphereGeometry(1,16,10),spike=new T.ConeGeometry(1,1,6);
function oval(g,x,y,z,rx,ry,rz,m){const o=new T.Mesh(ball,m);o.scale.set(rx,ry,rz);o.position.set(x,y,z);g.add(o);return o}
function fin(g,x,y,z,w,h,d,m){const o=new T.Mesh(spike,m);o.position.set(x,y,z);o.scale.set(w,h,d);g.add(o);return o}
export function craftLauncher(shark){
  const model=new T.Group(),ammo=new T.Group(),load=new T.Group();
  const skin=shark?sea:green;
  oval(model,0,.12,0,.20,.17,.47,skin);
  oval(model,0,.085,-.37,.19,shark?.14:.075,.26,shark?foam:olive);
  oval(model,0,.13,-.578,.123,.082,.028,eye);
  for(const s of [-1,1]){
    oval(model,s*.13,.235,-.255,.065,.064,.068,foam);oval(model,s*.158,.24,-.292,.029,.039,.023,eye);
    if(shark){
      oval(model,s*.205,-.005,.02,.094,.071,.166,sole);
      oval(model,s*.205,-.052,.014,.10,.027,.172,foam);
      for(const z of [-.05,0,.05])oval(model,s*.207,.055,z,.051,.012,.009,foam);
    }else{
      oval(model,s*.29,.10,.105,.31,.034,.11,olive);
      for(let n=0;n<4;n++)fin(model,s*.142,.084,-.47+n*.065,.017,.057,.016,foam).rotation.z=Math.PI;
    }
  }
  fin(model,0,.33,.12,.065,.31,.13,skin).rotation.x=.36;
  if(shark){
    oval(ammo,0,0,0,.108,.105,.28,sea);fin(ammo,0,.123,.045,.034,.126,.059,sea);
    for(const s of [-1,1])oval(ammo,s*.105,-.06,0,.064,.04,.12,sole);
  }else{
    const shell=new T.Mesh(new T.CylinderGeometry(.083,.087,.40,18),brown);shell.rotation.x=Math.PI/2;ammo.add(shell);
    for(const s of [-1,1]){
      oval(ammo,0,0,s*.204,.07,.07,.029,foam);
      for(let n=0;n<4;n++)oval(ammo,Math.cos(n*1.6)*.044,Math.sin(n*1.6)*.043,s*.225,.015,.014,.012,choc);
    }
  }
  load.add(ammo.clone(true));load.position.set(0,.246,-.12);model.add(load);
  return {model,load,mouth:new T.Vector3(0,.13,-.64),ammo};
}

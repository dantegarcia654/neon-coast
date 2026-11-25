import {rosterLoader,loadGLB} from './roster-loader.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildMuscleCar} from './muscle.js';
import {fleet} from './fleet.js';

export function installVehicleModels(cars) {
  const loader = new GLTFLoader();
  const errors=new Set(), models=new Map(), shells=new Map();
  for(const car of cars){
    const shell=new THREE.Group();
    shell.add(...[...car.g.children]);car.g.add(shell);shells.set(car,shell);
  }
  const available = new Map();
  const curb = {x:5,z:9};
  let staged = cars[0];
  for (const [i, spec] of fleet.entries()) {
    const parked = cars[spec.slots[0]];
    Object.assign(parked,{x:curb.x,z:i===0 ? curb.z : 22+(i-1)*6.2,a:0,speed:0,traffic:false});
    if (!spec.file) available.set(spec.name,parked);
  }
  function install(c,spec) {
    if(c.wrecked || c.visualSpec===spec || !models.has(spec.name))return;
    const {holder,height}=models.get(spec.name);
    const shell=shells.get(c);shell.clear();shell.add(holder.clone(true));
    Object.assign(c,{visualSpec:spec,wheels:[],roofHeight:height});
    if(c.driver)c.driver.seat.position.y=height*.62;
  }
  const requests=rosterLoader(async (name,signal)=>{
      const spec=fleet.find(s=>s.name===name);
      const {scene:template}=await loadGLB(loader,'./assets/vehicles/'+spec.file+'.glb',signal);
      const bounds = new THREE.Box3().setFromObject(template);
      const size = bounds.getSize(new THREE.Vector3());
      const holder = new THREE.Group();
      holder.add(template);
      if (size.x > size.z) holder.rotation.y = Math.PI/2;
      holder.rotation.y += spec.flip ? Math.PI : 0;
      holder.scale.setScalar(spec.length / Math.max(size.x,size.z));
      holder.updateMatrixWorld(true);
      bounds.setFromObject(holder);
      const center = bounds.getCenter(new THREE.Vector3());
      holder.position.set(-center.x,-bounds.min.y,-center.z);
      holder.traverse(node => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
      });
      models.set(name,{holder,height:bounds.max.y-bounds.min.y});
      for(const index of spec.slots) install(cars[index],spec);
      available.set(name,cars[spec.slots[0]]);
      errors.delete(name);
  });
  const sedan=fleet.at(-1);
  for(const c of cars)c.spec=sedan;
  for(const spec of fleet){
    for(const index of spec.slots){
      const c=cars[index];
      Object.assign(c,{spec,model:spec.name});
      if(spec.file || spec===sedan)continue;
      const model=buildMuscleCar(),shell=shells.get(c);
      shell.clear();shell.add(model.root);
      Object.assign(c,{wheels:model.wheels,roofHeight:new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).y});
    }
  }
  async function ensure(name) {
    if(available.has(name))return;
    try {await requests.request(name)}
    catch(error){if(error.name!=="AbortError")errors.add(name);throw error}
  }
  function stage(name) {
    const next = available.get(name);
    if (!next) return false;
    const old = {x:next.x,z:next.z};
    Object.assign(next,curb);
    if (next !== staged) Object.assign(staged,old);
    staged = next;
    return true;
  }
  return {ensure,stage,prioritize:requests.prioritize,has:name=>available.has(name),
    get starter(){return staged},options:()=>fleet,
    restoreModels(){for(const spec of fleet)for(const i of spec.slots)install(cars[i],spec)},
    getState:()=>({ready:available.has(staged.spec.name),complete:available.size===fleet.length,
      loaded:[...available.keys()],errors:[...errors]})};
}

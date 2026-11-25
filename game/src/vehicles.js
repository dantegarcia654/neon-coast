import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildMuscleCar} from './muscle.js';
import {fleet} from './fleet.js';

export function installVehicleModels(cars) {
  const loader = new GLTFLoader();
  const state = {ready:false, loaded:[], errors:[]};
  const available = new Map();
  const curb = {x:5,z:9};
  let staged = cars[0];
  for (const [i, spec] of fleet.entries()) {
    const parked = cars[spec.slots[0]];
    Object.assign(parked,{x:curb.x,z:i===0 ? curb.z : 22+(i-1)*6.2,a:0,speed:0,traffic:false});
    if (!spec.file) available.set(spec.name,parked);
  }
  async function load(spec) {
    try {
      const {scene:template} = await loader.loadAsync('/assets/vehicles/'+spec.file+'.glb');
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
      for (const index of spec.slots) {
        const car = cars[index];
        car.g.clear();
        car.g.add(holder.clone(true));
        Object.assign(car,{model:spec.name,spec,wheels:[],roofHeight:bounds.max.y-bounds.min.y});
      }
      available.set(spec.name,cars[spec.slots[0]]);
      state.loaded.push(spec.name);
    } catch (error) {
      state.errors.push(spec.name);
      console.error('Could not load '+spec.name,error);
    }
  }
  const sedan = fleet.at(-1);
  for (const car of cars) car.spec = sedan;
  const muscle = fleet.find(spec=>spec.name==='Palmetto 440');
  for(const index of muscle.slots){
    const car=cars[index], model=buildMuscleCar();
    car.g.clear();car.g.add(model.root);
    Object.assign(car,{wheels:model.wheels,model:muscle.name,spec:muscle,roofHeight:new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).y});
  }
  state.loaded.push(muscle.name);
  const ready = Promise.all(fleet.filter(spec=>spec.file).map(load)).then(()=>{
    state.ready = !state.errors.length;
    return state;
  });
  function stage(name) {
    const next = available.get(name);
    if (!next) return false;
    const old = {x:next.x,z:next.z};
    Object.assign(next,curb);
    if (next !== staged) Object.assign(staged,old);
    staged = next;
    return true;
  }
  return {ready,stage,get starter(){return staged},options:()=>fleet.filter(s=>available.has(s.name)),
    getState:()=>({...state,loaded:[...state.loaded],errors:[...state.errors]})};
}

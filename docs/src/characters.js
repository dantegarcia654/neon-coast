import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const CHARACTER_DEFINITIONS = [
  {id:'jean',yaw:Math.PI,name:'Jean Philanthrope',tag:'THE UNLIKELY LOCAL',description:'A familiar face. An unfamiliar city.',height:2.02,portrait:'./assets/characters/jean-reference.png',model:'./assets/characters/jean.glb',idle:'./assets/characters/jean-idle.json',color:'#c8a776'},
  {id:'mara',yaw:Math.PI,name:'Mara Vega',tag:'THE STREET RACER',description:'Knows every turn. Owes nobody a favor.',height:1.74,portrait:'./assets/characters/mara-reference.png',model:'./assets/characters/mara.glb',idle:'./assets/characters/mara-idle.json',color:'#82bfb7'},
];

export function createCharacterSystem(container, fallback) {
  const loader = new GLTFLoader();
  const records = new Map();
  let selected = 'jean', active = null, onChange = () => {};
  const state = {ready:false,loading:true,error:null,selected:'jean'};
  fallback.visible = false;

  function applySelection(id) {
    const record = records.get(id);
    if (!record) return false;
    if (active) { active.root.visible = false; active.mixer.stopAllAction(); }
    active = record;
    selected = state.selected = id;
    fallback.visible = false;
    record.root.visible = true;
    record.walk.play().setEffectiveWeight(0);
    record.idle.play().setEffectiveWeight(1);
    record.movingWeight = 0;
    onChange({...state});
    return true;
  }

  async function loadOne(def) {
    try {
      const [gltf,idleJSON] = await Promise.all([
        loader.loadAsync(def.model),
        fetch(def.idle).then(response => {
          if (!response.ok) throw new Error(`Idle animation HTTP ${response.status}`);
          return response.json();
        }),
      ]);
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = def.height / size.y;
      model.scale.setScalar(scale);
      model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      const root = new THREE.Group();
      root.add(model);
      // Canonical Meshy assets face +Z; game movement faces -Z at yaw zero.
      root.rotation.y = def.yaw;
      root.visible = false;
      root.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = object.receiveShadow = true;
        for (const m of Array.isArray(object.material)?object.material:[object.material]) {
          m.envMapIntensity = .65;
          m.side = THREE.DoubleSide;
        }
      });
      container.add(root);
      const mixer = new THREE.AnimationMixer(model);
      const walkClip = gltf.animations.find(clip=>/walk/i.test(clip.name));
      if (!walkClip) throw new Error('Character has no walking animation');
      const idleClip = THREE.AnimationClip.parse(idleJSON);
      const seatedLegs=['Left','Right'].map(side=>[model.getObjectByName(side+'UpLeg'),model.getObjectByName(side+'Leg'),model.getObjectByName(side+'Foot')]);
      const neck=model.getObjectByName('Neck'),head=model.getObjectByName('Head');
      const spine=model.getObjectByName('Spine'),chest=model.getObjectByName('Spine2') || neck;
      const record = {def,root,model,mixer,seatedLegs,spine,chest,neck,head,hips:model.getObjectByName('Hips'),right:model.getObjectByName('RightHand'),left:model.getObjectByName('LeftHand'),walk:mixer.clipAction(walkClip),idle:mixer.clipAction(idleClip),movingWeight:0,animations:[walkClip.name,idleClip.name]};
      records.set(def.id,record);
      return record;
    } catch (error) {
      console.error('Character asset failed:',def.id,error);
      return null;
    }
  }

  const ready = Promise.all(CHARACTER_DEFINITIONS.map(loadOne)).then(results => {
    state.loading = false;
    state.ready = results.some(Boolean);
    state.error = results.every(Boolean)?null:state.ready?'One character is unavailable; choose the loaded lead.':'Characters could not load. Reload to try again.';
    applySelection(selected) || applySelection([...records.keys()][0]);
    onChange({...state});
    return state;
  });

  const previousPose=new Map();
  function releaseHands(){
    for(const [bone,rotation] of previousPose)bone.quaternion.copy(rotation);
    previousPose.clear();
  }
  const shoulder=new THREE.Vector3(),elbow=new THREE.Vector3(),wrist=new THREE.Vector3();
  const axis=new THREE.Vector3(),bend=new THREE.Vector3(),joint=new THREE.Vector3();
  const from=new THREE.Vector3(),to=new THREE.Vector3(),q=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
  const retargetFrom=new THREE.Vector3(),retargetTo=new THREE.Vector3();
  function pointBone(bone,child,end){
    if(!previousPose.has(bone))previousPose.set(bone,bone.quaternion.clone());
    bone.getWorldPosition(from);child.getWorldPosition(to);
    to.sub(from).normalize();from.subVectors(end,from).normalize();
    q.setFromUnitVectors(to,from);
    bone.parent.getWorldQuaternion(parentQ);
    bone.quaternion.premultiply(parentQ.clone().invert().multiply(q).multiply(parentQ));
    bone.updateWorldMatrix(false,true);
  }
  function reach(side,target){
    const hand=active?.[side],fore=hand?.parent,arm=fore?.parent;
    if(!arm)return;
    arm.getWorldPosition(shoulder);fore.getWorldPosition(elbow);hand.getWorldPosition(wrist);
    const upper=elbow.distanceTo(shoulder),lower=wrist.distanceTo(elbow);
    axis.subVectors(target,shoulder);const length=THREE.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.001,upper+lower-.001);
    axis.normalize();const along=(upper*upper-lower*lower+length*length)/(2*length);
    // Bend out and down in torso space to keep each elbow on its own side.
    bend.set(side==='right'?.9:-.9,-1,.3).applyQuaternion(container.quaternion);
    bend.addScaledVector(axis,-bend.dot(axis)).normalize();
    joint.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
    pointBone(arm,fore,joint);pointBone(fore,hand,target);
  }
  function update(dt,speed,driving,showcase) {
    if (!active) return;
    releaseHands();
    const moving = !driving && !showcase && speed>.2;
    active.movingWeight = THREE.MathUtils.lerp(active.movingWeight,moving?1:0,1-Math.exp(-12*dt));
    active.walk.setEffectiveWeight(active.movingWeight);
    active.idle.setEffectiveWeight(1-active.movingWeight);
    active.walk.setEffectiveTimeScale(Math.min(1.7,Math.max(.5,speed/3)));
    active.mixer.update(dt);
    active.root.rotation.y = active.def.yaw + (showcase?Math.sin(performance.now()*.00025)*.06:0);
  }

  return {
    ready,select:applySelection,update,
    sit(c){
      if(!active)return;
      const seat=new THREE.Vector3(...c.spec.seat),aim=new THREE.Vector3();
      container.quaternion.copy(c.g.quaternion);container.position.copy(c.g.position);container.updateWorldMatrix(true,true);
      const hip=active.hips.getWorldPosition(new THREE.Vector3());
      container.position.add(c.g.localToWorld(seat.clone().add(new THREE.Vector3(0,.10,0))).sub(hip));
      container.updateWorldMatrix(true,true);
      for(const [i,[upper,shin,foot]] of active.seatedLegs.entries()){
        const side=i===0?-1:1,heli=c.spec.kind==='heli';
        pointBone(upper,shin,c.g.localToWorld(aim.copy(seat).add(new THREE.Vector3(side*.24,-.04,-.47))));
        pointBone(shin,foot,c.g.localToWorld(aim.copy(seat).add(new THREE.Vector3(side*.22,heli?-.23:-.43,heli?-.22:-.42))));
        const grip=c.spec.kind==='quad'?aim.set(side*.33,1.25,-.31):
          c.spec.kind==='scooter'?aim.set(side*.33,1.20,-.39):
          aim.copy(seat).add(new THREE.Vector3(side*.25,.34,-.46));
        reach(i===0?'left':'right',c.g.localToWorld(grip));
      }
    },
    fallPose(body){
      if(!active || !body.rig)return;
      body.root.updateWorldMatrix(true,true);
      // Transfer segment directions so both player models retain their bone lengths.
      function align(bone,child,start,end){
        if(!bone||!child||!start||!end)return;
        const target=retargetTo.setFromMatrixPosition(end.matrixWorld);
        const origin=retargetFrom.setFromMatrixPosition(start.matrixWorld);
        target.sub(origin).add(bone.getWorldPosition(origin));
        pointBone(bone,child,target);
      }
      const {rig}=body;
      align(active.spine,active.chest,rig.torso,rig.neck);
      align(active.neck,active.head,rig.neck,rig.head);
      for(const [i,side] of ['left','right'].entries()){
        const hand=active[side],forearm=hand?.parent;
        const [thigh,shin,foot]=active.seatedLegs[i];
        align(forearm?.parent,forearm,body.arms[i],rig.elbows[i]);
        align(forearm,hand,rig.elbows[i],rig.hands[i]);
        align(thigh,shin,body.legs[i],rig.knees[i]);
        align(shin,foot,rig.knees[i],rig.feet[i]);
      }
    },
    handPosition(out){return active?.right?.getWorldPosition(out)},
    shoulderPosition(out){return active?.right?.parent?.parent?.getWorldPosition(out)},
    reachRight(target){reach("right",target)},
    holdLauncher(right,left){reach("right",right);reach("left",left)},
    setOnChange:fn=>{onChange=fn;fn({...state});},
    getState:()=>({...state,loaded:[...records.keys()],activeAnimations:active?.animations||[],model:active?.def.model||null}),
  };
}

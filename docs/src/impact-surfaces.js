// Index the original scenery pieces before render batching. A shot can then hit a railing,
// sign or curb without testing all the triangles that share its city-wide material.
import * as T from 'three';

export function createImpactSurfaces(world) {
  const cells=new Map(),large=[],objects=[];
  const cell=v=>Math.floor(v/14), key=(x,z)=>x+','+z;
  const matrix=new T.Matrix4(),instance=new T.Matrix4();
  for(const mesh of world.shotSurfaces){
    const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();
    for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
      matrix.copy(mesh.matrixWorld);
      if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance)}
      const bounds=g.boundingBox.clone().applyMatrix4(matrix);
      const entry={mesh,matrix:matrix.clone(),bounds,last:0};
      const x0=cell(bounds.min.x),x1=cell(bounds.max.x),z0=cell(bounds.min.z),z1=cell(bounds.max.z);
      if((x1-x0+1)*(z1-z0+1)>150){large.push(entry);continue}
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
        const id=key(x,z);if(!cells.has(id))cells.set(id,[]);cells.get(id).push(entry);
      }
    }
  }
  const raycaster=new T.Raycaster(),proxy=new T.Mesh(),normalMatrix=new T.Matrix3();
  const end=new T.Vector3(),boxPoint=new T.Vector3(),normal=new T.Vector3(),list=[];
  let generation=0;
  function cast(ray,range,skip=null,sceneryOnly=false){
    generation++;raycaster.ray.copy(ray);raycaster.near=0;raycaster.far=range+.008;
    let result=null;
    function test(mesh,transform,owner,kind,vehicle,civilian=null){
      proxy.geometry=mesh.geometry;proxy.material=mesh.material;proxy.matrixWorld.copy(transform);
      list.length=0;proxy.raycast(raycaster,list);
      for(const h of list){
        if(h.distance>raycaster.far||!h.face)continue;
        raycaster.far=h.distance;
        normal.copy(h.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(transform));
        if(normal.dot(ray.direction)>0)normal.negate();
        result={point:h.point,normal:normal.clone(),mesh,matrix:transform.clone(),owner,kind,vehicle,civilian,distance:h.distance};
      }
    }
    function visit(entry){
      if(entry.last===generation)return;entry.last=generation;
      if(!entry.bounds.containsPoint(ray.origin)){
        if(!ray.intersectBox(entry.bounds,boxPoint)||boxPoint.distanceToSquared(ray.origin)>raycaster.far**2)return;
      }
      test(entry.mesh,entry.matrix,null,'world',null);
    }
    ray.at(range,end);
    for(let x=cell(Math.min(ray.origin.x,end.x));x<=cell(Math.max(ray.origin.x,end.x));x++)
      for(let z=cell(Math.min(ray.origin.z,end.z));z<=cell(Math.max(ray.origin.z,end.z));z++)
        for(const e of cells.get(key(x,z))||[])visit(e);
    for(const e of large)visit(e);
    if(sceneryOnly)return result;
    for(const entry of objects){
      if(entry.vehicle===skip&&skip)continue;
      const root=entry.root;if(!root.visible)continue;
      if(ray.distanceSqToPoint(root.position)>entry.radius**2 || root.position.distanceTo(ray.origin)>raycaster.far+entry.radius)continue;
      root.updateWorldMatrix(true,true);
      root.traverseVisible(m=>{
        if(m.isMesh&&!m.userData.sauce)test(m,m.matrixWorld,entry.vehicle?root:m,entry.kind,entry.vehicle,entry.civilian);
      });
    }
    return result;
  }
  for(const c of [...world.cars,...world.cops])objects.push({root:c.g,vehicle:c,kind:c.police?'cruiser':'vehicle',radius:c.spec?.special?6.6:4.8});
  for(const b of world.roadblocks||[])objects.push({root:b.root,kind:'barricade',radius:6});
  for(const p of world.pedestrians)objects.push({root:p.root,kind:'pedestrian',civilian:p,radius:2.4});
  for(const u of world.footOfficers)objects.push({root:u.g,kind:'officer',vehicle:u,radius:2.6});
  return {cast};
}

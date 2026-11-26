import assert from 'node:assert/strict';
import {test} from 'node:test';
import {register} from 'node:module';
const threeURL=new URL('../docs/vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export function resolve(id,context,next){return id==='three'?{url:${JSON.stringify(threeURL)},shortCircuit:true}:next(id,context)}`));
const T=await import('three');
const {createRearview}=await import('../docs/src/rearview.js');
function setup(){
 const viewport=new T.Vector4(0,0,1200,740),scissor=viewport.clone(),calls=[];
 const renderer={target:null,autoClear:true,shadowMap:{autoUpdate:true},tested:false,domElement:{clientHeight:740},
  getRenderTarget(){return this.target},setRenderTarget(v){this.target=v},
  getViewport(v){v.copy(viewport)},getScissor(v){v.copy(scissor)},getScissorTest(){return this.tested},
  setViewport(...v){viewport.copy(v[0]?.isVector4?v[0]:new T.Vector4(...v))},setScissor(...v){scissor.copy(v[0]?.isVector4?v[0]:new T.Vector4(...v))},setScissorTest(v){this.tested=v},clearDepth(){},
  render(scene,camera){calls.push({target:this.target,camera:camera.clone(),carVisible:car.g.visible});if(this.fail)throw Error('render failed')}
 };
 const car={g:new T.Group(),spec:{length:4.5}};car.g.position.set(10,3,-20);
 const frame={hidden:true,getBoundingClientRect:()=>({left:526,bottom:170,width:148,height:148})};
 const mirror=createRearview({scene:new T.Scene(),renderer},frame);
 return {renderer,car,frame,mirror,calls,viewport,scissor};
}
test('rear camera sees behind the car at different headings and on an inverted track',()=>{
 for(const euler of [new T.Euler(),new T.Euler(0,Math.PI/2,0),new T.Euler(0,0,Math.PI)]){
  const {car,mirror,calls}=setup();car.g.quaternion.setFromEuler(euler);mirror.draw(car,1,true);
  const rear=calls[0].camera,forward=rear.getWorldDirection(new T.Vector3()),behind=new T.Vector3(0,0,1).applyQuaternion(car.g.quaternion);
  assert.ok(forward.dot(behind)>.999);assert.ok(rear.position.clone().sub(car.g.position).dot(behind)>2.5);
  assert.equal(calls[0].carVisible,false);assert.equal(car.g.visible,true);assert.equal(calls.length,2);
 }
});
test('mirror throttles its extra world render, hides off foot and pause, refreshes on return',()=>{
 const {mirror,car,frame}=setup();mirror.draw(car,1,true);mirror.draw(car,1.02,true);assert.equal(mirror.state().frames,1);
 mirror.draw(car,1.1,true);assert.equal(mirror.state().frames,2);
 mirror.draw(null,1.2,true);assert.equal(frame.hidden,true);
 mirror.draw(car,1.21,false);assert.equal(mirror.state().visible,false);
 mirror.draw(car,1.22,true);assert.equal(mirror.state().frames,3);
 mirror.draw({...car,spec:{special:true}},1.3,true);assert.equal(frame.hidden,true);
});
test('render passes preserve the car, viewport, scissor and renderer settings',()=>{
 const {mirror,car,renderer,viewport,scissor}=setup();car.g.visible=false;mirror.draw(car,1,true);
 assert.equal(car.g.visible,false);assert.equal(renderer.target,null);assert.equal(renderer.autoClear,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.tested,false);
 assert.deepEqual(viewport.toArray(),[0,0,1200,740]);assert.deepEqual(scissor.toArray(),[0,0,1200,740]);
 renderer.fail=true;assert.throws(()=>mirror.draw(car,2,true));assert.equal(car.g.visible,false);assert.equal(renderer.target,null);assert.equal(renderer.shadowMap.autoUpdate,true);
});

import * as T from 'three';

// A small, throttled second view reuses the main WebGL context. The circular
// shader leaves the surrounding forward view untouched and mirrors left/right.
export function createRearview(world,frame) {
  const {scene,renderer}=world;
  const target=new T.WebGLRenderTarget(192,192,{depthBuffer:true});
  const rear=new T.PerspectiveCamera(64,1,.1,420);
  const reverse=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
  const offset=new T.Vector3(),viewport=new T.Vector4(),scissor=new T.Vector4();
  const overlay=new T.Scene(),screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const surface=new T.ShaderMaterial({
    uniforms:{image:{value:target.texture}},depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 uvMirror; void main(){uvMirror=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image; varying vec2 uvMirror;
      void main(){
        if(distance(uvMirror,vec2(.5))>.5)discard;
        gl_FragColor=texture2D(image,vec2(1.-uvMirror.x,uvMirror.y));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  overlay.add(new T.Mesh(new T.PlaneGeometry(2,2),surface));
  let current=null,last=-Infinity,frames=0,visible=false;
  function draw(car,time,enabled) {
    visible=Boolean(enabled&&car&&!car.spec?.special);frame.hidden=!visible;
    if(!visible){current=null;return}
    if(car!==current||time-last>=1/12){
      rear.position.copy(offset.set(0,1.55,(car.spec?.length||4.5)/2+.4)).applyQuaternion(car.g.quaternion).add(car.g.position);
      rear.quaternion.copy(car.g.quaternion).multiply(reverse);
      const previous=renderer.getRenderTarget(),shadows=renderer.shadowMap.autoUpdate,shown=car.g.visible;
      try{
        car.g.visible=false;renderer.shadowMap.autoUpdate=false;
        renderer.setRenderTarget(target);renderer.render(scene,rear);
        last=time;current=car;frames++;
      }finally{car.g.visible=shown;renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadows}
    }
    const bounds=frame.getBoundingClientRect(),border=6;
    if(bounds.width<=border*2||bounds.height<=border*2)return;
    renderer.getViewport(viewport);renderer.getScissor(scissor);
    const tested=renderer.getScissorTest(),autoClear=renderer.autoClear;
    try{
      renderer.autoClear=false;renderer.setScissorTest(true);
      const x=bounds.left+border,y=renderer.domElement.clientHeight-bounds.bottom+border,w=bounds.width-border*2,h=bounds.height-border*2;
      renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.clearDepth();renderer.render(overlay,screenCamera);
    }finally{renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(tested);renderer.autoClear=autoClear}
  }
  return {draw,state:()=>({visible,frames,refreshHz:12}),dispose(){target.dispose();surface.dispose();overlay.children[0].geometry.dispose();frame.hidden=true}};
}

import * as T from 'three';

const surface = color => new T.MeshStandardMaterial({color,roughness:.68});
const dark=surface('#45291c');
const ivory=surface('#fff1cf'), pupil=surface('#221a18'), red=surface('#ac3b22');
const bun=surface('#e6a45b'), mustard=surface('#ffcd35'), relish=surface('#57924e');
const sphere=new T.SphereGeometry(1,18,12);
function shape(group,geo,material,x,y,z) {
  const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;
}
function oval(g,mat,x,y,z,w,h,d) {
  const m=shape(g,sphere,mat,x,y,z);m.scale.set(w,h,d);return m;
}
function stroke(g,mat,points,r) {
  const path=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));
  return shape(g,new T.TubeGeometry(path,Math.max(6,points.length*2),r,6,false),mat,0,0,0);
}
export function makeHotdog() {
  const g=new T.Group();
  for(const side of [-1,1])oval(g,bun,side*.075,0,0,.094,.106,.32);
  oval(g,red,0,.064,0,.075,.08,.35);
  const line=Array.from({length:19},(_,i)=>[.034*Math.sin(i*1.02),.139-.032*((i-9)/9)**2,(i-9)*.027]);
  stroke(g,mustard,line,.013);
  for(let i=0;i<5;i++)oval(g,relish,.049,.104,-.18+i*.09,.018,.016,.024);
  return g;
}
function carvedWood() {
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle='#edc496';ctx.fillRect(0,0,256,256);
  for(let i=0;i<88;i++){
    ctx.strokeStyle=i%3?'#95591e55':'#fff2cf66';ctx.lineWidth=i%4===0?1.8:.8;ctx.beginPath();
    for(let y=0;y<=256;y+=4){const x=i*3+2*Math.sin(y*.032+i*2)+1.4*Math.sin(y*.065+i*.6);if(y===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
    ctx.stroke();
  }
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshStandardMaterial({map:t,color:'#db9761',roughness:.62});
}
// Profiles are cosmetic shells in the game's forward (-Z) direction.
function shell(g, outline, width, material, bevel=.009, x=0) {
  const path=new T.Shape(outline.map(([length,height])=>new T.Vector2(length,height)));
  const geo=new T.ExtrudeGeometry(path,{depth:width,bevelEnabled:true,bevelSegments:2,
    steps:1,bevelSize:bevel,bevelThickness:bevel});
  geo.translate(0,0,-width/2);geo.rotateY(Math.PI/2);
  if(material.map){
    geo.computeBoundingBox();const box=geo.boundingBox,v=geo.attributes.position,uv=geo.attributes.uv;
    const dz=box.max.z-box.min.z,dy=box.max.y-box.min.y;
    for(let i=0;i<v.count;i++){
      const u=(v.getZ(i)-box.min.z)/dz,h=(v.getY(i)-box.min.y)/dy;
      uv.setXY(i,dz>dy?h:u,dz>dy?u:h);
    }
  }
  return shape(g,geo,material,x,0,0);
}
function collar(g,z,y,r,length,mat) {
  const m=shape(g,new T.CylinderGeometry(r,r,length,32),mat,0,y,z);m.rotation.x=Math.PI/2;return m;
}
function nameplate() {
  const c=document.createElement('canvas');c.width=384;c.height=72;
  const ctx=c.getContext('2d');ctx.fillStyle='#243136';ctx.fillRect(0,0,384,72);
  ctx.fillStyle='#e5ac4d';ctx.fillRect(8,9,9,53);ctx.fillStyle='#ede9d7';ctx.font='bold 35px sans-serif';
  ctx.fillText('THE MEAT ROCKET',28,49,345);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  return new T.MeshStandardMaterial({map,roughness:.54,metalness:.12});
}
function wornFinish(){
  const c=document.createElement('canvas');c.width=384;c.height=192;
  const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);
  let seed=31;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<c.height;y++){
    const grain=random()*4;
    for(let x=0;x<c.width;x++){
      const edge=Math.min(x,c.width-1-x,y,c.height-1-y);
      const value=209+grain+random()*13+8*Math.cos(x*.023+y*.009)+(edge<2?23:0);
      const i=(y*c.width+x)*4;
      pixels.data[i]=value;pixels.data[i+1]=value+2;pixels.data[i+2]=value+4;pixels.data[i+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  for(let i=0;i<160;i++){
    const x=random()*c.width,y=random()*c.height;
    ctx.strokeStyle=i%4?'#171d2224':'#fbf5dc73';ctx.lineWidth=.45+random()*.7;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*14,y+random()*2-1);ctx.stroke();
  }
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return map;
}
export function makeLauncher() {
  const g=new T.Group(), timber=carvedWood();
  const metal=(color,metalness,roughness)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const blued=metal('#425461',.51,.38), steel=metal('#9ba8aa',.67,.30);
  const rubber=metal('#252a2b',.07,.84), brass=metal('#daa052',.67,.36), lacquer=metal('#923b27',.32,.36);
  timber.color.set('#945432');
  blued.map=wornFinish();
  // A slim rear stock, high spine and open serving trough give the object one continuous silhouette.
  shell(g,[[-.52,.19],[-.49,.244],[-.17,.24],[-.09,.195],[-.14,.15],[-.34,.15],[-.49,.042],[-.53,.052]],.114,timber);
  shell(g,[[-.53,.244],[-.50,.242],[-.50,.047],[-.53,.029],[-.55,.052]],.133,rubber);
  shell(g,[[-.19,.14],[-.17,.26],[.23,.26],[.31,.21],[.29,.095],[.17,.068],[-.11,.075]],.151,blued,.014);
  shell(g,[[-.065,.113],[.052,.085],[-.003,-.13],[-.127,-.123],[-.138,-.09]],.095,rubber);
  for(const side of [-1,1]){
    shell(g,[[-.073,.077],[.022,.065],[-.024,-.094],[-.104,-.091]],.009,timber,.004,side*.055);
    for(let i=0;i<4;i++)stroke(g,dark,[[side*.062,-.066+i*.028,.09-i*.006],[side*.062,-.053+i*.028,.042-i*.006]],.0028);
  }
  stroke(g,blued,[[0,.07,-.163],[0,-.027,-.162],[0,-.046,-.115],[0,-.037,-.018]],.012);
  collar(g,-.37,.166,.101,.38,steel);
  const sidePanel=[[.213,.09],[.245,.232],[.35,.25],[.53,.233],[.602,.199],[.603,.089],[.532,.045],[.29,.048]];
  for(const side of [-1,1]){
    shell(g,sidePanel,.035,blued,.008,side*.091);
    shell(g,[[.29,.078],[.34,.178],[.543,.167],[.57,.13],[.537,.079]],.013,rubber,.006,side*.114);
    for(let i=0;i<5;i++){
      const z=-.327-i*.042;
      stroke(g,blued,[[side*.126,.091,z+.012],[side*.126,.155,z-.012]],.008);
    }
  }
  for(const side of [-1,1]){
    // Exposed edges, fasteners and thin laminations catch light at gameplay scale.
    stroke(g,steel,[[side*.084,.247,.15],[side*.086,.25,-.025],[side*.085,.245,-.19]],.0032);
    for(const z of [-.28,-.56])oval(g,steel,side*.123,.193,z,.005,.012,.012);
    for(let i=0;i<5;i++){
      const z=.30+i*.036;
      stroke(g,dark,[[side*.065,.166,z],[side*.066,.181,z+.008]],.003);
    }
  }
  collar(g,-.615,.168,.097,.09,blued);collar(g,-.651,.168,.101,.019,brass);
  // Open delivery cup and dark inset make the business end legible from an oblique view.
  shape(g,new T.TorusGeometry(.077,.015,10,36),steel,0,.168,-.704);
  collar(g,-.675,.168,.093,.047,blued);collar(g,-.70,.168,.071,.006,rubber);
  collar(g,-.735,.168,.067,.065,steel);
  collar(g,-.774,.168,.074,.028,blued);
  shape(g,new T.TorusGeometry(.058,.008,9,32),steel,0,.168,-.792);
  collar(g,-.79,.168,.055,.006,rubber);
  const label=nameplate();
  for(const side of [-1,1]){
    const badge=shape(g,new T.PlaneGeometry(.25,.047),label,side*.092,.208,-.008);badge.rotation.y=side*Math.PI/2;
    for(const z of [-.191,.133]){
      const pin=shape(g,new T.CylinderGeometry(.012,.012,.009,10),steel,side*.091,.124,z);pin.rotation.z=Math.PI/2;
    }
  }
  const pack=[[.18,.098],[.30,.094],[.276,-.132],[.243,-.169],[.137,-.144],[.155,-.053]];
  shell(g,pack,.108,blued,.009);
  for(const side of [-1,1]){
    shell(g,[[.16,-.142],[.255,-.164],[.264,-.138],[.166,-.116]],.015,rubber,.005,side*.055);
    for(const [offset,fill] of [[.191,lacquer],[.233,brass]]){
      shell(g,[[offset,-.098],[offset+.014,-.100],[offset+.038,.062],[offset+.023,.061]],.004,fill,.003,side*.063);
    }
    shell(g,[[-.116,.152],[.121,.152],[.145,.119],[.117,.1],[-.103,.103]],.006,rubber,.004,side*.087);
    stroke(g,steel,[[side*.094,.144,.099],[side*.094,.144,-.11]],.002);
  }
  for(const z of [-.22,-.51])collar(g,z,.168,.106,.018,lacquer);
  const load=makeHotdog();load.position.set(0,.24,-.403);load.scale.set(.48,.47,.5);g.add(load);
  // The meme survives as a carved wooden face in the rear cap, visible over the player's shoulder.
  const face=shape(g,new T.CylinderGeometry(.079,.071,.126,24),timber,0,.273,.15);
  face.rotation.x=-.09;
  for(const side of [-1,1]){
    oval(g,ivory,side*.035,.289,.212,.031,.035,.019);
    oval(g,pupil,side*.035,.287,.23,.013,.019,.006);
  }
  stroke(g,dark,[[-.033,.252,.216],[0,.239,.222],[.034,.252,.215]],.005);
  // Raised spine around the mascot, with a flash of brass on the top edge.
  for(const x of [-.061,.061])shell(g,[[-.11,.259],[-.084,.334],[.118,.334],[.147,.255],[.124,.254],[.101,.309],[-.066,.309],[-.083,.257]],.012,blued,.004,x);
  shell(g,[[-.079,.327],[.113,.327],[.11,.338],[-.076,.338]],.14,brass,.003);
  return {model:g,load,mouth:new T.Vector3(0,.168,-.802)};
}

// Use the playable mesh itself for the wheel portrait.
export function launcherPortrait(renderer,model) {
  const stage=new T.Scene(), prop=model.clone(true);stage.add(prop);
  // Broad studio reflections describe bevels and distinguish alloy from rubber in the inventory.
  const canvasEnv=document.createElement('canvas');canvasEnv.width=256;canvasEnv.height=128;
  const ctxEnv=canvasEnv.getContext('2d'),gradient=ctxEnv.createLinearGradient(0,0,0,128);
  for(const [at,color] of [[0,'#b9d3e5'],[.3,'#577082'],[.51,'#323b46'],[.64,'#b1a99b'],[1,'#443f42']])gradient.addColorStop(at,color);
  ctxEnv.fillStyle=gradient;ctxEnv.fillRect(0,0,256,128);
  ctxEnv.fillStyle='#ffedcf';ctxEnv.fillRect(10,33,65,17);ctxEnv.fillStyle='#e3efff';ctxEnv.fillRect(158,17,24,57);
  const env=new T.CanvasTexture(canvasEnv);env.mapping=T.EquirectangularReflectionMapping;env.colorSpace=T.SRGBColorSpace;stage.environment=env;
  stage.add(new T.HemisphereLight('#fff2ce','#d39a82',2.3));
  const light=new T.DirectionalLight('#fff1d5',3);light.position.set(2,4,3);stage.add(light);
  const cam=new T.OrthographicCamera(-.73,.73,.49,-.49,.01,10);
  cam.position.set(2.3,.65,.76);cam.lookAt(0,.105,-.12);
  const width=768,height=512,stride=width*4;
  const target=new T.WebGLRenderTarget(width,height,{colorSpace:T.SRGBColorSpace});
  const prev=renderer.getRenderTarget(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.render(stage,cam);
  const pixels=new Uint8Array(stride*height);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  renderer.setRenderTarget(prev);renderer.setClearColor(clear,alpha);target.dispose();env.dispose();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);
  for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
  ctx.putImageData(data,0,0);return canvas.toDataURL();
}

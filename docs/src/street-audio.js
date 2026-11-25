// Decode only the sources within earshot, after Start has unlocked Web Audio.
export function streetAudio(ctx) {
  const sources=[
    {name:'griddle',x:12.4,z:-85.5,range:34,level:.70},
    {name:'shop-radio',x:17,z:-83,range:42,level:.39},
    {name:'court',x:24,z:24,range:43,level:.72}
  ];
  for(const s of sources){
    s.gain=ctx.createGain();s.gain.gain.value=0;
    s.pan=ctx.createStereoPanner();s.gain.connect(s.pan);s.pan.connect(ctx.destination);
  }
  function load(s) {
    s.loading=true;
    fetch(new URL('../assets/street/'+s.name+'.mp3',import.meta.url),{priority:'low'})
      .then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer()})
      .then(bytes=>ctx.decodeAudioData(bytes))
      .then(buffer=>{s.buffer=buffer})
      .catch(()=>{s.retryAt=ctx.currentTime+20})
      .finally(()=>{s.loading=false});
  }
  function update(active,listener,rightX,rightZ,time) {
    for(const s of sources){
      const dx=s.x-listener.x,dz=s.z-listener.z,dist=Math.hypot(dx,dz,listener.y||0);
      const gain=active && !document.hidden?s.level*Math.max(0,1-dist/s.range)**1.5:0;
      if(gain>0 && !s.buffer && !s.loading && !(s.retryAt>ctx.currentTime))load(s);
      if(gain>0 && s.buffer && !s.node){
        s.node=ctx.createBufferSource();s.node.buffer=s.buffer;s.node.loop=true;
        s.node.connect(s.gain);s.node.start(0,time%s.buffer.duration);
      }
      if(s.levelTarget!==gain){
        s.gain.gain.setTargetAtTime(gain,ctx.currentTime,.04);s.levelTarget=gain;
      }
      const pan=Math.max(-1,Math.min(1,(dx*rightX+dz*rightZ)/Math.max(1,dist)));
      if(gain && (s.panTarget==null||Math.abs(pan-s.panTarget)>.01)){
        s.pan.pan.setTargetAtTime(pan,ctx.currentTime,.05);s.panTarget=pan;
      }
      if(!gain && s.node){
        const node=s.node;node.stop(ctx.currentTime+.15);node.onended=()=>node.disconnect();s.node=null;
      }
    }
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)update(false,{x:0,z:0},1,0,0);
  });
  function horn(car,listener,rightX,rightZ){
    const dx=car.x-listener.x,dz=car.z-listener.z,d=Math.hypot(dx,dz);
    const volume=.085*Math.max(0,1-d/54);
    if(volume<.002)return;
    const now=ctx.currentTime,pan=ctx.createStereoPanner(),env=ctx.createGain();
    pan.pan.value=Math.max(-1,Math.min(1,(dx*rightX+dz*rightZ)/Math.max(1,d)));
    env.gain.setValueAtTime(.0001,now);env.gain.exponentialRampToValueAtTime(volume,now+.02);
    env.gain.exponentialRampToValueAtTime(.0001,now+.29);
    env.connect(pan);pan.connect(ctx.destination);
    for(const hz of [349,440]){
      const osc=ctx.createOscillator();osc.type='triangle';osc.frequency.value=hz;
      osc.connect(env);osc.start(now);osc.stop(now+.30);
      osc.onended=()=>{osc.disconnect();if(hz===440){env.disconnect();pan.disconnect()}};
    }
  }
  return {update,horn,state:()=>sources.map(s=>({name:s.name,playing:!!s.node,gain:s.gain.gain.value,pan:s.pan.pan.value}))};
}

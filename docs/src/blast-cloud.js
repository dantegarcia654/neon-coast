import * as T from "three";

// Generate a softly lit, irregular puff once. Each billboard can then expand and
// rotate independently without showing the polygon edges of a growing sphere.
const size = 96;
const pixels = new Uint8Array(size * size * 4);
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  const u = T.MathUtils.smoothstep(x - i, 0, 1), v = T.MathUtils.smoothstep(y - j, 0, 1);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(i,j), hash(i+1,j), u),
    T.MathUtils.lerp(hash(i,j+1), hash(i+1,j+1), u), v);
}
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const u = (x+.5)/size, v = (y+.5)/size;
    const billow = .56*noise(7*u,7*v) + .29*noise(15*u,15*v) + .15*noise(32*u,32*v);
    const edge = 1 - 2*Math.hypot(u-.5,v-.5) + .68*(billow-.55);
    const alpha = T.MathUtils.smoothstep(edge, .045, .34);
    const shade = 122 + 92*billow + 35*v + 15*Math.max(0,edge);
    const i = (y*size + x)*4;
    pixels[i]=pixels[i+1]=pixels[i+2]=Math.min(255,shade);
    pixels[i+3]=Math.round(255*alpha);
  }
}
const map = new T.DataTexture(pixels,size,size);
map.colorSpace=T.SRGBColorSpace;
map.minFilter=map.magFilter=T.LinearFilter;
map.needsUpdate=true;
export function cloudSprite(color,angle) {
  return new T.Sprite(new T.SpriteMaterial({map,color,rotation:angle,
    transparent:true,depthWrite:false}));
}

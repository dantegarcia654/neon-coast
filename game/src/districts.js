import { ruralHeight, region } from './terrain.js';
import * as THREE from 'three';
export const MAP_FEATURES=[{type:'water',x:120,z:-72,w:30,d:30},{type:'water',x:157,z:-72,w:52,d:12},{type:'bridge',x:144,z:-72,w:18,d:30},{type:'pool',x:76,z:-69,w:12,d:16},{type:'court',x:24,z:24,w:20,d:26},{type:'dock',x:120,z:-83,w:30,d:2.4},{type:'dock',x:120,z:-61,w:30,d:2.4}];
export function waterWalkway(x,z,r=.5){return r<1.2&&x>=104&&x<=135.5&&[-83,-61].some(p=>Math.abs(z-p)<=1.2-r)}
export function groundHeight(x,z){
 if(z< -176)return ruralHeight(x,z);
 if(Math.abs(x-144)<=9.3&&Math.abs(z+72)<15)return .12+1.2*Math.min(1,Math.max(0,(15-Math.abs(z+72))/9));
 if(x>=105&&x<=135&&[-83,-61].some(p=>Math.abs(z-p)<=1.2))return .45;
 if(Math.abs(x-24)<=7.5&&Math.abs(z-24)<=11)return .455;
 if(Math.abs(x-24)<=10.5&&Math.abs(z-24)<=13.5)return .42;
 if(Math.abs(x-120)<=13&&Math.abs(z+24)<=13)return .45;
 if(Math.abs(x-76)<=6.5&&Math.abs(z+69)<=8.5)return .46;
 const cx=-120+Math.round((x+120)/48)*48,cz=-120+Math.round((z+120)/48)*48;
 if(cx>=-120&&cx<=120&&cz>=-120&&cz<=120&&Math.abs(x-cx)<=15.15&&Math.abs(z-cz)<=15.15)return .28;
 return 0;
}
export function districtAt(x,z){const countryside=region(x,z);if(countryside)return countryside;if(Math.abs(x-144)<11&&z> -120&&z< -24)return 'KEYLINE CAUSEWAY';if(x>102&&z> -100&&z< -5)return 'PALM QUAY MARINA';if(z>64)return 'CYPRESS HEIGHTS';if(x< -65)return 'PORT SOL';if(x>65)return 'OCEAN TERRACE';return 'DOWNTOWN'}
export function buildDistrictLandmarks({scene,box,mesh,material,cylinder,waterMaterial,colliders,buildings,label,palm}){
 const building=(x,z,w,d,h,color)=>{box(w,h,d,color,x,h/2+.3,z,scene,'plaster');box(w+.5,.25,d+.5,'#ded5c6',x,h+.4,z);colliders.push({x,z,w:w/2+.3,d:d/2+.3});buildings.push({x,z,w,d,h});return{w,d,h}};
 // A courtyard hotel and water court break the repeated apartment footprint.
 building(72,-83,27,8,29,'#dbd6bf');building(61,-71,6,18,13,'#d8bfa9');
 for(let y=3;y<29;y+=3.2)for(let x=61;x<85;x+=3.3){box(2,2,.08,'#375762',x,y,-78.94,scene,'glass');box(2.5,.12,1.1,'#c9c3b5',x,y-1.08,-78.5);box(2.4,.06,.06,'#4c6265',x,y-.5,-78)}
 box(13,.2,17,'#e2d7bf',76,.36,-69);box(12,.04,16,'#61b7bc',76,.48,-69);colliders.push({x:76,z:-69,w:6,d:8,type:'water'});
 for(const x of [68,84])for(const z of [-75,-66]){cylinder(.035,.035,2,'#a99171',x,1,z);mesh(new THREE.ConeGeometry(1.5,.5,12),material('#c4a57e'),x,2,z);box(.7,.18,1.8,'#e9dfc8',x+1,.6,z+1)}
 const hotel=label('OCEAN TERRACE','#d4edce',15,1.4);hotel.position.set(72,5,-78.8);scene.add(hotel);
 // A proper court creates an identifiable open-space landmark.
 box(21,.08,27,'#466a5e',24,.37,24);box(15,.025,22,'#375568',24,.43,24);for(const x of [16.5,31.5])box(.07,.018,22,'#dddcd0',x,.46,24);for(const z of [13,35,24])box(15,.018,.07,'#dddcd0',24,.46,z);
 const circle=new THREE.Mesh(new THREE.TorusGeometry(2.2,.035,4,40),material('#dddcd0'));circle.rotation.x=Math.PI/2;circle.position.set(24,.46,24);scene.add(circle);
 for(const z of [12,36]){cylinder(.07,.09,3.4,'#5e6665',24,1.7,z);box(1.8,.95,.1,'#e5e2d3',24,3.15,z+(z<24?.3:-.3));const hoop=new THREE.Mesh(new THREE.TorusGeometry(.23,.03,4,16),material('#a3513c'));hoop.rotation.x=Math.PI/2;hoop.position.set(24,2.95,z+(z<24?.65:-.65));scene.add(hoop)}
 // Marina cut: visible water, collision protection, connected causeway deck.
 for(const f of MAP_FEATURES.filter(f=>f.type==='water')){const m=mesh(new THREE.PlaneGeometry(f.w,f.d,8,8),waterMaterial,f.x,.035,f.z,scene,false);m.rotation.x=-Math.PI/2;m.castShadow=false}
 colliders.push({x:120,z:-72,w:15,d:15,type:'water'},{x:164,z:-72,w:10,d:6,type:'water'});
 for(const z of [-83,-61]){box(30,.2,2.4,'#a28c6a',120,.35,z);for(let x=112;x<134;x+=4)cylinder(.06,.08,1.1,'#776c56',x,.45,z+(z< -72?-1.05:1.05))}
 for(const [x,z]of [[118,-78],[126,-66]]){const boat=new THREE.Group();scene.add(boat);boat.position.set(x,.12,z);const hull=new THREE.Mesh(new THREE.CapsuleGeometry(.6,2.5,3,10),material('#e3ded3'));hull.rotation.x=Math.PI/2;hull.scale.set(1,.5,1);boat.add(hull);box(1,.35,1.3,'#385f6a',0,.5,.3,boat);box(.08,2,.08,'#c8c5b7',0,1.4,0,boat)}
 const geo=new THREE.PlaneGeometry(18,30,1,30);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,groundHeight(pos.getX(i)+144,pos.getZ(i)-72));const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*18/5,uv.getY(i)*30/5);geo.computeVertexNormals();const deck=new THREE.Mesh(geo,material('#777a7c','road'));deck.position.set(144,0,-72);deck.receiveShadow=true;scene.add(deck);
 for(let z=-86;z< -57;z+=2){const h=groundHeight(144,z);for(const x of [134.7,153.3]){if(x<140&&[-83,-61].some(p=>Math.abs(z-p)<=2))continue;box(.12,.12,2.1,'#c4c5b6',x,h+.9,z);if(z%6===0)box(.1,.9,.1,'#9eaaa7',x,h+.5,z)}if(z%8===0){box(.13,.025,3,'#dcc795',143.8,h+.14,z);box(.13,.025,3,'#dcc795',144.2,h+.14,z)}}
 for(const z of [-76,-68])for(const x of [137,151])cylinder(.35,.5,1.5,'#bcbbae',x,.5,z);
 // Warehouses and low-rise yards receive distinct street-level details.
 for(const z of [-120,-72,-24,24]){const sign=label('PORT SOL / FREIGHT','#c9c8a2',16,1.5);sign.position.set(-120,4,z+13.2);scene.add(sign);for(let a=-8;a<=8;a+=8){box(6,2.8,.12,'#687a7c',-120+a,1.8,z+13.1);for(let y=.5;y<3;y+=.35)box(5.8,.025,.025,'#a2a79a',-120+a,y,z+13.2)}}
 for(const x of [-120,-72,-24,24,72,120]){palm(x-10,154,.7);box(15,.2,3,'#81916c',x,.2,160)}
 return {waterRegions:MAP_FEATURES.filter(x=>x.type==='water')};
}

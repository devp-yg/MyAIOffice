import * as THREE from './vendor/three/three.module.js';
import { EXECUTIVE_ROOM_LAYOUT, EXECUTIVE_GALLERY_REGIONS, EXECUTIVE_WALLS, EXECUTIVE_DOORS, EXECUTIVE_DOOR_LEAVES, EXECUTIVE_FURNITURE } from './office-executive.js';

const C={ivory:0xf1ebdf,stone:0xe2ded3,walnut:0x654d3c,darkWood:0x47392f,oak:0xb59a77,brass:0xb99d67,sage:0x718477,forest:0x354d44,linen:0xe8dfcc,clay:0xbba391,ink:0x273d38};
const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12),cyl=new THREE.CylinderGeometry(1,1,1,24),mats=new Map();
function mat(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:color===C.brass?.4:.76,metalness:color===C.brass?.35:.02}));return mats.get(color);}
function shape(parent,geometry,color,x,y,z,w=1,h=1,d=1,shadow=true){const mesh=new THREE.Mesh(geometry,typeof color==='object'?color:mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
const box=(p,c,x,y,z,w,h,d,shadow=true)=>shape(p,cube,c,x,y,z,w,h,d,shadow);
const ball=(p,c,x,y,z,w,h=w,d=w)=>shape(p,sphere,c,x,y,z,w,h,d);
const cylinder=(p,c,x,y,z,r,h)=>shape(p,cyl,c,x,y,z,r,h,r);
function group(p,x=0,z=0,rotation=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;p.add(g);return g;}
function plate(p,c,x,y,z,w,d,h=.08,r=.12){
  r=Math.min(r,w/2,d/2);const s=new THREE.Shape(),a=-w/2,b=-d/2;
  s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+d-r);s.quadraticCurveTo(a+w,b+d,a+w-r,b+d);s.lineTo(a+r,b+d);s.quadraticCurveTo(a,b+d,a,b+d-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);
  const geom=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:5});geom.rotateX(-Math.PI/2);
  return shape(p,geom,c,x,y,z);
}
function rug(root,x,z,w,d,color,border){plate(root,border,x,.055,z,w,d,.012,.12).castShadow=false;plate(root,color,x,.069,z,w-.16,d-.16,.01,.08).castShadow=false;}
function cup(p,x,y,z){cylinder(p,C.ivory,x,y,z,.075,.12);cylinder(p,0x685647,x,y+.062,z,.061,.005);}
function plant(p,item){
  cylinder(p,0xbab09b,0,.23,0,.23,.44);cylinder(p,0xd6ccbb,0,.45,0,.25,.06);cylinder(p,0x647258,0,.86,0,.025,.8);
  for(let i=0;i<9;i++){const a=i*2.4,y=.75+i*.075;const leaf=ball(p,[0x758868,0x93a480,0x667b62][i%3],Math.cos(a)*.2,y,Math.sin(a)*.2,.26,.065,.14);leaf.rotation.y=a;leaf.rotation.z=Math.cos(a)*.35;}
  p.scale.setScalar(item.h/1.4);
}
function chair(p,item){
  const owner=item.room==='desk',color=owner?C.darkWood:item.room==='meeting'?C.forest:C.sage;
  cylinder(p,C.brass,0,.25,0,.035,.45);cylinder(p,0x7c8177,0,.08,0,.3,.045);
  plate(p,color,0,.48,0,item.w,.57,.12,.1);plate(p,color,0,.65,-.24,item.w,.14,owner?.63:.43,.065);
  for(const side of [-1,1])box(p,C.brass,side*(item.w/2-.02),.64,0,.035,.27,.36);
}
function sofa(p,item){
  const color=item.room==='research'?0xded5c1:item.room==='desk'?0xa6b3a4:0xe5d9c6;
  plate(p,C.walnut,0,.18,0,item.w,item.d,.22,.1);
  plate(p,color,0,.58,-item.d*.36,item.w,.22,.52,.08);
  const count=Math.max(2,Math.round(item.w/.85));
  for(let i=0;i<count;i++){const x=-item.w/2+(i+.5)*item.w/count;plate(p,color,x,.5,.035,item.w/count-.045,item.d*.72,.18,.08);plate(p,item.room==='desk'?0xb8c1b2:C.linen,x,.76,-item.d*.25,item.w/count-.055,.18,.3,.05);}
  for(const side of [-1,1])plate(p,color,side*(item.w/2-.1),.53,0,.2,item.d,.4,.08);
  const cushion=box(p,item.room==='research'?C.sage:0xc2ad91,-item.w*.28,.84,-.09,.36,.37,.13);cushion.rotation.z=.13;
}
function armchair(p,item){
  const color=item.room==='library'?0x997c61:item.room==='research'?0xb4bba6:0xc8b69f;
  plate(p,C.walnut,0,.22,0,item.w*.84,item.d*.84,.14,.1);
  plate(p,color,0,.46,0,item.w,item.d*.85,.22,.16);plate(p,color,0,.65,-item.d*.35,item.w,.18,.4,.09);
  for(const side of [-1,1])plate(p,color,side*(item.w/2-.07),.5,0,.16,item.d,.28,.07);
}
function cabinet(p,item){
  const vault=item.room==='server',wood=vault?0x667870:C.walnut;
  box(p,wood,0,item.h/2,0,item.w,item.h,item.d);box(p,C.brass,0,.09,item.d/2+.006,item.w,.022,.012);
  const n=Math.max(2,Math.round(item.w/.65));
  for(let i=0;i<n;i++){const x=-item.w/2+(i+.5)*item.w/n;box(p,vault?0x839389:0x7d6650,x,item.h*.5,item.d/2+.01,item.w/n-.035,item.h-.12,.025);box(p,C.brass,x,item.h*.65,item.d/2+.035,.1,.025,.025);}
  box(p,vault?0xc9cfbf:0xd6c6aa,0,item.h+.035,0,item.w+.04,.07,item.d+.035);
  if(!vault){cylinder(p,C.ivory,-item.w*.25,item.h+.13,0,.1,.2);ball(p,C.sage,-item.w*.25,item.h+.3,0,.15,.065,.11);}
}
function bookshelf(p,item){
  box(p,C.darkWood,0,item.h/2,-item.d*.42,item.w,item.h,.08);
  for(const x of [-item.w/2,item.w/2])box(p,C.walnut,x,item.h/2,0,.08,item.h,item.d);
  for(let row=0;row<5;row++){const y=.1+row*.44;box(p,C.walnut,0,y,0,item.w,.07,item.d);if(row===4)continue;
    for(let i=0;i<7;i++){const bw=.11+(i%2)*.025,x=-item.w*.41+i*item.w*.133,bh=.25+(i%3)*.035;box(p,[0xc9c1a6,0x84947e,0xb39a77,0x6c7d72,0xd9d0b9][(i+row)%5],x,y+bh/2+.035,.04,bw,bh,item.d*.64);box(p,C.brass,x,y+.11,.175,bw*.7,.008,.005,false);}}
  box(p,C.oak,0,item.h,0,item.w+.04,.065,item.d+.03);
}
function table(p,item){
  const formal=item.type==='meeting-table',coffee=item.type==='coffee-table',wood=formal?C.walnut:coffee?0xc9bca4:C.oak;
  plate(p,wood,0,item.h,0,item.w,item.d,.1,formal?.3:.16);
  if(formal){for(const x of [-item.w*.3,item.w*.3]){box(p,C.darkWood,x,item.h/2,0,.34,item.h,item.d*.62);box(p,C.brass,x,.08,0,.65,.055,item.d*.8);}
    plate(p,0x938576,0,item.h+.105,0,item.w-.65,.43,.012,.08);
    for(const x of [-3.35,-2,-.65,.7,2.05,3.4])for(const z of [-.48,.48]){box(p,0xe7e1d2,x,item.h+.115,z,.34,.017,.26,false);box(p,0x9faaa0,x,item.h+.128,z,.24,.006,.008,false);}
  }else{for(const x of [-item.w*.35,item.w*.35])for(const z of [-item.d*.28,item.d*.28])box(p,C.walnut,x,item.h/2,z,.065,item.h,.065);
    if(coffee){cup(p,-item.w*.2,item.h+.16,.1);box(p,C.forest,item.w*.2,item.h+.12,-.03,.38,.04,.27);box(p,0xe6dfc9,item.w*.2,item.h+.147,-.03,.31,.015,.23);}
    else{box(p,C.forest,-.12,item.h+.12,0,.46,.04,.33);box(p,C.ivory,.38,item.h+.115,0,.38,.017,.32);}
  }
}
function executiveDesk(p,item){
  const owner=item.room==='desk';plate(p,owner?C.darkWood:C.walnut,0,item.h,0,item.w,item.d,.14,.2);
  plate(p,owner?0x927a56:0xb6a481,0,item.h+.145,0,item.w-.2,item.d-.18,.015,.1);
  for(const x of [-item.w*.35,item.w*.35])box(p,owner?C.walnut:C.sage,x,item.h*.45,0,.43,item.h*.9,item.d*.8);
  box(p,owner?C.forest:C.walnut,0,item.h*.49,item.d*.37,item.w-.3,item.h*.63,.09);
  box(p,C.brass,0,item.h*.56,item.d*.425,item.w-.6,.025,.01,false);
  box(p,0x2e3f38,-item.w*.2,item.h+.31,-.06,.58,.34,.03);box(p,0xa3b6a7,-item.w*.2,item.h+.31,-.079,.49,.27,.008,false);
  box(p,C.ivory,.34,item.h+.17,.06,.44,.018,.29);cup(p,item.w*.34,item.h+.23,-.14);
}
function art(root,x,y,z,w,h,rotation=0,style=0){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');ctx.fillStyle='#e9dfcb';ctx.fillRect(0,0,320,240);
  ctx.fillStyle=style?'#788b79':'#9c7e61';ctx.beginPath();ctx.arc(125,115,78,0,Math.PI*2);ctx.fill();ctx.fillStyle=style?'#baaa88':'#c0b392';ctx.fillRect(145,50,95,155);ctx.fillStyle='#e9dfcb';ctx.fillRect(35,155,245,13);ctx.strokeStyle='#525e4e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(55,200);ctx.bezierCurveTo(210,190,65,25,260,80);ctx.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const g=group(root,x,z,rotation);g.position.y=y;
  box(g,C.walnut,0,0,0,w+.1,h+.1,.065);shape(g,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}),0,0,.038,1,1,1,false);
}
function buildFurniture(root,item){
  const p=group(root,item.x,item.z,item.rotation||0);p.userData.room=item.room;
  switch(item.type){
    case 'executive-desk':executiveDesk(p,item);break;
    case 'chair':chair(p,item);break;
    case 'sofa':sofa(p,item);break;
    case 'armchair':armchair(p,item);break;
    case 'sideboard':cabinet(p,item);break;
    case 'bookshelf':bookshelf(p,item);break;
    case 'plant':plant(p,item);break;
    case 'meeting-table':case 'coffee-table':case 'reading-table':table(p,item);break;
    case 'tea-bar':cabinet(p,item);box(p,0x37443b,.45,item.h+.28,0,.42,.45,.35);box(p,C.brass,.45,item.h+.29,.183,.26,.05,.014);cup(p,-.4,item.h+.14,.05);cup(p,-.1,item.h+.14,.05);break;
    case 'lamp':cylinder(p,C.brass,0,.08,0,.2,.08);cylinder(p,C.brass,0,.9,0,.022,1.7);shape(p,new THREE.ConeGeometry(.31,.3,24,1,true),C.ivory,0,1.73,0);cylinder(p,0xf5e2b2,0,1.6,0,.22,.025);break;
    case 'screen':{box(p,C.darkWood,0,1.45,0,item.w,1.3,.13);box(p,0x30493f,0,1.45,.071,item.w-.12,1.18,.015);box(p,0xc9d4bc,-.7,1.69,.084,.75,.035,.008);for(let i=0;i<3;i++)box(p,[0xa3b294,0xc1ab77,0x7f9e8a][i],-.72+i*.6,1.31,.084,.35,.16+i*.12,.008);for(const x of [-.7,.7])box(p,C.brass,x,.45,0,.05,.9,.08);break;}
    case 'vault':{box(p,0x34483f,0,item.h/2,0,item.w,item.h,item.d);box(p,0x7a8a7b,0,item.h/2,item.d/2+.025,item.w-.16,item.h-.16,.06);box(p,0x4b6153,0,item.h/2,item.d/2+.063,item.w-.27,item.h-.27,.03);const dial=cylinder(p,C.brass,.55,item.h*.55,item.d/2+.1,.12,.05);dial.rotation.x=Math.PI/2;box(p,C.brass,-.45,item.h*.55,item.d/2+.13,.035,.42,.06);for(const y of [.4,1.25])box(p,0x253b33,-item.w*.43,y,item.d/2+.075,.06,.26,.07);break;}
  }
}
function addFloor(root,room,floors){
  const [x0,x1,z0,z1]=room.bounds,color=new THREE.MeshStandardMaterial({color:room.color,roughness:.87});
  const floor=box(root,color,(x0+x1)/2,.025,(z0+z1)/2,x1-x0,.045,z1-z0,false);floor.userData.room=room.key;floors.set(room.key,floor);
  const lines=[],wood=['desk','library','meeting'].includes(room.key),step=wood?.45:1.2;
  for(let z=z0+step;z<z1;z+=step)lines.push(x0,.052,z,x1,.052,z);
  if(!wood)for(let x=x0+step;x<x1;x+=step)lines.push(x,.052,z0,x,.052,z1);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));root.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:wood?0x8e775a:0xffffff,transparent:true,opacity:wood?.13:.22})));
}
function addWall(root,wall){
  if(wall.elevator)return;
  const h=wall.displayHeight||wall.h,color=wall.feature?C.sage:wall.secure?0xc3c9ba:C.ivory;
  box(root,color,wall.x,h/2+.055,wall.z,wall.w,h,wall.d);
  box(root,wall.secure?C.forest:0xa89d83,wall.x,.13,wall.z,wall.w+.018,.13,wall.d+.018,false);
  box(root,wall.feature?C.walnut:0xd0c6b1,wall.x,h+.07,wall.z,wall.w+.035,.07,wall.d+.035,false);
  if(wall.feature){for(let z=wall.z-wall.d/2+.1;z<wall.z+wall.d/2-.08;z+=.23)box(root,0x8c917b,wall.x-.105,h*.5,z,.04,h-.15,.025,false);}
}
function addDoor(root,door){
  const wall=EXECUTIVE_WALLS.find(w=>w.axis===door.axis&&Math.abs(w[door.axis==='x'?'z':'x']-door[door.axis==='x'?'z':'x'])<.01&&!w.outer),h=wall?.displayHeight||1.2,secure=door.kind==='secure',color=secure?C.forest:C.walnut;
  const p=group(root,door.x,door.z,door.axis==='z'?Math.PI/2:0);
  for(const side of [-1,1])box(p,color,side*(door.w/2-.025),h/2+.06,0,.075,h,.23);
  if(h>=1.9)box(p,color,0,h+.065,0,door.w+.05,.075,.23);
  box(p,secure?0x6a7f6d:C.brass,0,.06,0,door.w-.03,.025,.24,false);
  const leaf=EXECUTIVE_DOOR_LEAVES.find(item=>item.doorId===door.id),lh=h-.12;
  box(root,secure?0x566b5d:0xa18b6b,leaf.x,lh/2+.08,leaf.z,leaf.w,lh,leaf.d);
  // The physical leaf is fully open; the route planner includes its footprint.
  if(secure){box(p,0x354c3f,door.w/2+.14,.95,.15,.13,.22,.045);box(p,0xb8ceac,door.w/2+.14,.99,.18,.07,.045,.01,false);}
}
function window(root,x,z,w){
  box(root,0xb9c9be,x,1.77,z,w,1.3,.055,false);box(root,0xd1dcd2,x,1.9,z+.035,w-.12,.96,.025,false);
  for(const offset of [-w/2,w/2,0])box(root,C.ivory,x+offset,1.77,z+.065,.065,1.43,.08,false);
  for(const y of [1.1,2.45])box(root,C.ivory,x,y,z+.07,w+.15,.075,.1,false);
  box(root,0xcdbf9e,x,1.04,z+.12,w+.25,.08,.25,false);
}
export function buildExecutiveSuite(root,floors){
  box(root,0xa8b0a2,-2.1,-.33,0,20.25,.55,14.45);box(root,C.brass,-2.1,-.045,0,20.04,.055,14.24);box(root,C.stone,-2.1,-.005,0,19.9,.05,14.1);
  for(const room of EXECUTIVE_ROOM_LAYOUT)addFloor(root,room,floors);
  for(const bounds of EXECUTIVE_GALLERY_REGIONS){const [x0,x1,z0,z1]=bounds;box(root,0xe9e3d6,(x0+x1)/2,.026,(z0+z1)/2,x1-x0,.045,z1-z0,false);}
  // Rugs give each room a distinct scale and a composed furniture group.
  rug(root,-8.9,-4.65,4.75,3.55,0xd4c5af,0xb19a7a);
  rug(root,-5.2,4.65,11.25,3.9,0xc5b79f,0xa58e6d);
  rug(root,-2.1,-.65,5.9,4.55,0x728474,0xb8a37b);
  rug(root,-1.9,-5.1,5.9,1.8,0xb5a08b,0x9b836c);
  rug(root,4.65,-4.35,4.9,4.3,0xc6bb9f,0xa99b7d);
  // Quiet brass floor inlays guide arrival and the short, enclosed private gallery.
  for(const z of [-.55,.8])box(root,C.brass,-10.5,.063,z,2.45,.012,.017,false);
  box(root,C.brass,2.55,.063,3.95,.018,.012,4.5,false);box(root,C.brass,4.55,.063,1.65,4.0,.012,.018,false);
  for(const wall of EXECUTIVE_WALLS)addWall(root,wall);
  for(const door of EXECUTIVE_DOORS)addDoor(root,door);
  window(root,-8.9,-6.87,3.7);window(root,4.7,-6.87,4.3);
  for(const item of EXECUTIVE_FURNITURE)buildFurniture(root,item);
  art(root,-11.88,1.9,-4.3,1.6,.95,Math.PI/2,0);
  art(root,-5.69,1.45,.15,1.65,.7,Math.PI/2,1);
  art(root,5.65,1.75,-.69,1.6,.68,0,1);
  // Vault document trays and the gallery's small sculpture complete the rear rooms.
  for(let i=0;i<3;i++)box(root,[C.forest,C.clay,C.ivory][i],5.6,1.35+i*.055,2.85,.72,.045,.33);
  ball(root,C.brass,5.65,1.05,-.44,.16,.22,.16);cylinder(root,C.darkWood,5.65,.9,-.44,.14,.07);
  return floors;
}

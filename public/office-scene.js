import * as THREE from './vendor/three/three.module.js';
import { staffAppearance } from './staff-appearance.js';
import { OfficeOwner } from './office-owner.js';
import { buildExecutiveSuite as buildExecutiveInterior } from './office-executive-scene.js';
import { SECRETARY_STATION, EXECUTIVE_INTERACTIONS } from './office-executive.js';
import { OfficeNavigator, OfficeWalker, roomAt, ROOM_LAYOUT, EXECUTIVE_ROOM_LAYOUT, EXECUTIVE_WALLS, WALLS, DOORS, FURNITURE } from './office-navigation.js';
import { SecretaryRoutine, SECRETARY_STOPS } from './office-secretary.js';
import { daylightAt, sunriseSunset } from './solar-time.js';
import { OfficeVisitor } from './office-visitor.js';

const SECRETARY_LOOKS=[
 {top:0xd98f9f,bottom:0xe7d7b9,cut:'skirt',style:'blouse',hair:'long'},
 {top:0x52677b,bottom:0xd8d0c2,cut:'skirt',style:'blazer',hair:'ponytail'},
 {top:0x8eb6bd,bottom:0x35464a,cut:'trousers',style:'cardigan',hair:'bob'},
 {top:0xeee8df,bottom:0x76647e,cut:'skirt',style:'blouse',hair:'braid'},
 {top:0x71836b,bottom:0xdacaa8,cut:'skirt',style:'blazer',hair:'half-up'},
 {top:0xb5a0cb,bottom:0x4d6478,cut:'skirt',style:'blouse',hair:'bun'},
 {top:0x8c5862,bottom:0x8d8172,cut:'trousers',style:'cardigan',hair:'low-ponytail'},
 {top:0xc58c62,bottom:0xc58c62,cut:'dress',style:'dress',hair:'long'},
 {top:0x628d83,bottom:0x628d83,cut:'dress',style:'dress',hair:'ponytail'},
 {top:0x9b6573,bottom:0x9b6573,cut:'dress',style:'dress',hair:'half-up'},
];
export function secretaryLookForDate(date=new Date()){
 const day=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
 const index=((Math.floor(day/86400000)%SECRETARY_LOOKS.length)+SECRETARY_LOOKS.length)%SECRETARY_LOOKS.length;
 return {day,look:SECRETARY_LOOKS[index]};
}
const ROOM_NAMES={library:'자료실',studio:'개발실',server:'서버실',research:'정보검색실',meeting:'회의실',desk:'대기실'};
const EXECUTIVE_ROOM_NAMES={library:'서재 · 기록실',studio:'비서실',server:'금고 · 기밀문서실',research:'프라이빗 라운지',meeting:'이사회실',desk:'CEO 집무실',reception:'접견실'};
const TASK_NAMES={library:'책 읽는 중',studio:'코드 수정 중',server:'명령 실행 중',research:'자료 찾는 중',meeting:'생각 정리 중',desk:'요청 확인 중',reception:'방문·요청을 확인 중'};
const WORK_ACTION_NAMES={library:{primary:'자료를 읽는 중'},studio:{primary:'키보드로 코드를 작성 중'},server:{rack:'중요 기록을 확인 중',terminal:'보안 기록을 열람 중'},research:{primary:'컴퓨터로 정보를 검색 중',search:'자료를 찾아 살펴보는 중'},meeting:{primary:'문서를 검토 중',board:'칠판에 아이디어를 정리 중'},desk:{primary:'요청 내용을 확인 중'},reception:{primary:'방문객과 요청을 확인 중'}};
const materials=new Map();
const cubeGeometry=new THREE.BoxGeometry(1,1,1);
const ballGeometry=new THREE.SphereGeometry(1,20,14);
const cylinderGeometry=new THREE.CylinderGeometry(1,1,1,16);
const DAY_BACKGROUND=new THREE.Color('#eef2ed');
const NIGHT_BACKGROUND=new THREE.Color('#68747d');
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.025}));return materials.get(color);}
function mesh(parent,geometry,color,x,y,z,sx=1,sy=1,sz=1,shadow=true){const item=new THREE.Mesh(geometry,typeof color==='object'?color:material(color));item.position.set(x,y,z);item.scale.set(sx,sy,sz);item.castShadow=shadow;item.receiveShadow=true;parent.add(item);return item;}
const box=(parent,color,x,y,z,w,h,d,shadow=true)=>mesh(parent,cubeGeometry,color,x,y,z,w,h,d,shadow);
const ball=(parent,color,x,y,z,sx,sy=sx,sz=sx,shadow=true)=>mesh(parent,ballGeometry,color,x,y,z,sx,sy,sz,shadow);
const cylinder=(parent,color,x,y,z,r,h,shadow=true)=>mesh(parent,cylinderGeometry,color,x,y,z,r,h,r,shadow);
const group=(parent,x=0,y=0,z=0)=>{const item=new THREE.Group();item.position.set(x,y,z);parent.add(item);return item;};
function screenTexture(){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#29483d';ctx.fillRect(0,0,256,160);ctx.fillStyle='#719b82';ctx.font='15px monospace';ctx.fillText('a little idea.js',17,24);const widths=[137,98,174,120,85,150];for(let i=0;i<6;i++){ctx.fillStyle=['#afc9a0','#8eb7bc','#d0b88c'][i%3];ctx.fillRect(20+(i%3)*10,43+i*16,widths[i],4);}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
const SCREEN=new THREE.MeshBasicMaterial({map:screenTexture(),side:THREE.DoubleSide});
function desk(parent,item){const g=group(parent,item.x,0,item.z);const turned=Math.abs(Math.sin(item.rotation||0))>.5;const {h}=item,w=item.type==='reading-table'?item.w:turned?item.d:item.w,d=item.type==='reading-table'?item.d:turned?item.w:item.d;g.rotation.y=item.rotation||0;box(g,0xe2cbaa,0,h,0,w,.13,d);for(const x of [-w*.4,w*.4])for(const z of [-d*.32,d*.32])box(g,0xb39b7c,x,h/2,z,.09,h,.09);if(item.type!=='reading-table'){box(g,0xcdb695,w*.32,h*.53,.02,w*.2,h*.8,d*.8);for(let i=0;i<2;i++)box(g,0xb1997b,w*.32,h*.43+i*.22,d*.42,.20,.025,.015,false);}
if(item.type==='reading-table'){const bookOffset=Math.min(.72,Math.max(.22,w*.2));for(const offset of [-bookOffset,bookOffset]){const book=group(g,offset,h+.0625,0);const left=box(book,0xfff8df,-.18,.02,0,.35,.035,.48);left.rotation.z=-.13;const right=box(book,0xfbf3da,.18,.02,0,.35,.035,.48);right.rotation.z=.13;for(let i=0;i<4;i++)box(book,0xcbbd97,-.16,.048,-.15+i*.08,.21,.004,.007,false);}return;}
const monitor=group(g,-w*.12,h+.43,-d*.1);box(monitor,0xd2d6c8,0,-.33,0,.13,.29,.10);box(monitor,0xb7c2b4,0,-.42,.02,.48,.035,.25);box(monitor,0xe9eadf,0,0,0,1.05,.65,.09);mesh(monitor,new THREE.PlaneGeometry(.93,.53),SCREEN,0,.012,.052);box(g,0xe5e8dc,-w*.1,h+.085,d*.3,.92,.03,.25);for(let i=0;i<3;i++)box(g,0xbcc9b5,-w*.1,h+.105,d*.24+i*.055,.78,.003,.015,false);cup(g,w*.33,h+.18,d*.19,1);return g;}
function cup(parent,x,y,z,scale=1){const g=group(parent,x,y,z);cylinder(g,0xfff7df,0,0,0,.105*scale,.17*scale);cylinder(g,0x97816a,0,.088*scale,0,.083*scale,.006*scale,false);const handle=mesh(g,new THREE.TorusGeometry(.065*scale,.018*scale,6,12),0xfff7df,.12*scale,.005,0);return g;}
function secretaryTray(parent,{snacks=false,empty=false}={}){
 const tray=group(parent);box(tray,0xb89b70,0,0,0,.66,.035,.40);box(tray,0xe4d4b2,0,.022,0,.60,.014,.34,false);
 if(!empty){cup(tray,-.15,.08,-.03,.55);if(!snacks)cup(tray,.15,.08,-.03,.55);else{cylinder(tray,0xfff7df,.16,.044,0,.12,.018);for(const [x,z]of [[.12,-.03],[.20,-.025],[.16,.045]]){cylinder(tray,0xc59b61,x,.063,z,.033,.018);ball(tray,0x84654a,x+.008,.075,z,.007,.004,.007,false);}}}
 return tray;
}
function chair(parent,item){const g=group(parent,item.x,0,item.z);g.rotation.y=item.rotation||0;const color=item.room==='meeting'?0xb6a3c4:0x8eaa86;cylinder(g,0x9aab98,0,.27,0,.045,.5);box(g,color,0,.53,0,.65,.13,.62);box(g,color,0,.88,-.26,.64,.54,.13);for(let i=0;i<5;i++){const spoke=box(g,0x879783,0,.10,0,.06,.045,.65);spoke.rotation.y=i*Math.PI/2.5;}return g;}
function bookshelf(parent,item){const g=group(parent,item.x,0,item.z);g.rotation.y=item.rotation||0;box(g,0xb59a76,0,item.h/2,-.15,item.w,item.h,.15);for(const x of [-item.w/2,item.w/2])box(g,0xd1b58d,x,item.h/2,0,.10,item.h,item.d);for(let row=0;row<4;row++){const y=.10+row*.51;box(g,0xddc6a2,0,y,0,item.w,.085,item.d);const colors=[0xa6b18b,0xc29d7d,0x9caec0,0xb6a0ba,0xd7bd87];for(let i=0;i<7;i++){const bh=.26+(i%3)*.055;box(g,colors[(i+row)%5],-item.w*.39+i*item.w*.13,y+bh/2+.05,.02,item.w*.105,bh,item.d*.63,false);}}box(g,0xe1cdaf,0,item.h,0,item.w+.1,.09,item.d+.04);}
function plant(parent,item){const g=group(parent,item.x,0,item.z);cylinder(g,0xd8bfa2,0,.24,0,.28,.47);cylinder(g,0xe9d5b8,0,.45,0,.30,.12);cylinder(g,0x7c6951,0,.52,0,.26,.025,false);cylinder(g,0x789063,0,.88,0,.025,.78,false);for(let i=0;i<7;i++){const angle=i*2.4;const leaf=ball(g,[0x83a36e,0xa3bb86,0x71945e][i%3],Math.cos(angle)*.23,.74+i*.085,Math.sin(angle)*.23,.28,.09,.14,false);leaf.rotation.z=Math.cos(angle)*.45;leaf.rotation.y=angle;}return g;}
function sofa(parent,item){const g=group(parent,item.x,0,item.z);const w=Math.max(item.w,item.d),d=Math.min(item.w,item.d);g.rotation.y=(item.rotation||0)+(item.w<item.d?Math.PI/2:0);box(g,0xb99a78,0,.40,0,w,.42,d);box(g,0xcfb18b,0,.76,-d*.38,w,.69,.22);const count=Math.round(w/1.1);for(let i=0;i<count;i++){const x=-w/2+(i+.5)*w/count;box(g,0xe2c9a7,x,.66,.05,w/count-.08,.20,d*.72);box(g,0xdbc2a0,x,.91,-d*.27,w/count-.07,.48,.18);}for(const x of [-w/2+.09,w/2-.09])box(g,0xc8a780,x,.73,0,.21,.65,d);for(const x of [-w*.39,w*.39])for(const z of [-d*.34,d*.34])box(g,0x8b765d,x,.15,z,.09,.3,.09);}
export function furniture(parent,item,lights){switch(item.type){case 'computer-desk':case 'reading-table':desk(parent,item);break;case 'bookshelf':bookshelf(parent,item);break;case 'plant':plant(parent,item);break;case 'sofa':sofa(parent,item);break;case 'chair':chair(parent,item);break;
case 'executive-desk':{const g=group(parent,item.x,0,item.z),isOwner=item.room==='desk',wood=isOwner?0x563b2a:0x92734d;g.rotation.y=item.rotation||0;box(g,wood,0,item.h,0,item.w,.15,item.d);box(g,isOwner?0xc9a75d:0xd4c098,0,item.h+.085,0,item.w-.12,.035,item.d-.12);for(const x of [-item.w*.38,item.w*.38])box(g,isOwner?0x38291f:0x745b3d,x,item.h*.48,0,.48,item.h*.9,item.d*.84);box(g,isOwner?0x38291f:0x745b3d,0,item.h*.25,0,item.w*.22,item.h*.45,item.d*.6);if(isOwner){box(g,0xf3ead4,0,item.h+.115,0,.72,.012,.42);box(g,0x967d50,0,item.h+.13,0,.62,.01,.32);}else{box(g,0xc9d3c1,-.18,item.h+.16,0,.56,.03,.36);cup(g,.55,item.h+.12,.15,.7);}break;}
case 'rack':{const g=group(parent,item.x,0,item.z);box(g,0x657d89,0,item.h/2,0,item.w,item.h,item.d);box(g,0x91a4ac,0,item.h+.025,0,item.w+.04,.07,item.d+.04);for(let i=0;i<6;i++){const y=.30+i*.35;box(g,0x425c69,0,y,item.d/2+.012,item.w*.86,.24,.035);for(let j=0;j<2;j++){const ledMaterial=new THREE.MeshStandardMaterial({color:0xa7d8a3,emissive:0x75b96e,emissiveIntensity:.5,roughness:.5});const led=ball(g,ledMaterial,-item.w*.3+j*.15,y,item.d/2+.044,.027,.027,.013,false);lights.push({mesh:led,room:item.room,offset:i*.5+j});}for(let line=0;line<3;line++)box(g,0x819ba6,.18,y-.055+line*.055,item.d/2+.035,.48,.012,.008,false);}break;}
case 'cabinet':{const g=group(parent,item.x,0,item.z);g.rotation.y=item.rotation||0;box(g,0xccb895,0,item.h/2,0,item.w,item.h,item.d);box(g,0xe4d4b5,0,item.h+.025,0,item.w+.04,.07,item.d+.04);for(let i=0;i<3;i++)box(g,0xa68f6d,0,.20+i*.3,item.d/2+.01,.26,.035,.03,false);if(item.room==='desk'){box(g,0x688078,0,item.h+.3,0,.50,.50,.33);cup(g,0,item.h+.10,.18,.8);}break;}
case 'meeting-table':case 'coffee-table':{const g=group(parent,item.x,0,item.z);box(g,item.type==='meeting-table'?0xd4b98f:0xead3ad,0,item.h,0,item.w,.14,item.d);for(const x of [-item.w*.38,item.w*.38])for(const z of [-item.d*.3,item.d*.3])box(g,0xae9270,x,item.h/2,z,.09,item.h,.09);if(item.type==='meeting-table'){for(const x of [-.9,.25]){box(g,0xfff9df,x,item.h+.085,0,.50,.025,.38);box(g,0xb4c8a0,x+.07,item.h+.103,.03,.16,.003,.04,false);}cup(g,1.2,item.h+.13,-.2,.8);}else{cup(g,-.3,item.h+.16,0);box(g,0xb0ba93,.34,item.h+.06,0,.5,.08,.36);}break;}
case 'whiteboard':{const g=group(parent,item.x,0,item.z);box(g,0xb8b2bb,0,1.6,0,item.w,1.16,.13);box(g,0xfffdf4,0,1.6,.08,item.w-.12,1.04,.025);for(const x of [-item.w*.38,item.w*.38])box(g,0xa2a799,x,.55,0,.045,1.1,.08);for(let i=0;i<3;i++){box(g,[0xe1d69b,0xb3c99e,0xc6b3d5][i],-.65+i*.65,1.81,.103,.40,.31,.01,false);box(g,0xc0c6ae,-.65+i*.65,1.4,.104,.35,.025,.012,false);}break;}
case 'globe':{const g=group(parent,item.x,0,item.z);cylinder(g,0xc1b18c,0,.45,0,.055,.9);cylinder(g,0xd7c5a3,0,.08,0,.32,.10);ball(g,0x91b9b2,0,1.15,0,.49);for(let i=0;i<4;i++){const patch=ball(g,0xc1d2a0,Math.sin(i*1.7)*.38,1.15+Math.cos(i*1.7)*.25,Math.cos(i*2)*.37,.22,.16,.07,false);patch.rotation.y=i*1.7;}const ring=mesh(g,new THREE.TorusGeometry(.52,.015,6,40),0xe4d8b9,0,1.15,0);ring.rotation.z=.3;for(const angle of [0,Math.PI/2]){const line=mesh(g,new THREE.TorusGeometry(.495,.007,4,40),0xc8dfcf,0,1.15,0);line.rotation.y=angle;}break;}}
}
export function disposeCharacter(model){
 const disposed=new Set();model.root.traverse(object=>{if(!object.isMesh)return;const geometry=object.geometry;if(![cubeGeometry,ballGeometry,cylinderGeometry].includes(geometry)&&!disposed.has(geometry)){geometry.dispose();disposed.add(geometry);}});model.selection.material.dispose();
}
function staffClothing(body,look){
 const {style,accent,pattern}=look;
 if(style==='hoodie'){
  const hood=mesh(body,new THREE.TorusGeometry(.16,.055,6,16),look.top,0,.86,-.07);hood.rotation.x=.6;
  box(body,accent,0,.51,.221,.26,.10,.025,false);
  for(const x of [-.055,.055])box(body,accent,x,.80,.222,.012,.15,.018,false);
 }else if(style==='blazer'||style==='vest'){
  box(body,accent,0,.72,.216,.15,.28,.025,false);
  for(const side of [-1,1]){const lapel=box(body,look.top,side*.073,.80,.242,.075,.22,.025,false);lapel.rotation.z=side*.25;}
  if(style==='vest')for(const y of [.67,.59,.51])ball(body,accent,0,y,.237,.014,.014,.008,false);
 }else if(style==='cardigan'){
  box(body,accent,0,.70,.226,.045,.37,.025,false);
  for(const y of [.80,.70,.60])ball(body,look.bottom,0,y,.247,.014,.014,.008,false);
 }else if(style==='polo'){
  for(const side of [-1,1]){const collar=box(body,accent,side*.05,.88,.19,.09,.07,.035,false);collar.rotation.z=side*.28;}
  box(body,accent,0,.80,.224,.025,.12,.022,false);
 }else if(style==='sweater'){
  for(const x of [-.15,-.075,0,.075,.15])box(body,accent,x,.46,.207,.012,.07,.012,false);
  cylinder(body,accent,0,.91,0,.135,.045);
 }else if(style==='rugby'){
  for(const y of [.56,.74])box(body,accent,0,y,.225,.36,.07,.025,false);
  box(body,accent,0,.89,.19,.18,.07,.035,false);
 }else if(style==='overshirt'){
  for(const x of [-.115,.115]){box(body,accent,x,.73,.228,.10,.11,.025,false);box(body,look.bottom,x,.79,.244,.105,.025,.018,false);}
  box(body,accent,0,.64,.232,.018,.34,.018,false);
 }
 if(pattern==='stripes')for(const y of [.60,.67,.74])box(body,accent,0,y,.256,.34,.018,.012,false);
 if(pattern==='chest-band')box(body,accent,0,.66,.257,.36,.055,.015,false);
 if(pattern==='piping')for(const side of [-1,1])box(body,accent,side*.18,.65,.194,.025,.28,.018,false);
}
export function createCharacter(parent,palette='studio',appearance={}){
 const characterIndex=Number(appearance.index)||0,styleIndex=characterIndex%8;
 const staff=!appearance.secretary&&!appearance.owner&&!appearance.pregnant;
 const look=staffAppearance(characterIndex);
 const hairStyle=appearance.pregnant?'ponytail':staff?look.hairStyle:['short','curls','short','curls','long','bun','long','swept'][styleIndex];
 const hairColor=appearance.secretary?0xd4ad52:appearance.owner?0x503f36:appearance.pregnant?0x927b63:look.hair;
 const skin=appearance.secretary||appearance.owner||appearance.pregnant?0xf0c3a4:look.skin;
 const outfit=appearance.secretaryOutfit||SECRETARY_LOOKS[0];
 const root=group(parent),body=group(root),coat=appearance.pregnant?0xc28da5:appearance.owner?0x354f5b:appearance.secretary?outfit.top:look.top;
 if(staff){root.scale.setScalar(look.height);body.scale.x=look.width;}
 const secretaryTrousers=appearance.secretary&&outfit.cut==='trousers';
 const legOffset=appearance.secretary ? .09 : .13;
 const legL=group(body,-legOffset,.30,0),legR=group(body,legOffset,.30,0);
 for(const leg of [legL,legR]){cylinder(leg,appearance.secretary?(secretaryTrousers?outfit.bottom:skin):staff?look.bottom:0x6b7562,0,secretaryTrousers?-.10:-.12,0,appearance.secretary?(secretaryTrousers?.082:.065):.09,secretaryTrousers?.36:.30);ball(leg,appearance.secretary?0x716659:staff?look.shoes:0x635e4f,0,-.25,.065,appearance.secretary?.085:.115,appearance.secretary?.065:.075,appearance.secretary?.15:.17);}
 let belly=null;
 if(appearance.pregnant){
  mesh(body,new THREE.CapsuleGeometry(.22,.24,6,16),coat,0,.66,0,1,1,.95);
  mesh(body,new THREE.CylinderGeometry(.23,.29,.39,28),coat,0,.42,.025,1,1,.88);
  belly=ball(body,coat,0,.59,.115,.23,.22,.17);belly.name='maternity-belly';
  box(body,0xf4e6d8,0,.83,.21,.15,.045,.025,false);
 }else if(appearance.secretary){
  mesh(body,new THREE.CapsuleGeometry(.22,.16,6,12),coat,0,.725,0,1,.85,1);
  if(outfit.cut==='skirt'){mesh(body,new THREE.CylinderGeometry(.215,.205,.25,28),outfit.bottom,0,.42,0,1,1,.80);mesh(body,cylinderGeometry,new THREE.Color(outfit.bottom).offsetHSL(0,-.08,-.12).getHex(),0,.55,0,.218,.035,.177);}
  else if(outfit.cut==='dress'){
   mesh(body,new THREE.CylinderGeometry(.215,.205,.42,28),outfit.bottom,0,.50,0,1,1,.80);
   mesh(body,cylinderGeometry,new THREE.Color(outfit.bottom).offsetHSL(0,-.08,-.12).getHex(),0,.565,0,.218,.024,.177);
  }
  else mesh(body,new THREE.CylinderGeometry(.21,.17,.15,28),outfit.bottom,0,.405,0,1,1,.80);
  if(outfit.style==='blazer'){
   box(body,0xf4eee2,0,.72,.214,.13,.25,.018,false);
   for(const side of [-1,1]){const lapel=box(body,0xe4ded3,side*.073,.79,.231,.075,.17,.018,false);lapel.rotation.z=side*.22;}
  }else if(outfit.style==='cardigan'){
   box(body,new THREE.Color(coat).offsetHSL(0,-.03,-.10).getHex(),0,.73,.222,.045,.25,.025,false);
   for(const y of [.78,.70,.62])ball(body,0xf2e8d6,0,y,.239,.012,.012,.008,false);
  }
 }else mesh(body,new THREE.CapsuleGeometry(.22,.25,6,12),coat,0,.62,0);
 if(staff)staffClothing(body,look);
 ball(body,skin,0,.94,.07,.12,.14,.11,false);
 const armL=group(body,-.255,.80,0),armR=group(body,.255,.80,0);
 for(const arm of [armL,armR]){mesh(arm,new THREE.CapsuleGeometry(.085,.24,4,10),staff&&look.style==='vest'?look.accent:coat,0,-.17,0);ball(arm,skin,0,-.32,.015,.075);}
 const head=group(body,0,1.2,0);
 if(staff)head.scale.set(look.faceWidth,look.faceHeight,1);
 ball(head,skin,0,0,0,.35,.37,.31);
 // Hair covers the scalp and back; the face and rounded ears remain exposed.
 mesh(head,new THREE.SphereGeometry(1,20,14,0,Math.PI*2,0,1.2),hairColor,0,.005,-.015,.365,.385,.325);
 mesh(head,new THREE.SphereGeometry(1,20,14,Math.PI,Math.PI,0,2.2),hairColor,0,0,-.015,.365,.385,.325);
 for(const side of [-1,1]){ball(head,skin,side*.347,-.015,0,.065,.10,.055);ball(head,0xdca78d,side*.389,-.015,.02,.018,.052,.03,false);ball(head,hairColor,side*.315,.13,.045,.045,.13,.08);}
 if(appearance.secretary){
  const hair=outfit.hair;
  if(hair==='bob'){
   ball(head,hairColor,0,-.10,-.20,.30,.27,.17);for(const side of [-1,1])ball(head,hairColor,side*.30,-.12,-.04,.09,.27,.13);
  }else if(hair==='bun'){
   ball(head,hairColor,0,-.10,-.23,.16,.16,.14);for(const side of [-1,1])ball(head,hairColor,side*.30,-.17,-.05,.09,.30,.14);
  }else{
   ball(head,hairColor,0,-.25,-.22,.30,.49,.14);
   const length=hair==='long'||hair==='braid'||hair==='half-up' ? .46 : .34;
   for(const side of [-1,1])ball(head,hairColor,side*.30,-.18-length*.28,-.06,.09,length,.14);
   if(hair==='ponytail'||hair==='low-ponytail'){
    const pony=mesh(head,new THREE.CapsuleGeometry(.065,.42,5,8),hairColor,hair==='ponytail' ? .23 : .12,hair==='ponytail' ? -.36 : -.43,-.20,1,1,1,false);pony.rotation.z=hair==='ponytail' ? .16 : -.12;
    ball(head,0xe4c36f,hair==='ponytail' ? .22 : .12,hair==='ponytail' ? -.10 : -.18,-.16,.055,.045,.045,false);
   }
   if(hair==='half-up')ball(head,0xe4c36f,0,.19,-.20,.12,.05,.04,false);
   if(hair==='braid')for(let i=0;i<5;i++)ball(head,hairColor,.30,-.34-i*.085,-.105,.055,.07,.065,false);
  }
 }else if(hairStyle==='bob'){
  ball(head,hairColor,0,-.10,-.20,.31,.29,.18);
  for(const side of [-1,1])ball(head,hairColor,side*.30,-.11,-.025,.09,.29,.14);
 }else if(hairStyle==='ponytail'){
  ball(head,hairColor,0,-.14,-.21,.30,.24,.16);
  for(const side of [-1,1])ball(head,hairColor,side*.30,-.12,-.03,.08,.22,.12);
  const pony=mesh(head,new THREE.CapsuleGeometry(.065,.36,5,8),hairColor,.17,-.31,-.23,1,1,1,false);pony.rotation.z=-.10;
  ball(head,0xe4c36f,.17,-.12,-.17,.05,.04,.04,false);
 }else if(hairStyle==='curls'){
  // Tight curls add a round, textured silhouette.
  for(let row=0;row<2;row++)for(let i=0;i<7;i++){const angle=(i/7)*Math.PI*2;ball(head,hairColor,Math.cos(angle)*.27,.17+row*.09,Math.sin(angle)*.22,.105,.105,.10);}
 }else if(hairStyle==='long'){
  // Longer, loose hair falls behind the ears.
  ball(head,hairColor,0,-.18,-.22,.30,.40,.16);
  for(const side of [-1,1])ball(head,hairColor,side*.30,-.22,-.04,.09,.39,.13);
 }else if(hairStyle==='bun'){
  // A compact top knot with tapered side locks.
  ball(head,hairColor,0,.29,-.08,.20,.19,.18);
  for(const side of [-1,1])ball(head,hairColor,side*.31,-.10,-.03,.075,.23,.12);
  ball(head,0xe4c36f,0,.30,.02,.055,.04,.04,false);
 }else if(hairStyle==='swept'){
  // Swept fringe and sideburns create a sharper short-hair profile.
  ball(head,hairColor,.08,.22,.24,.20,.07,.06);
  for(const side of [-1,1])ball(head,hairColor,side*.31,-.12,-.02,.07,.23,.12);
 }
 const eyes=group(head);
 for(const x of staff?[-look.eyeSpacing,look.eyeSpacing]:[-.115,.115]){ball(eyes,0x514e41,x,.035,.298,.028,.040,.018,false);ball(eyes,0xffffff,x+.008,.048,.314,.008,.009,.005,false);ball(head,0xedb9a7,x<0?-.216:.216,-.055,.246,.043,.025,.012,false);}
 ball(head,skin,0,-.025,.312,.033,.045,.035,false);
 const smile=mesh(head,new THREE.TorusGeometry(.044,.009,5,12,Math.PI),0x9b785d,0,-.10,.302,1,1,1,false);smile.rotation.z=Math.PI;
 const glare=appearance.pregnant?group(head):null;
 if(glare){
  for(const side of [-1,1]){const brow=box(glare,hairColor,side*.115,.115,.306,.12,.024,.018,false);brow.rotation.z=side*.28;}
  box(glare,0x9b785d,0,-.105,.309,.08,.012,.012,false);glare.visible=false;
 }
 const fringe=ball(head,hairColor,appearance.secretary ? .015 : -.065,.216,.263,appearance.secretary ? .17 : .13,.045,.035,false);fringe.rotation.z=.28;
 if(appearance.secretary){for(const side of [-1,1]){const brow=box(head,0x8d6937,side*.115,.115,.289,.09,.018,.014,false);brow.rotation.z=side*.08;}}
 if(appearance.accessory==='glasses'){const frame=appearance.secretary?0xb18b55:0x76617e;for(const x of staff?[-look.eyeSpacing,look.eyeSpacing]:[-.115,.115])mesh(head,new THREE.TorusGeometry(.095,.013,6,24),frame,x,.035,.323,1,1,1,false);box(head,frame,0,.035,.327,.04,.015,.015,false);}
 if(appearance.owner){
  box(body,0xf9f0d7,0,.77,.215,.19,.24,.035);const tie=box(body,0xd4b650,0,.67,.24,.055,.24,.035);tie.rotation.z=.04;
  cylinder(head,0xd7b94f,0,.35,0,.30,.09);for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;mesh(head,new THREE.ConeGeometry(.07,.22,4),0xe1c563,Math.sin(angle)*.25,.49,Math.cos(angle)*.25);}
  ball(body,0xe2c76d,.16,.76,.23,.07,.07,.025,false);box(body,0x665026,.16,.76,.26,.013,.073,.008,false);
 }else if(!appearance.pregnant){
 if(appearance.secretary){for(const side of [-1,1]){const collar=box(body,0xf4e4db,side*.055,.87,.192,.075,.10,.025,false);collar.rotation.z=side*.25;}if(outfit.style==='blouse')for(const y of [.78,.69,.60])ball(body,0xfff4e6,0,y,.224,.012,.012,.008,false);box(body,0xc4a45c,.14,.78,.218,.075,.045,.018,false);}
  if(!staff&&(styleIndex===0||styleIndex===4))box(body,0xf3edd6,0,.5,.215,.28,.035,.025,false);
  if(!staff&&(styleIndex===1||styleIndex===5))for(const side of [-1,1]){const lapel=box(body,0xf3edd6,side*.075,.78,.218,.10,.20,.018,false);lapel.rotation.z=side*.22;}
  if(!staff&&(styleIndex===2||styleIndex===6)){box(body,0xf3edd6,0,.89,.19,.18,.10,.035,false);box(body,0xe1bd72,0,.70,.226,.045,.22,.02,false);}
  if(!staff&&(styleIndex===3||styleIndex===7))box(body,0xf3edd6,-.11,.70,.225,.11,.12,.025,false);
  const accent=staff?look.accent:palette==='server'?0x537ea3:palette==='meeting'?0x8b6caa:0x638152;
  if(appearance.accessory==='beanie'){ball(head,0x697e4b,0,.24,0,.36,.19,.32);box(head,0xb1bd8a,0,.23,.27,.55,.08,.08);ball(head,0xc2cca1,0,.42,0,.09);}
  if(appearance.accessory==='cap'){ball(head,0xc9a34e,0,.23,0,.36,.14,.32);box(head,0xb69043,0,.24,.34,.48,.045,.26);}
  if(appearance.accessory==='headphones'){const band=mesh(head,new THREE.TorusGeometry(.39,.042,8,24,Math.PI),accent,0,.04,0);for(const x of [-.39,.39])ball(head,accent,x,.04,.03,.075,.14,.13);}
  if(appearance.accessory==='scarf'){cylinder(body,0x4f8d7c,0,.98,0,.23,.12);box(body,0x6da592,.12,.78,.23,.13,.34,.045);}
  if(appearance.accessory==='bowtie')for(const side of [-1,1]){const wing=box(body,0x476b86,side*.065,.91,.23,.12,.08,.045);wing.rotation.z=side*.35;}
  if(appearance.accessory==='freckles')for(const side of [-1,1])for(let i=0;i<3;i++)ball(head,0xb18b65,side*(.14+i*.028),-.03+(i%2)*.035,.288-i*.013,.009,.009,.006,false);
 }
 const props={};
 const laptop=props.laptop=group(body,0,.64,.27);box(laptop,0x617e67,0,.02,0,.50,.30,.04);box(laptop,0xd4ddc3,0,-.14,.07,.55,.025,.17);for(const x of [-.10,.10]){const chevron=box(laptop,0xd4ddc3,x,.04,.025,.05,.012,.01,false);chevron.rotation.z=x<0?.6:-.6;}
 const book=props.book=group(body,0,.65,.28);for(const side of [-1,1]){const page=box(book,0xfff7df,side*.13,0,0,.25,.31,.035);page.rotation.y=side*.18;for(let i=0;i<3;i++)box(book,0xc8b693,side*.13,.08-i*.07,.03,.16,.012,.008,false);}
 const magnifier=props.magnifier=group(body,.10,.68,.33);mesh(magnifier,new THREE.TorusGeometry(.15,.025,6,24),0x638b73,0,.04,0);const handle=box(magnifier,0x638b73,-.10,-.14,0,.055,.21,.055);handle.rotation.z=-.5;
 const clipboard=props.clipboard=group(body,0,.65,.29);box(clipboard,0xfff7df,0,0,0,.36,.38,.035);box(clipboard,0xc5b490,0,.18,.01,.15,.055,.02);for(let i=0;i<3;i++)box(clipboard,0xb4b19a,0,.08-i*.08,.025,.23,.015,.008,false);
 if(appearance.secretary){clipboard.position.set(.31,.59,.22);clipboard.rotation.z=-.12;armR.rotation.x=-.35;}
 props.cup=cup(body,0,.64,.30,1.5);
 const phone=props.phone=group(body,.36,1.0,.20);box(phone,0x3c5154,0,0,0,.13,.25,.055);box(phone,0xc6e2bf,0,.01,.032,.09,.17,.008,false);
 const game=props.game=group(body,0,.62,.31);box(game,0x786494,0,0,0,.43,.15,.13);for(const x of [-.13,.13])ball(game,0xe7d6a5,x,.045,.07,.037,.03,.015,false);
 const tool=props.tool=group(body,.22,.76,.30);box(tool,0x648a78,0,0,0,.10,.28,.10);const toolTip=box(tool,0xb8c8ad,0,.18,0,.045,.22,.045);toolTip.rotation.z=-.12;
 const marker=props.marker=group(body,.27,.89,.28);cylinder(marker,0x668a73,0,0,0,.035,.30);box(marker,0xf0e4bc,0,.17,0,.045,.045,.045);
 if(appearance.secretary){for(const [key,options]of Object.entries({teaTray:{},snackTray:{snacks:true},emptyTray:{empty:true}})){props[key]=secretaryTray(body,options);props[key].position.set(0,.72,.42);}const cloth=props.cloth=group(body,.29,.76,.34);box(cloth,0xc8d7c5,0,0,0,.22,.045,.16);box(cloth,0xe8ede1,0,.025,.03,.20,.012,.04,false);}

 const selection=mesh(root,new THREE.RingGeometry(.45,.49,36),new THREE.MeshBasicMaterial({color:0x91ad66,side:THREE.DoubleSide,transparent:true,opacity:.8}),0,.025,0);selection.rotation.x=-Math.PI/2;selection.visible=false;
 return {root,body,head,eyes,legL,legR,armL,armR,props,selection,belly,glare,smile};
}

export class OfficeScene {
 constructor(element,{onSelectRoom,onSelectSession,onStatusChange,onFloorArrival,onOwnerStatus,onOwnerSelect,onCameraChange}={}){
  this.element=element;this.onSelectRoom=onSelectRoom;this.onSelectSession=onSelectSession;this.onStatusChange=onStatusChange;this.onFloorArrival=onFloorArrival;this.onOwnerStatus=onOwnerStatus;this.onOwnerSelect=onOwnerSelect;this.onCameraChange=onCameraChange;
  this.navigator=new OfficeNavigator();this.actors=new Map();this.lights=[];this.roomMeshes=new Map();this.motion=true;this.paths=true;this.selectedId=null;this.selectedRoom=null;this.ownerSelected=false;this.context=null;this.archiveMode=false;this.angle=.63;this.elevation=.63;this.zoom=1;this.lastTime=performance.now();this.statusSignature='';this.calls=new Map();this.viewTarget=new THREE.Vector3();
  this.scene=new THREE.Scene();this.scene.background=DAY_BACKGROUND.clone();this.lightingMinute=-1;this.location=null;this.solarEvents=null;
  this.camera=new THREE.OrthographicCamera(-20,20,12,-12,.1,160);
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
  this.renderer.domElement.setAttribute('aria-label','벽과 복도로 연결된 3D 사무실. 드래그해서 중심을 이동하고 Shift를 누른 채 드래그해서 회전할 수 있습니다. 방이나 캐릭터를 선택할 수도 있습니다.');this.renderer.domElement.setAttribute('role','img');element.append(this.renderer.domElement);
  const sky=this.sky=new THREE.HemisphereLight(0xfff9ed,0xb0bc9f,1.9);this.scene.add(sky);
  this.sun=new THREE.DirectionalLight(0xfff4dc,2.1);this.sun.position.set(-8,20,12);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:60});this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=3;this.scene.add(this.sun);
  this.librarianLabel=document.createElement('div');this.world=group(this.scene);this.buildOffice();
  this.labelLayer=document.createElement('div');this.labelLayer.className='world-labels';element.append(this.labelLayer);this.leaderLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');this.leaderLayer.classList.add('label-leaders');this.labelLayer.append(this.leaderLayer);
  this.labels=new Map();for(const room of [...ROOM_LAYOUT,...EXECUTIVE_ROOM_LAYOUT.filter(item=>!ROOM_LAYOUT.some(base=>base.key===item.key))]){const label=document.createElement('button');label.className='world-room-label';label.innerHTML=`<i></i><span>${ROOM_NAMES[room.key]||EXECUTIVE_ROOM_NAMES[room.key]}</span>`;label.setAttribute('aria-label',`${ROOM_NAMES[room.key]||EXECUTIVE_ROOM_NAMES[room.key]} 작업 보기`);label.addEventListener('click',()=>this.onSelectRoom?.(room.key));this.labelLayer.append(label);this.labels.set(room.key,{node:label,point:new THREE.Vector3(...room.label)});}
  this.secretaryLookDay=secretaryLookForDate();this.secretaryModel=createCharacter(this.world,'studio',{index:2,accessory:'glasses',secretary:true,secretaryOutfit:this.secretaryLookDay.look});this.secretaryModel.root.position.set(SECRETARY_STATION.x+.18,0,SECRETARY_STATION.z);this.secretaryModel.root.rotation.y=SECRETARY_STATION.rotation;this.secretaryModel.root.scale.setScalar(1.08);this.secretaryModel.root.visible=false;this.secretaryModel.props.clipboard.visible=true;
  this.secretaryLabel=document.createElement('div');this.secretaryLabel.className='world-agent-label secretary-label show-task';this.secretaryLabel.style.pointerEvents='none';this.labelLayer.append(this.secretaryLabel);this.setSecretaryIdentity('비서');
  this.secretaryRoutine=null;this.secretaryRoutineExecutive=null;this.secretaryEscortWalker=null;this.secretaryEscortContext=null;this.secretaryEscortStart=null;this.secretaryEscortTargetIndex=null;this.secretaryEscorting=false;this.secretaryServiceTimers={tea:0,snacks:0};this.secretaryServings={tea:secretaryTray(this.executiveSuiteGroup),snacks:secretaryTray(this.executiveSuiteGroup,{snacks:true})};this.secretaryServings.tea.position.set(-1.02,1.06,-1.65);this.secretaryServings.snacks.position.set(-8.65,.55,-4.35);for(const tray of Object.values(this.secretaryServings))tray.visible=false;
  this.librarianLabel.className='world-agent-label show-task librarian-label';this.librarianLabel.style.pointerEvents='none';this.labelLayer.append(this.librarianLabel);
  this.owner=new OfficeOwner(this,createCharacter);
  this.visitor=new OfficeVisitor(this.world,this.labelLayer,createCharacter);
  this.routeLine=null;this.routeSignature='';
  this.bindControls();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);this.resize();this.frame=this.frame.bind(this);this.frameHandle=requestAnimationFrame(this.frame);
 }
 setSecretaryIdentity(name){this.secretaryName=String(name||'').trim()||'비서';const title=document.createElement('strong'),nameText=document.createElement('span'),rank=document.createElement('small'),action=document.createElement('span');nameText.textContent=this.secretaryName;rank.className='agent-rank secretary-rank';rank.textContent='비서';title.append(nameText,rank);action.className='secretary-action';action.textContent=this.secretaryRoutine?.text||'일정과 방문객을 확인하는 중';this.secretaryLabel.replaceChildren(title,action);this.secretaryLabel.setAttribute('aria-label',`${this.secretaryName} · 비서 · ${action.textContent}`);}
 refreshSecretaryLook(){
  const today=secretaryLookForDate();if(today.day===this.secretaryLookDay.day)return;
  const old=this.secretaryModel,next=createCharacter(this.world,'studio',{index:2,accessory:'glasses',secretary:true,secretaryOutfit:today.look});
  next.root.position.copy(old.root.position);next.root.rotation.copy(old.root.rotation);next.root.scale.copy(old.root.scale);next.root.visible=old.root.visible;next.props.clipboard.visible=true;
  this.world.remove(old.root);disposeCharacter(old);this.secretaryModel=next;this.secretaryLookDay=today;
 }
 setLocation(latitude,longitude){if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){this.location=null;this.solarEvents=null;this.lightingMinute=-1;return;}this.location={latitude,longitude};this.solarEvents=sunriseSunset(new Date(),latitude,longitude);this.lightingMinute=-1;}
 updateSecretary(dt,time){
  this.refreshSecretaryLook();
  const j=this.owner.journey,model=this.secretaryModel;
  if(this.archiveMode||j.floor!==this.context||j.phase==='riding'){model.root.visible=false;this.secretaryLabel.hidden=true;return;}
  model.root.visible=true;
  if(!this.secretaryRoutine)this.secretaryRoutine=new SecretaryRoutine(this.navigator,{onService:kind=>{this.secretaryServiceTimers[kind]=75;this.secretaryServings[kind].visible=true;}});
  const routine=this.secretaryRoutine;
  if(routine.navigator!==this.navigator||this.secretaryRoutineExecutive!==this.navigator.executive){routine.navigator=this.navigator;routine.stops=Object.fromEntries(Object.entries(SECRETARY_STOPS).map(([key,stop])=>[key,{...stop,...this.navigator.point(this.navigator.nearest(stop,stop.room))}]));routine.resetHome();this.secretaryEscortWalker=null;this.secretaryEscortTargetIndex=null;this.secretaryRoutineExecutive=this.navigator.executive;}
  const ceoInsideOffice=this.navigator.executive&&roomAt(this.owner.walker.position,EXECUTIVE_ROOM_LAYOUT)==='desk';
  const ceoReady=ceoInsideOffice&&['idle','commanding'].includes(j.phase)&&!this.owner.walker.walking;
  if(!ceoInsideOffice){
   if(!this.secretaryEscorting){this.secretaryEscortStart={x:model.root.position.x,z:model.root.position.z};routine.resetHome();this.secretaryEscorting=true;}
   if(!this.secretaryEscortWalker||this.secretaryEscortContext!==this.context||this.secretaryEscortWalker.navigator!==this.navigator){
    const contextChanged=Boolean(this.secretaryEscortContext&&this.secretaryEscortContext!==this.context),leader=this.owner.walker.position,heading=this.owner.walker.heading,behind={x:leader.x-Math.sin(heading)*1.15,z:leader.z-Math.cos(heading)*1.15},start=this.navigator.executive&&!contextChanged?(this.secretaryEscortStart||routine.walker.position):behind;
    this.secretaryEscortWalker=new OfficeWalker(this.navigator,start);this.secretaryEscortTargetIndex=null;this.secretaryEscortContext=this.context;
   }
   const walker=this.secretaryEscortWalker,leader=this.owner.walker.position,ceoWalking=this.owner.walker.walking,heading=ceoWalking?this.owner.walker.heading:this.owner.model.root.rotation.y;
   const foreAft=ceoWalking?-1:1,side=.82,forward=1.02;
   const flank={x:leader.x+Math.sin(heading)*foreAft*forward+Math.cos(heading)*side,z:leader.z+Math.cos(heading)*foreAft*forward-Math.sin(heading)*side};
   let targetIndex=this.navigator.nearest(flank);if(targetIndex<0)targetIndex=this.navigator.nearest(leader);
   const target=targetIndex>=0?this.navigator.point(targetIndex):flank;
   const queued=walker.pending?.point||walker.destination;
   if(targetIndex>=0&&targetIndex!==this.secretaryEscortTargetIndex&&Math.hypot(walker.position.x-target.x,walker.position.z-target.z)>.72&&(!walker.walking||Math.hypot(queued.x-target.x,queued.z-target.z)>.8)){
    walker.setDestination(target,null);this.secretaryEscortTargetIndex=targetIndex;
   }
   walker.tick(dt,1.72);
   const walking=walker.walking,cycle=walker.distanceWalked*11,face=leader;
   model.root.position.set(walker.position.x,0,walker.position.z);
   const direction=walking?walker.heading:Math.atan2(face.x-walker.position.x,face.z-walker.position.z),delta=Math.atan2(Math.sin(direction-model.root.rotation.y),Math.cos(direction-model.root.rotation.y));model.root.rotation.y+=delta*Math.min(1,dt*8);
   model.body.position.y=this.motion?(walking?Math.abs(Math.sin(cycle))*.03:Math.sin(time*.002)*.008):0;
   model.legL.rotation.x=this.motion&&walking?Math.sin(cycle)*.38:0;model.legR.rotation.x=-model.legL.rotation.x;
   model.armL.rotation.x=walking&&this.motion?-Math.sin(cycle)*.25:-.55;model.armR.rotation.x=walking&&this.motion?Math.sin(cycle)*.25:-.55;
   for(const [key,prop]of Object.entries(model.props))prop.visible=key==='clipboard';
   model.eyes.scale.y=this.motion&&time%5400>5250?.1:1;
   const action=this.secretaryLabel.querySelector('.secretary-action'),text=walking?'CEO를 따라 이동하며 자료를 챙기는 중':'CEO의 업무 수행을 돕는 중';if(action.textContent!==text){action.textContent=text;this.secretaryLabel.setAttribute('aria-label',`${this.secretaryName} · 비서 · ${text}`);}this.secretaryLabel.dataset.action=walking?'walking':'assisting';this.secretaryLabel.classList.remove('greeting');
   this.updateSecretaryServices(dt);return;
  }
  if(this.secretaryEscorting){routine.resetHome({x:model.root.position.x,z:model.root.position.z});this.secretaryEscorting=false;this.secretaryEscortWalker=null;this.secretaryEscortTargetIndex=null;}
  const ceoPresent=true;
  const guests=[...this.actors.values()].filter(actor=>!actor.leaving&&actor.session.projectKey===this.context&&actor.desired.room==='reception'&&actor.walker.room==='reception'&&!actor.walker.walking).map(actor=>actor.session.id);
  routine.tick(dt,{ceoPresent,ceoReady,ceoPhase:j.phase,ceoRoom:this.owner.walker.room,guests});
  const walking=routine.walker.walking&&!routine.greeting&&routine.step?.action==='walk',carrying=routine.prop.endsWith('Tray'),action=routine.step?.action,cycle=routine.walker.distanceWalked*11;
  model.root.position.set(routine.walker.position.x,0,routine.walker.position.z);
  const face=routine.greeting?this.owner.model.root.position:routine.facing;
  const heading=walking?routine.walker.heading:Math.atan2(face.x-model.root.position.x,face.z-model.root.position.z),delta=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));model.root.rotation.y+=delta*Math.min(1,dt*8);
  model.body.position.y=this.motion?(walking?Math.abs(Math.sin(cycle))*(carrying?.015:.035):Math.sin(time*.002)*.008):0;
  model.legL.rotation.x=this.motion&&walking?Math.sin(cycle)*.40:0;model.legR.rotation.x=-model.legL.rotation.x;
  model.armL.rotation.x=carrying?-1.1:walking&&this.motion?-Math.sin(cycle)*.30:-.12;model.armR.rotation.x=carrying?-1.1:routine.prop==='clipboard'?-.35:walking&&this.motion?Math.sin(cycle)*.30:-.15;
  model.armL.rotation.z=carrying?-.06:0;model.armR.rotation.z=carrying?.06:0;
  model.body.rotation.x=0;model.head.rotation.x=0;
  for(const [key,prop]of Object.entries(model.props))prop.visible=key===routine.prop;
  if(carrying){const tray=model.props[routine.prop],reach=action==='serve'&&this.motion?Math.sin(Math.PI*routine.stepTime/routine.step.duration):0;tray.position.set(0,.72+reach*.16,.42+reach*.12);}
  if(action==='prepare'&&!routine.greeting){model.head.rotation.x=.1;model.armR.rotation.x=-1.05+(this.motion?Math.sin(time*.004)*.08:0);}
  if(action==='tidy'&&!routine.greeting){model.head.rotation.x=.12;model.armR.rotation.x=-1.15+(this.motion?Math.sin(time*.005)*.12:0);if(model.props.cloth){model.props.cloth.position.x=.29+(this.motion?Math.sin(time*.005)*.07:0);}}
  if(routine.greeting){const bow=this.motion?Math.sin(Math.PI*routine.greeting.elapsed/routine.greeting.duration):0;model.body.rotation.x=bow*(carrying?.05:.12);model.head.rotation.x=bow*.19;}
  model.eyes.scale.y=this.motion&&time%5400>5250?.1:1;
  const label=this.secretaryLabel.querySelector('.secretary-action');if(label.textContent!==routine.text){label.textContent=routine.text;this.secretaryLabel.setAttribute('aria-label',`${this.secretaryName} · 비서 · ${routine.text}`);}this.secretaryLabel.classList.toggle('greeting',Boolean(routine.greeting));this.secretaryLabel.dataset.action=routine.greeting?'greeting':walking?'walking':action||'idle';
  this.updateSecretaryServices(dt);
 }
 updateSecretaryServices(dt){for(const kind of Object.keys(this.secretaryServiceTimers)){this.secretaryServiceTimers[kind]=Math.max(0,this.secretaryServiceTimers[kind]-dt);this.secretaryServings[kind].visible=this.secretaryServiceTimers[kind]>0;}}
 buildOffice(){
  const ground=mesh(this.scene,new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.09}),0,-.61,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  this.standardOuterWallsGroup=group(this.world);
  box(this.standardOuterWallsGroup,0xc8cfc0,0,-.33,0,24.5,.55,16.5);box(this.standardOuterWallsGroup,0xf9f7eb,0,-.035,0,24.15,.09,16.15);
  box(this.standardOuterWallsGroup,0xe8ebe1,0,.016,0,24,.03,3);
  this.standardLayoutGroup=group(this.world);this.executiveSuiteGroup=group(this.world);this.executiveSuiteGroup.visible=false;
  this.standardRoomMeshes=new Map();this.executiveRoomMeshes=new Map();this.roomMeshes=this.standardRoomMeshes;
  const addRoomTiles=(parent,layout,store)=>{for(const room of layout){const [x0,x1,z0,z1]=room.bounds;const floor=box(parent,room.color,room.x,.018,room.z,x1-x0,.04,z1-z0,false);floor.userData.room=room.key;store.set(room.key,floor);const lines=[];for(let x=Math.ceil(x0);x<x1;x+=1)lines.push(x,.045,z0,x,.045,z1);for(let z=Math.ceil(z0);z<z1;z+=1)lines.push(x0,.045,z,x1,.045,z);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));parent.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.20})));}};
  addRoomTiles(this.standardLayoutGroup,ROOM_LAYOUT,this.standardRoomMeshes);
  for(const item of WALLS){const parent=item.outer?this.standardOuterWallsGroup:this.standardLayoutGroup;box(parent,0xf6f4e9,item.x,item.h/2,item.z,item.w,item.h,item.d);box(parent,0xc8bb9d,item.x,.10,item.z,item.w+.025,.13,item.d+.025,false);if(!item.outer&&item.w<.3){const glassMaterial=new THREE.MeshStandardMaterial({color:0xcbded6,transparent:true,opacity:.25,roughness:.18,depthWrite:false});box(parent,glassMaterial,item.x,1.70,item.z,.07,1.0,item.d);box(parent,0xd7ded1,item.x,2.22,item.z,.10,.055,item.d);for(let z=item.z-item.d/2;z<=item.z+item.d/2+.1;z+=item.d/3)box(parent,0xd1d9cb,item.x,1.65,z,.10,1.15,.055);}}
  for(const door of DOORS){for(const side of [-1,1])box(this.standardLayoutGroup,0xe0cdaa,door.x+side*1.1,1.12,door.z,.09,2.24,.22);box(this.standardLayoutGroup,0xe0cdaa,door.x,2.25,door.z,2.3,.11,.22);box(this.standardLayoutGroup,0xd3c09a,door.x,.047,door.z,2.18,.045,.27,false);}
  for(const x of [-10.5,-7.6,-2.3,.7,6.0,9.1]){box(this.standardOuterWallsGroup,0xd8e8df,x,1.85,-7.87,2.1,1.45,.035,false);for(const offset of [-1.1,1.1])box(this.standardOuterWallsGroup,0xfffcf0,x+offset,1.85,-7.82,.07,1.62,.08,false);for(const y of [1.08,1.85,2.62])box(this.standardOuterWallsGroup,0xfffcf0,x,y,-7.82,2.25,.06,.08,false);box(this.standardOuterWallsGroup,0xfffcf0,x,1.85,-7.82,.06,1.5,.08,false);}
  for(const item of FURNITURE)furniture(this.standardLayoutGroup,item,this.lights);
  for(let x=-9.4;x<=9.5;x+=2.35){const triangle=mesh(this.standardLayoutGroup,new THREE.ConeGeometry(.075,.18,3),0xc1c8b5,x,.055,0,.7,.12,1,false);triangle.rotation.z=-Math.PI/2;triangle.rotation.x=Math.PI/2;}
  this.buildExecutiveSuite();
  this.buildArchiveRoom();
 }
 buildArchiveRoom(){
  const root=this.archiveRoomGroup=group(this.world);root.visible=false;
  const floor=box(root,0xeadfc9,0,.018,0,24,.05,16,false);floor.userData.room='library';this.archiveFloor=floor;
  const lines=[];for(let x=-10;x<=10;x+=1)lines.push(x,.047,-7.7,x,.047,7.7);for(let z=-7;z<=7;z+=1)lines.push(-11.7,.047,z,11.7,.047,z);
  const grid=new THREE.BufferGeometry();grid.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));root.add(new THREE.LineSegments(grid,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.22})));
  // B1 uses one thin perimeter wall. Keep the front/south run low as a cutaway
  // so the archive interior remains visible, with no second shell or trim layer.
  for(const wall of [{x:-11.85,z:-4.7,w:.18,d:6.4,h:2.45},{x:-11.85,z:4.7,w:.18,d:6.4,h:2.45},{x:11.85,z:0,w:.18,d:15.8,h:2.45},{x:0,z:-7.85,w:23.8,d:.18,h:2.45},{x:0,z:7.85,w:23.8,d:.18,h:.42}]){
   box(root,0xf3f0e7,wall.x,wall.h/2,wall.z,wall.w,wall.h,wall.d);
  }
  // The B1 doorway lines up with the building elevator shaft on the west wall.
  box(root,0x40564c,-11.77,1.20,0,.08,2.28,2.56);
  for(const z of [-1.30,1.30])box(root,0xb69b6a,-11.69,1.20,z,.24,2.40,.12);
  box(root,0xc2a96f,-11.69,2.41,0,.24,.14,2.72);
  for(const z of [-.53,.53]){box(root,0xaeb9ac,-11.64,1.15,z,.06,2.10,1.02);box(root,0xcbd2c7,-11.595,1.15,z,.025,2.00,.92);}
  box(root,0x879486,-11.57,1.15,0,.018,2.00,.035,false);
  box(root,0x5d7162,-11.61,2.59,0,.10,.22,.72,false);
  box(root,0xf0e4c2,-11.55,2.59,0,.012,.035,.46,false);
  box(root,0x8d9a83,-11.67,1.62,-1.58,.10,.52,.22);
  box(root,0xbde0a0,-11.61,1.80,-1.58,.012,.08,.09,false);
  box(root,0xc4a96e,-11.61,1.52,-1.58,.012,.07,.07,false);
  for(const x of [-10,-7,-4,-1,2,5,8,10])furniture(root,{type:'bookshelf',room:'library',x,z:-6.95,w:1.8,d:.52,h:2.05},this.lights);
  for(const x of [-9,-6,-3,0,3,6,9])furniture(root,{type:'bookshelf',room:'library',x,z:5.8,w:1.8,d:.52,h:2.05,rotation:Math.PI},this.lights);
  for(const x of [-8.8,-5.2,5.2,8.8])furniture(root,{type:'cabinet',room:'library',x,z:-4.55,w:2.2,d:.58,h:1.3},this.lights);
  for(const x of [-4.0,2.0])furniture(root,{type:'reading-table',room:'library',x,z:.2,w:3.8,d:1.55,h:.86},this.lights);
  for(const x of [-4.85,-3.15,1.15,2.85])furniture(root,{type:'chair',room:'library',x,z:1.35,w:.68,d:.68,h:.9,rotation:Math.PI},this.lights);
  // The librarian's station faces the elevator across the west side of the hall.
  furniture(root,{type:'executive-desk',room:'studio',x:-9.65,z:2.65,w:2.55,d:.92,h:.88},this.lights);
  furniture(root,{type:'chair',room:'studio',x:-9.65,z:3.55,w:.72,d:.72,h:.95,rotation:Math.PI},this.lights);
  box(root,0x53685a,-9.65,1.52,2.65,1.20,.34,.08,false);
  box(root,0xf1e8d2,-9.65,1.53,2.605,.96,.20,.015,false);
  // One permanent staff character makes rounds between the station and shelves.
  const model=this.archiveLibrarian=createCharacter(root,'library',{index:2,accessory:'glasses'});
  model.root.position.set(-9.65,0,3.45);model.root.rotation.y=Math.PI;model.props.clipboard.visible=true;
  this.librarianLabel.replaceChildren();const librarianName=document.createElement('strong');librarianName.textContent='모아';const librarianAction=document.createElement('span');librarianAction.textContent='서가를 순회하는 중';this.librarianLabel.append(librarianName,librarianAction);this.librarianLabel.setAttribute('aria-label','모아 · 서가를 순회하는 중');
  for(const [key,prop]of Object.entries(model.props))if(key!=='clipboard')prop.visible=false;
  this.archiveLibrarianWalk={points:[[-9.65,3.45],[-7.4,3.4],[-3.2,4.0],[2.8,4.0],[8.9,4.3],[9.35,.1],[9.35,-5.95],[5,-5.95],[0,-5.95],[-5,-5.95],[-9.35,-5.95],[-9.35,-2.1],[-7.1,-1.5],[-9.65,3.45]],index:1,pause:0,inspecting:false,distance:0};
  // Small dated folders and open ledgers make the archive read as a working room.
  const folderColors=[0x9a7553,0xb28b5d,0x777f68,0x8a7662,0xc3aa77];
  let pile=0;
  for(const tableX of [-4,2]){
   const x=tableX,z=.2,tableTop=.86+.065,layers=3;
   for(let layer=0;layer<layers;layer++){
    const width=.48+(layer%2)*.1,height=.10,depth=.38;
    const record=box(root,folderColors[(pile+layer)%folderColors.length],x,tableTop+height/2+layer*height,z,width,height,depth);
    record.rotation.y=(pile%2?-.04:.04);
   }
   pile++;
  }
  for(const x of [-9.7,9.7]){box(root,0x5e6b5c,x,2.35,0,1.45,.16,.20,false);for(const z of [-.42,-.14,.14,.42])box(root,0xc5aa70,x,2.46,z, .15,.12,.035,false);}
 }
 updateArchiveLibrarian(dt,time){
  const model=this.archiveLibrarian,walk=this.archiveLibrarianWalk;if(!model||!walk)return;
  const [tx,tz]=walk.points[walk.index],dx=tx-model.root.position.x,dz=tz-model.root.position.z,distance=Math.hypot(dx,dz);
  if(distance<.08){
   if(walk.pause<=0){walk.pause=1.05;walk.inspecting=true;model.props.book.visible=true;model.props.clipboard.visible=false;}
   walk.pause-=dt;
   if(walk.pause<=0){walk.index=(walk.index+1)%walk.points.length;walk.inspecting=false;model.props.book.visible=false;model.props.clipboard.visible=true;}
  }else{
   const step=Math.min(distance,1.05*dt);model.root.position.x+=dx/distance*step;model.root.position.z+=dz/distance*step;walk.distance+=step;
   const heading=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));model.root.rotation.y+=delta*Math.min(1,dt*8);
  }
  const moving=distance>=.08,cycle=walk.distance*11;
  model.body.position.y=this.motion?(moving?Math.abs(Math.sin(cycle))*.04:Math.sin(time*.002)*.01):0;
  model.legL.rotation.x=this.motion&&moving?Math.sin(cycle)*.46:0;model.legR.rotation.x=-model.legL.rotation.x;
  model.armL.rotation.x=this.motion&&moving?-Math.sin(cycle)*.32:walk.inspecting?-.82:-.18;
  model.armR.rotation.x=this.motion&&moving?Math.sin(cycle)*.32:walk.inspecting?-.95:-.18;
  if(walk.inspecting){model.head.rotation.x=.10+Math.sin(time*.003)*.035;model.armR.rotation.z=.12;}else{model.head.rotation.x=0;model.armR.rotation.z=0;}
 }
 buildExecutiveSuite(){buildExecutiveInterior(this.executiveSuiteGroup,this.executiveRoomMeshes);}
 setExecutiveOffice(active){
  const firstExecutive=active&&!this.hasSetExecutiveView,changed=this.navigator.executive!==active;this.navigator.setExecutive(active);this.executiveSuiteGroup.visible=active;this.standardLayoutGroup.visible=!active;this.standardOuterWallsGroup.visible=!active&&!this.archiveMode;this.element.classList.toggle('executive-scene',active);this.secretaryModel.root.visible=!this.archiveMode&&(active||this.owner?.journey.floor===this.context);
  this.roomMeshes=active?this.executiveRoomMeshes:this.standardRoomMeshes;
  const layout=active?EXECUTIVE_ROOM_LAYOUT:ROOM_LAYOUT,names=active?EXECUTIVE_ROOM_NAMES:ROOM_NAMES;
  for(const [key,label]of this.labels){const room=layout.find(item=>item.key===key);label.node.hidden=!room;label.node.dataset.zone=active?(['studio','reception','meeting'].includes(key)?'public':key==='desk'?'office':'private'):'';label.node.querySelector('span').textContent=names[key]||ROOM_NAMES[key]||key;label.node.setAttribute('aria-label',`${names[key]||ROOM_NAMES[key]||key} 작업 보기`);if(room)label.point.set(...room.label);label.node.classList.toggle('selected',key===this.selectedRoom);}
  for(const [key,floor]of this.roomMeshes){if(!floor.userData.originalMaterial)floor.userData.originalMaterial=floor.material;if(floor.material!==floor.userData.originalMaterial)floor.material.dispose();floor.material=floor.userData.originalMaterial;floor.material.color.set(layout.find(room=>room.key===key)?.color||'#eeeeee');if(key===this.selectedRoom){floor.material=new THREE.MeshStandardMaterial({color:layout.find(room=>room.key===key)?.color||'#eeeeee',emissive:0x8eaf6d,emissiveIntensity:.16,roughness:.9});}}
  this.routeSignature='';if(changed){if(firstExecutive){this.elevation=.8;this.angle=.67;this.zoom=1;this.hasSetExecutiveView=true;if(this.owner?.journey.floor===this.context&&this.owner.journey.phase==='idle')this.owner.walker=new OfficeWalker(this.navigator,this.owner.homePoint());}this.resize();}this.updateLabels();if(changed&&active&&this.owner?.journey.floor===this.context&&['idle','commanding'].includes(this.owner.journey.phase))this.owner.walker.setDestination(this.owner.homePoint(),'desk');
 }
 bindControls(){
  const canvas=this.renderer.domElement;let drag=null;canvas.tabIndex=0;
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(![0,2].includes(event.button))return;drag={x:event.clientX,y:event.clientY,angle:this.angle,elevation:this.elevation,target:this.viewTarget.clone(),pan:event.button===2||!event.shiftKey,moved:false};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){if(drag.pan){const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1),unitsPerPixel=(this.camera.right-this.camera.left)/this.width;this.viewTarget.copy(drag.target).addScaledVector(right,-dx*unitsPerPixel).addScaledVector(up,dy*unitsPerPixel);}else{this.angle=drag.angle-dx*.005;this.elevation=THREE.MathUtils.clamp(drag.elevation+dy*.004,0,Math.PI/2-.015);}this.resize();}});
  canvas.addEventListener('pointerup',event=>{if(drag&&!drag.moved&&event.button===0)this.pick(event);drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);});
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();this.setZoom(this.zoom*Math.exp(-event.deltaY*.001));},{passive:false});
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')this.angle-=.12;if(event.key==='ArrowRight')this.angle+=.12;if(event.key==='ArrowUp')this.elevation=Math.min(1.555,this.elevation+.08);if(event.key==='ArrowDown')this.elevation=Math.max(0,this.elevation-.08);if(event.key==='+')this.zoom=Math.min(3.5,this.zoom*1.1);if(event.key==='-')this.zoom=Math.max(.55,this.zoom/1.1);if(event.key==='0')this.resetView();this.resize();});
 }
 pick(event){const bounds=this.renderer.domElement.getBoundingClientRect(),point=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(point,this.camera);const hits=ray.intersectObjects(this.world.children,true);for(const hit of hits){let object=hit.object;while(object){if(object.userData.owner){this.onOwnerSelect?.();return;}if(object.userData.sessionId){this.onSelectSession?.(object.userData.sessionId);return;}if(object.userData.room){this.onSelectRoom?.(object.userData.room);return;}object=object.parent;}}}
 resize(){
  const width=this.element.clientWidth,height=this.element.clientHeight;if(!width||!height)return;
  this.width=width;this.height=height;this.renderer.setSize(width,height,false);
  const radius=42;this.camera.position.set(this.viewTarget.x+Math.sin(this.angle)*Math.cos(this.elevation)*radius,this.viewTarget.y+Math.sin(this.elevation)*radius,this.viewTarget.z+Math.cos(this.angle)*Math.cos(this.elevation)*radius);this.camera.lookAt(this.viewTarget);this.camera.updateMatrixWorld();
  const points=[];for(const x of [-15.2,this.navigator.executive?8.4:12.6])for(const z of this.navigator.executive?[-7.6,7.6]:[-8.6,8.6])for(const y of [-.65,3])points.push(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);const xs=points.map(p=>p.x+this.viewTarget.dot(right)),ys=points.map(p=>p.y+this.viewTarget.dot(up));const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),aspect=width/height;const halfH=Math.max((y1-y0)/2,(x1-x0)/aspect/2)*1.035/this.zoom;const midX=(x0+x1)/2,midY=(y0+y1)/2;this.camera.left=midX-halfH*aspect;this.camera.right=midX+halfH*aspect;this.camera.top=midY+halfH;this.camera.bottom=midY-halfH;this.element.classList.toggle('low-angle',this.elevation<.25);this.camera.updateProjectionMatrix();this.updateLabels();this.onCameraChange?.({elevation:Math.round(this.elevation*180/Math.PI),zoom:this.zoom});
 }
 setZoom(zoom){this.zoom=THREE.MathUtils.clamp(zoom,.55,3.5);this.resize();}
 resetView(){this.angle=this.navigator.executive?.67:.63;this.elevation=this.navigator.executive?.8:.63;this.zoom=1;this.viewTarget.set(0,0,0);this.resize();}
 setElevation(degrees){this.elevation=THREE.MathUtils.clamp(Number(degrees),0,89)*Math.PI/180;this.resize();}
 setDirectory(floors,initial){this.executiveFloorKey=floors.reduce((top,item)=>!top||item.number>top.number?item:top,null)?.key||null;this.owner.setDirectory(floors,initial);if(!this.archiveMode)this.setExecutiveOffice(this.context===this.executiveFloorKey&&Boolean(this.executiveFloorKey));}
 setOwnerIdentity(identity){this.owner.setOwnerIdentity(identity);}
 receiveCommands(commands){for(const command of commands){this.calls.set(command.sessionId,{id:command.id,until:performance.now()+2600});this.owner.command(command.projectKey);}}
 setMotion(enabled){this.motion=enabled;}
 setEvening(enabled){this.scene.background.set(enabled?'#34463d':'#eef2ed');this.renderer.toneMappingExposure=enabled?.78:1.0;}
 setPaths(enabled){this.paths=enabled;this.routeSignature='';}
 setSelectedRoom(room){if(this.selectedRoom===room)return;this.selectedRoom=room;if(room)this.setOwnerSelected(false);const layout=this.navigator.roomLayout;for(const [key,floor] of this.roomMeshes){if(!floor.userData.originalMaterial)floor.userData.originalMaterial=floor.material;if(floor.material!==floor.userData.originalMaterial)floor.material.dispose();const color=layout.find(item=>item.key===key)?.color||'#eeeeee';floor.material=key===room?new THREE.MeshStandardMaterial({color,emissive:0x8eaf6d,emissiveIntensity:.16,roughness:.9}):floor.userData.originalMaterial;floor.material.color.set(color);}for(const [key,label]of this.labels)label.node.classList.toggle('selected',key===room);}
 setSelectedSession(id){this.selectedId=id;if(id)this.setOwnerSelected(false);for(const [key,actor]of this.actors){actor.model.selection.visible=key===id;actor.label.classList.toggle('selected',key===id);}this.routeSignature='';}
 setOwnerSelected(selected){this.ownerSelected=Boolean(selected);if(this.owner?.model){this.owner.model.selection.visible=this.ownerSelected;this.owner.label.classList.toggle('selected',this.ownerSelected);this.owner.label.setAttribute('aria-pressed',String(this.ownerSelected));}}
 setSessions(sessions,context,archiveMode=false){
  this.archiveMode=archiveMode;
  this.context=context;
  if(archiveMode){
   this.element.classList.remove('executive-scene');this.archiveRoomGroup.visible=true;this.standardLayoutGroup.visible=false;this.standardOuterWallsGroup.visible=false;this.executiveSuiteGroup.visible=false;this.secretaryModel.root.visible=false;this.secretaryLabel.hidden=true;this.navigator.setExecutive(false);this.roomMeshes=new Map([['library',this.archiveFloor]]);
   for(const label of this.labels.values())label.node.hidden=true;
  }else{
   this.archiveRoomGroup.visible=false;this.standardOuterWallsGroup.visible=true;
   const executive=context===this.executiveFloorKey&&Boolean(this.executiveFloorKey),layoutChanged=executive!==this.navigator.executive;
   this.setExecutiveOffice(executive);
   if(layoutChanged)for(const actor of this.actors.values()){actor.walker.route=[];actor.walker.pending=null;actor.walker.walking=false;actor.assignmentKey='';}
  }
  const ids=new Set(sessions.map(item=>item.id));for(const [id,actor]of this.actors){if(!ids.has(id)){actor.leaving=true;actor.walker.setDestination(this.navigator.station('desk',actor.homeSlot),'desk');}}
  const slots={};for(const session of sessions){let target=session.active?(session.room==='elevator'?(this.navigator.executive?'reception':'meeting'):ROOM_NAMES[session.room]?session.room:'desk'):'desk';if(this.navigator.executive&&session.active&&target==='studio')target='desk';else if(this.navigator.executive&&target==='desk')target='reception';let actor=this.actors.get(session.id);
    if(!actor){const usedHomes=new Set([7,...[...this.actors.values()].filter(item=>item.session.projectKey===session.projectKey).map(item=>item.homeSlot)]);let homeSlot=0;while(usedHomes.has(homeSlot)&&homeSlot<11)homeSlot++;const model=createCharacter(this.world,session.palette||'studio',session.identity||{});model.root.userData.sessionId=session.id;const label=document.createElement('button');label.className='world-agent-label tower-agent-label';label.addEventListener('click',()=>this.onSelectSession?.(session.id));this.labelLayer.append(label);actor={model,label,walker:new OfficeWalker(this.navigator,this.navigator.station('desk',homeSlot)),homeSlot,readyAt:performance.now()+650+homeSlot*90,lastPose:'',session,leaving:false,hadRequest:session.requestId,assignmentKey:'',interaction:'primary',nextInteractionAt:performance.now()+6500+homeSlot*500};this.actors.set(session.id,actor);}
    actor.session=session;actor.leaving=false;const slotKey=session.projectKey+target;const slot=target==='desk'?actor.homeSlot:(slots[slotKey]??0);slots[slotKey]=(slots[slotKey]??0)+1;actor.desired={point:this.navigator.station(target,slot),room:target,slot};
    const assignmentKey=`${session.projectKey}:${target}:${slot}`;
    if(actor.assignmentKey!==assignmentKey){actor.assignmentPending=true;actor.assignmentKey=assignmentKey;actor.interaction='primary';actor.nextInteractionAt=performance.now()+6500+slot*500;if(performance.now()>=actor.readyAt&&!this.isReceiving(actor))actor.walker.setDestination(actor.desired.point,target);}
  }
 }
 isReceiving(actor){return (this.calls.get(actor.session.id)?.until||0)>performance.now();}
 getStatus(id){const actor=this.actors.get(id);if(!actor)return null;const walker=actor.walker;const preparing=performance.now()<actor.readyAt;const phase=this.isReceiving(actor)?'receiving':walker.blocked?'blocked':walker.walking?'walking':preparing?'waiting':actor.session.active&&!actor.leaving?'working':'resting';return {phase,room:walker.room,target:walker.targetRoom||'desk',x:walker.position.x,z:walker.position.z};}
 updateActor(actor,dt,time){
  if(time>=actor.readyAt&&actor.desired&&!actor.leaving&&!this.isReceiving(actor)){
   if(!actor.assignedOnce||actor.assignmentPending){actor.assignedOnce=true;actor.assignmentPending=false;actor.walker.setDestination(actor.desired.point,actor.desired.room);}
   if(actor.session.active&&actor.assignmentKey&&time>=actor.nextInteractionAt){
    const room=actor.desired.room;
    if(room==='meeting')actor.interaction=actor.interaction==='board'?'primary':'board';
    else if(room==='server')actor.interaction=actor.interaction==='rack'?'terminal':'rack';
    else if(room==='research')actor.interaction=actor.interaction==='search'?'primary':'search';
    else actor.interaction='primary';
    actor.nextInteractionAt=time+8500+(actor.desired.slot%3)*1100;
    let point=actor.desired.point;
    if(room==='meeting'&&actor.interaction==='board')point=this.navigator.point(this.navigator.nearest(this.navigator.executive?EXECUTIVE_INTERACTIONS.board:{x:2.5,z:2.8},'meeting'));
    if(room==='server'&&actor.interaction==='terminal')point=this.navigator.point(this.navigator.nearest(this.navigator.executive?EXECUTIVE_INTERACTIONS.terminal:{x:9.5,z:-3.4},'server'));
    if(room==='research'&&actor.interaction==='search')point=this.navigator.station('research',2);
    actor.walker.setDestination(point,room);
   }
  }
  const walker=actor.walker;const receiving=this.isReceiving(actor);if(!receiving)walker.tick(dt,1.7);const model=actor.model;model.root.visible=actor.session.projectKey===this.context;actor.label.hidden=!model.root.visible;model.root.position.set(walker.position.x,0,walker.position.z);
  const working=actor.session.active&&!walker.walking;const room=actor.desired?.room||'desk';const heading=walker.walking?walker.heading:working?(room==='studio'?(actor.desired.slot===2?Math.PI/2:-Math.PI/2):room==='server'?(this.navigator.executive?(actor.interaction==='terminal'?0:Math.PI/2):(actor.interaction==='terminal'?Math.PI/2:Math.PI)):room==='meeting'?(actor.interaction==='board'?(this.navigator.executive?Math.PI/2:Math.PI):0):room==='research'?(actor.interaction==='search'?Math.PI/4:0):room==='library'?Math.PI/2:Math.PI):.30;let delta=heading-model.root.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));model.root.rotation.y+=delta*Math.min(1,dt*10);
  const walking=walker.walking&&!receiving,cycle=walker.distanceWalked*12;
  model.body.position.y=this.motion?(walking?Math.abs(Math.sin(cycle))*.045:Math.sin(time*.002)*.012):0;
  model.legL.rotation.x=this.motion&&walking?Math.sin(cycle)*.5:0;model.legR.rotation.x=-model.legL.rotation.x;
  model.armL.rotation.x=this.motion&&walking?-Math.sin(cycle)*.5:-.20;model.armR.rotation.x=this.motion&&walking?Math.sin(cycle)*.5:-.20;
  const blink=this.motion&&time%5400>5210;model.eyes.scale.y=blink?.10:1;
  const phase=this.getStatus(actor.session.id).phase;
  const idle=actor.session.identity?.idle||'relax';
  const pose=receiving?'phone':walking||phase==='waiting'||phase==='blocked'?'none':!actor.session.active||actor.leaving?({game:'game',read:'book',relax:'cup'}[idle]||'none'):room==='server'?(actor.interaction==='terminal'?'laptop':'tool'):room==='meeting'?(actor.interaction==='board'?'marker':'clipboard'):room==='research'?(actor.interaction==='search'?'magnifier':'laptop'):({library:'book',studio:'laptop',desk:'clipboard'}[room]||'laptop');
  if(pose!==actor.lastPose){for(const [key,prop]of Object.entries(model.props))prop.visible=key===pose;actor.lastPose=pose;}
  model.body.rotation.set(0,0,0);model.body.position.x=0;model.head.rotation.y=0;
  if(phase==='resting'){if(idle==='lie'){model.body.rotation.z=-Math.PI/2;model.body.position.y=.38;model.body.position.x=-.3;}if(idle==='nap'){model.body.rotation.x=.32;model.head.rotation.x=.18;model.eyes.scale.y=.08;}else model.head.rotation.x=0;if(idle==='stretch'){model.armL.rotation.z=-2.6;model.armR.rotation.z=2.6;}else{model.armL.rotation.z=0;model.armR.rotation.z=0;}if(idle==='game'&&this.motion){model.armL.rotation.x=-.75+Math.sin(time*.015)*.06;model.armR.rotation.x=-.75-Math.sin(time*.015)*.06;}}else{model.head.rotation.x=0;model.armL.rotation.z=0;model.armR.rotation.z=0;}
  const seated=this.motion&&!this.navigator.executive&&phase==='working'&&(room==='studio'||room==='research'&&actor.desired.slot<2||room==='meeting'&&actor.interaction!=='board');
  if(seated){model.body.position.y=.29+Math.sin(time*.006)*.012;model.legL.rotation.x=-1.12;model.legR.rotation.x=-1.12;}
  if(receiving)model.armR.rotation.x=-1.8;
  if(this.motion&&phase==='working'){
   const beat=time*.012+actor.desired.slot;
   if(room==='studio'||room==='research'&&actor.interaction!=='search'||room==='meeting'&&actor.interaction!=='board'){
    model.armL.rotation.x=-1.02+Math.sin(beat)*.10;model.armR.rotation.x=-1.05+Math.cos(beat*1.13)*.12;
    if(seated){model.armL.rotation.x=-1.25+Math.sin(beat)*.10;model.armR.rotation.x=-1.25+Math.cos(beat*1.13)*.12;}
   }else if(room==='server'){
    model.armL.rotation.x=-.68+Math.sin(beat*.65)*.14;model.armR.rotation.x=actor.interaction==='terminal'?-1.05+Math.sin(beat)*.12:-1.52+Math.sin(beat*1.4)*.18;
   }else if(room==='meeting'&&actor.interaction==='board'){
    model.armL.rotation.x=-.55;model.armR.rotation.x=-1.78+Math.sin(beat*.7)*.20;model.armR.rotation.z=.20+Math.sin(beat)*.08;
   }else if(room==='research'&&actor.interaction==='search'){
    model.armL.rotation.x=-.42;model.armR.rotation.x=-1.22+Math.sin(beat*.8)*.16;model.head.rotation.y=Math.sin(beat*.35)*.18;
   }else{
    model.armR.rotation.x=-.55+Math.sin(beat)*.12;
   }
  }
  const status=this.getStatus(actor.session.id);actor.label.dataset.state=status.phase;actor.label.dataset.room=status.room||'corridor';actor.label.dataset.target=status.target;actor.label.dataset.worldX=walker.position.x.toFixed(3);actor.label.dataset.worldZ=walker.position.z.toFixed(3);
  const idleNames={game:'게임하며 쉬는 중',nap:'꾸벅꾸벅 조는 중',lie:'누워서 쉬는 중',stretch:'쭉 기지개 켜는 중',read:'책 읽으며 쉬는 중',relax:'커피 마시며 쉬는 중'};
  const activeRoomNames=this.navigator.executive?EXECUTIVE_ROOM_NAMES:ROOM_NAMES;
  const text=status.phase==='receiving'?'☎ CEO의 원격 지시를 받는 중':status.phase==='walking'?`${activeRoomNames[status.target]||ROOM_NAMES[status.target]||'공간'}로 이동 중`:status.phase==='blocked'?'이동 경로 확인 중':status.phase==='waiting'?'업무 시작 준비 중':status.phase==='working'?(WORK_ACTION_NAMES[room]?.[actor.interaction]||TASK_NAMES[room]):idleNames[idle];
  const rank=actor.session.hasParent?'서브에이전트':'메인 세션';
  const labelKey=`${actor.session.displayName}-${rank}-${text}`;if(actor.labelKey!==labelKey){actor.label.replaceChildren();const name=document.createElement('strong');const nameText=document.createElement('span');nameText.textContent=actor.session.displayName||'Codex';const rankTag=document.createElement('small');rankTag.className='agent-rank';rankTag.textContent=rank;name.append(nameText,rankTag);const action=document.createElement('span');action.textContent=text;actor.label.append(name,action);actor.label.setAttribute('aria-label',`${nameText.textContent} · ${rank} · ${text}`);actor.labelKey=labelKey;}
  actor.label.classList.toggle('walking',walking);actor.label.classList.toggle('receiving',receiving);actor.label.classList.toggle('selected',actor.session.id===this.selectedId);
  if(actor.leaving&&!walker.walking&&time>actor.readyAt){model.root.scale.multiplyScalar(Math.max(.8,1-dt*4));if(model.root.scale.x<.05){this.world.remove(model.root);disposeCharacter(model);actor.label._leader?.remove();actor.label.remove();this.actors.delete(actor.session.id);}}
 }
 updateLabels(){
  if(!this.width)return;
  if(this.archiveMode){if(this.visitor)this.visitor.label.hidden=true;for(const {node}of this.labels.values())node.hidden=true;for(const actor of this.actors.values())actor.label.hidden=true;if(this.owner?.label)this.owner.label.hidden=true;this.secretaryLabel.hidden=true;const walk=this.archiveLibrarianWalk,model=this.archiveLibrarian;if(model&&walk){const action=this.librarianLabel.querySelector('span');const text=walk.inspecting?'자료를 살펴보는 중':'서가를 순회하는 중';if(action.textContent!==text){action.textContent=text;this.librarianLabel.setAttribute('aria-label',`모아 · ${text}`);}this.placeLabel(this.librarianLabel,new THREE.Vector3(model.root.position.x,2.45,model.root.position.z));}else this.librarianLabel.hidden=true;return;}
  this.librarianLabel.hidden=true;
  for(const [key,{node,point}]of this.labels){if(!this.navigator.roomLayout.some(room=>room.key===key)){node.hidden=true;continue;}this.placeLabel(node,point);}
  for(const actor of this.actors.values()){
    if(actor.session.projectKey!==this.context){actor.label.hidden=true;continue;}
    actor.label.classList.add('show-task');
    this.placeLabel(actor.label,new THREE.Vector3(actor.walker.position.x,2.45,actor.walker.position.z));
  }
  if(this.secretaryModel.root.visible)this.placeLabel(this.secretaryLabel,new THREE.Vector3(this.secretaryModel.root.position.x,2.20,this.secretaryModel.root.position.z));else this.secretaryLabel.hidden=true;
  if(this.visitor?.model.root.visible)this.placeLabel(this.visitor.label,this.visitor.labelPoint);
  this.layoutLabels();
 }
 placeLabel(node,point){
  const projected=point.clone().project(this.camera);
  node._anchor={x:(projected.x+1)*this.width/2,y:(1-projected.y)*this.height/2};
  node.style.left=`${node._anchor.x}px`;node.style.top=`${node._anchor.y}px`;
  node.hidden=projected.x< -1.1||projected.x>1.1||projected.y< -1.1||projected.y>1.1;
 }
 layoutLabels(){
  const nodes=[...this.labels.values()].map(label=>label.node).concat([...this.actors.values()].map(actor=>actor.label),this.secretaryLabel,this.librarianLabel,this.owner?.label||[],this.visitor?.label||[]);
  const placed=[];
  const priority=node=>node.classList.contains('selected')?0:node.classList.contains('owner-label')?1:node.classList.contains('world-room-label')?2:node.classList.contains('receiving')?3:node.classList.contains('show-task')?4:5;
  nodes.sort((a,b)=>priority(a)-priority(b));
  for(const node of nodes){
    if(node._leader)node._leader.style.display='none';
    if(node.hidden||!node._anchor)continue;
    const sizeKey=node.className+node.textContent+this.width+document.body.classList.contains('large-text')+this.element.classList.contains('low-angle');
    if(node._size?.key!==sizeKey)node._size={key:sizeKey,w:node.offsetWidth,h:node.offsetHeight};
    const {w,h}=node._size;if(!w||!h)continue;
    const anchor=node._anchor;
    const offsets=[[0,0]];
    for(let ring=1;ring<=8;ring++){const y=ring*(h+5);offsets.push([0,-y],[0,y],[-w*.6,-y],[w*.6,-y],[-w*.6,y],[w*.6,y]);}
    let chosen=null;
    for(const [dx,dy]of offsets){
      const x=THREE.MathUtils.clamp(anchor.x+dx,w/2+5,this.width-w/2-5),y=THREE.MathUtils.clamp(anchor.y+dy,h/2+62,this.height-h/2-24);
      const rect={x0:x-w/2-3,x1:x+w/2+3,y0:y-h/2-3,y1:y+h/2+3};
      if(placed.some(other=>rect.x0<other.x1&&rect.x1>other.x0&&rect.y0<other.y1&&rect.y1>other.y0))continue;
      chosen={x,y,rect};break;
    }
    if(!chosen){chosen={x:anchor.x,y:anchor.y,rect:{x0:anchor.x-w/2,x1:anchor.x+w/2,y0:anchor.y-h/2,y1:anchor.y+h/2}};}
    placed.push(chosen.rect);node.style.left=`${chosen.x}px`;node.style.top=`${chosen.y}px`;
    if(Math.hypot(chosen.x-anchor.x,chosen.y-anchor.y)>10){
      if(!node._leader){node._leader=document.createElementNS('http://www.w3.org/2000/svg','line');this.leaderLayer.append(node._leader);}
      const line=node._leader;line.style.display='';line.setAttribute('x1',anchor.x);line.setAttribute('y1',anchor.y);line.setAttribute('x2',chosen.x);line.setAttribute('y2',chosen.y);
    }
  }
 }
 updateRoute(){
  const actor=(this.selectedId&&this.actors.get(this.selectedId))||[...this.actors.values()].find(actor=>actor.walker.walking&&actor.session.projectKey===this.context);
  const signature=this.paths&&actor?.walker.walking?`${actor.session.id}:${actor.walker.route.map(p=>`${p.x},${p.z}`).join(';')}`:'';
  if(signature===this.routeSignature)return;this.routeSignature=signature;
  if(this.routeLine){this.world.remove(this.routeLine);this.routeLine.geometry.dispose();this.routeLine.material.dispose();this.routeLine=null;}
  if(!signature)return;const points=[actor.walker.position,...actor.walker.route].map(p=>new THREE.Vector3(p.x,.065,p.z));const geometry=new THREE.BufferGeometry().setFromPoints(points);const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:0xb08a4d,dashSize:.20,gapSize:.15,transparent:true,opacity:.85,depthTest:true}));line.computeLineDistances();line.renderOrder=5;this.world.add(line);this.routeLine=line;
 }
 frame(time){this.frameHandle=requestAnimationFrame(this.frame);const dt=Math.min((time-this.lastTime)/1000,.05);this.lastTime=time;if(document.hidden)return;const date=new Date(),minute=date.getHours()*60+date.getMinutes();if(minute!==this.lightingMinute){this.lightingMinute=minute;if(this.location)this.solarEvents=sunriseSunset(date,this.location.latitude,this.location.longitude);const daylight=daylightAt(date,this.solarEvents||{sunrise:390,sunset:1140});this.sky.intensity=.9+daylight;this.sun.intensity=.45+1.65*daylight;this.scene.background.copy(NIGHT_BACKGROUND).lerp(DAY_BACKGROUND,daylight);}for(const actor of [...this.actors.values()])this.updateActor(actor,dt,time);if(this.archiveMode)this.updateArchiveLibrarian(dt,time);this.owner.update(dt,time);this.updateSecretary(dt,time);for(const light of this.lights){const active=[...this.actors.values()].some(actor=>actor.session.projectKey===this.context&&actor.session.active&&!actor.walker.walking&&actor.desired.room===light.room);light.mesh.material.emissiveIntensity=active?.4+Math.max(0,Math.sin(time*.009+light.offset))*1.6:.15;}
  const pair={context:this.context,insideOffice:Boolean(this.owner.model.root.visible&&this.navigator.executive&&roomAt(this.owner.walker.position,EXECUTIVE_ROOM_LAYOUT)==='desk'),active:Boolean(this.secretaryEscorting&&this.owner.model.root.visible&&this.secretaryModel.root.visible&&!this.archiveMode&&this.owner.journey.phase!=='riding'),owner:this.owner.walker.position,secretary:this.secretaryEscortWalker?.position||this.secretaryModel.root.position,heading:this.owner.walker.walking?this.owner.walker.heading:this.owner.model.root.rotation.y,ownerWalking:this.owner.walker.walking,secretaryHeading:this.secretaryEscortWalker?.heading,ownerFacing:this.owner.model.root.rotation.y,secretaryFacing:this.secretaryModel.root.rotation.y,walking:this.owner.walker.walking||Boolean(this.secretaryEscortWalker?.walking)};
  this.visitor.update(this.navigator,dt,time,this.motion,!this.archiveMode,pair);this.updateLabels();this.updateRoute();this.renderer.render(this.scene,this.camera);
  const signature=[...this.actors.keys()].map(id=>{const state=this.getStatus(id);return `${id}:${state.phase}:${state.room}:${state.target}`;}).join('|');if(signature!==this.statusSignature){this.statusSignature=signature;this.onStatusChange?.();}
 }
 destroy(){cancelAnimationFrame(this.frameHandle);this.resizeObserver.disconnect();this.visitor.destroy(disposeCharacter);this.renderer.dispose();this.element.replaceChildren();}
}

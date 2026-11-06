import * as THREE from './vendor/three/three.module.js';

export function buildPerimeter(parent,layout,box,boxGeometry,glass,glow){
  const frame=0x49625c, stone=0xc9c3ae, plaster=0xe7e1cc, brass=0xc8a36a;
  const pane=(group,x,y,z,w,h,d)=>{
    const mesh=new THREE.Mesh(boxGeometry,glass);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    group.add(mesh);
  };
  for(const wall of layout.perimeter){
    const {x,z,w,d,h}=wall, alongX=w>d, length=alongX?w:d, depth=alongX?d:w;
    const group=new THREE.Group();
    group.position.set(x,0,z);
    if(!alongX)group.rotation.y=Math.PI/2;
    parent.add(group);
    box(group,stone,0,.34,0,length,.68,depth);
    box(group,plaster,0,.72,0,length,.11,depth+.07);
    pane(group,0,(.78+h-.13)/2,0,length,h-.91,.044);
    box(group,frame,0,1.36,0,length,.04,.09);
    box(group,frame,0,h-.13,0,length,.10,.12);
    box(group,plaster,0,h-.045,0,length,.09,depth+.06);
    const bays=Math.ceil(length/3.15);
    for(let i=0;i<=bays;i++){
      const pier=i%4===0||i===bays;
      box(group,pier?plaster:frame,(i/bays-.5)*(length-.09),pier?h/2:(h+.72)/2,0,pier?.23:.09,pier?h:h-.72,pier?depth+.08:.11);
    }
  }

  const {x,z,width,clearWidth}=layout.entrance,half=width/2,clearHalf=clearWidth/2;
  const portal=new THREE.Group();
  portal.position.set(x,0,z);
  parent.add(portal);
  box(portal,stone,1.8,-.092,0,3.6,.214,6);
  for(const side of [-1,1]){
    box(portal,plaster,0,1.55,side*(half-.11),.62,3.1,.22);
    box(portal,frame,0,1.31,side*(clearHalf+.04),.14,2.62,.08);
    pane(portal,0,1.37,side*2.16,.046,2.3,.86);
    box(portal,stone,.04,.12,side*2.16,.24,.24,.86);
    box(portal,brass,1.8,.035,side*2.4,3.55,.02,.045);
    const lamp=box(portal,plaster,1.82,2.88,side*1.67,.74,.035,.075);
    lamp.material=glow;
  }
  box(portal,brass,0,.044,0,.54,.025,clearWidth+.02);
  box(portal,frame,.9,3.05,0,3.45,.3,5.75);
  box(portal,plaster,.95,3.23,0,3.57,.10,5.89);
  box(portal,brass,2.64,3.11,0,.025,.035,5.72);

  const doors=[-1,1].map(side=>{
    const door=new THREE.Group();
    door.position.set(-.13,0,side*.855);
    portal.add(door);
    pane(door,0,1.31,0,.045,2.48,1.62);
    for(const edge of [-.825,.825])box(door,frame,0,1.31,edge,.08,2.52,.057);
    for(const y of [.075,1.04,2.55])box(door,y===1.04?brass:frame,0,y,0,.075,.045,1.68);
    door.traverse(mesh=>{mesh.userData.unbatched=true;mesh.castShadow=false;});
    return door;
  });
  return amount=>doors.forEach((door,index)=>{door.position.z=(index===0?-1:1)*(.855+1.65*amount);});
}

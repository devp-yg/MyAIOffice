import * as THREE from './vendor/three/three.module.js';
import {GROUND_LEVEL,groundShapeGeometry} from './shared-office-ground.js';
import {buildParkingElevator} from './shared-office-elevator.js';

const FLOOR_Y=-4.2;
const STALL_WIDTH=2.65;
const FLOOR=0x515b64, WALL=0x9ba6a9, STRIPE=0xdde0d0, AMBER=0xe6b054;
const CARS=[0x4c8393,0xa7654c,0xd8d2bc,0x647495,0x9fa677,0xb5b9c0];

export function buildSharedParking(bounds,elevatorPosition,batch){
  const {minX,maxX,minZ,maxZ}=bounds;
  const width=maxX-minX,depth=maxZ-minZ,midX=(minX+maxX)/2,midZ=(minZ+maxZ)/2;
  const group=new THREE.Group();
  group.position.y=FLOOR_Y;
  const elevator=buildParkingElevator(group,elevatorPosition);
  const cube=new THREE.BoxGeometry(),wheel=new THREE.CylinderGeometry(.33,.33,.21,14);
  wheel.rotateZ(Math.PI/2);
  const geometries=[cube,wheel],materials=new Map(),textures=[];
  function material(color,glow=false){
    const key=glow?'light':color;
    if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({
      color,roughness:.82,fog:false,emissive:glow?color:0,emissiveIntensity:glow?.65:0,
    }));
    return materials.get(key);
  }
  function box(parent,color,x,y,z,w,h,d,glow=false){
    const mesh=new THREE.Mesh(cube,material(color,glow));
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    parent.add(mesh);
    return mesh;
  }
  const paint=(color,x,z,w,d)=>box(group,color,x,.018,z,w,.012,d);
  const floor=box(group,FLOOR,midX,-.3,midZ,width,.6,depth);
  floor.userData.unbatched=true;

  const laneCount=Math.max(1,Math.floor((depth-1.4)/16.6));
  const lanes=Array.from({length:laneCount},(_,i)=>midZ+(i-(laneCount-1)/2)*16.6);
  const rampZ=lanes.find(lane=>lane>=6.8)??lanes.at(-1);
  const rampHalf=3.15;
  function wall(x,z,w,d,height){
    box(group,WALL,x,height/2,z,w,height,d);
    box(group,0x426675,x,height-.27,z,w+.02,.17,d+.02);
  }
  wall(midX,minZ,width,.35,3.6);
  wall(minX,midZ,.35,depth,3.6);
  const elevatorLeft=elevatorPosition.x-elevatorPosition.width/2,elevatorRight=elevatorPosition.x+elevatorPosition.width/2;
  wall((minX+elevatorLeft)/2,maxZ,elevatorLeft-minX,.35,.62);
  wall((elevatorRight+maxX)/2,maxZ,maxX-elevatorRight,.35,.62);
  wall(maxX,(minZ+rampZ-rampHalf)/2,.35,rampZ-rampHalf-minZ,.62);
  wall(maxX,(maxZ+rampZ+rampHalf)/2,.35,maxZ-rampZ-rampHalf,.62);

  const car=(x,z,heading,color)=>{
    const model=new THREE.Group();
    model.position.set(x,0,z);
    model.rotation.y=heading;
    group.add(model);
    box(model,0x424b54,0,.028,0,1.79,.025,4.22);
    box(model,color,0,.53,0,1.72,.48,4.15);
    box(model,color,0,.75,-1.42,1.64,.22,1.26);
    box(model,color,0,.74,1.45,1.61,.21,1.16);
    box(model,0x324b58,0,.97,.03,1.50,.50,2.18);
    box(model,color,0,1.23,.08,1.43,.15,1.58);
    for(const side of [-1,1]){
      box(model,0xdce5dc,side*.57,.63,-2.078,.37,.14,.024);
      box(model,0xb3453c,side*.58,.62,2.078,.34,.13,.024);
      box(model,color,side*.85,.94,-.64,.2,.12,.23);
      for(const axle of [-1.25,1.25]){
        const tire=new THREE.Mesh(wheel,material(0x252c32));
        tire.position.set(side*.81,.34,axle);
        model.add(tire);
      }
    }
  };

  const firstStall=minX+6.25;
  const count=Math.floor((width-12.5)/STALL_WIDTH);
  const lastStall=firstStall+count*STALL_WIDTH;
  for(const [row,lane] of lanes.entries()){
    for(const side of [-1,1]){
      const back=lane+side*8.13;
      const z=lane+side*5.69;
      paint(STRIPE,(firstStall+lastStall)/2,back,lastStall-firstStall,.075);
      for(let i=0;i<=count;i++)paint(STRIPE,firstStall+i*STALL_WIDTH,z,.075,4.8);
      for(let i=0;i<count;i++){
        const x=firstStall+(i+.5)*STALL_WIDTH;
        if((i*3+row*2+(side===1?1:0))%8<2)car(x,z,side===1?0:Math.PI,CARS[(i+row*3+(side===1?2:0))%CARS.length]);
      }
    }
    for(let x=firstStall+1.5;x<lastStall;x+=4.7)paint(0xacaaa0,x,lane,1.8,.075);
    for(let x=firstStall+5.3;x<lastStall;x+=10.6){
      box(group,0xa3acad,x,1.58,lane+8.14,.48,3.16,.48);
      box(group,0x396473,x,.56,lane+8.14,.505,.58,.505);
      box(group,0xe5b467,x,.92,lane+8.14,.51,.11,.51);
      box(group,0xe7f3f4,x,2.98,lane+7.79,1.75,.12,.16,true);
    }
  }

  const arrow=new THREE.Shape();
  arrow.moveTo(-.9,-.12);arrow.lineTo(.12,-.12);arrow.lineTo(.12,-.43);
  arrow.lineTo(.97,0);arrow.lineTo(.12,.43);arrow.lineTo(.12,.12);arrow.lineTo(-.9,.12);
  arrow.closePath();
  const arrowGeometry=groundShapeGeometry(arrow,1);
  geometries.push(arrowGeometry);
  for(const [x,z,heading] of [[minX+3.2,midZ,-Math.PI/2],[maxX-3.3,midZ,Math.PI/2],[maxX-9,rampZ+1.45,0],[maxX-9,rampZ-1.45,Math.PI]]){
    const marker=new THREE.Mesh(arrowGeometry,material(AMBER));
    marker.position.set(x,.027,z);
    marker.rotation.y=heading;
    group.add(marker);
  }

  const run=23,rise=GROUND_LEVEL-FLOOR_Y,slope=Math.atan2(rise,run),length=Math.hypot(run,rise);
  const ramp=new THREE.Group();
  ramp.position.set(maxX,0,rampZ);
  ramp.rotation.z=slope;
  group.add(ramp);
  box(ramp,0x616971,length/2,-.12,0,length,.24,rampHalf*2);
  for(const side of [-1,1]){
    box(ramp,WALL,length/2,.31,side*(rampHalf+.05),length,.62,.26);
    box(ramp,AMBER,length/2,.025,side*(rampHalf-.27),length,.025,.08);
  }
  for(let x=2;x<length-1;x+=3.4)box(ramp,STRIPE,x,.025,0,1.3,.025,.085);
  const surfaceRamp=new THREE.Group();
  surfaceRamp.position.set(maxX,FLOOR_Y,rampZ);
  const driveway=ramp.clone(true);
  driveway.position.set(0,0,0);
  surfaceRamp.add(driveway);
  const retaining=new THREE.Shape();
  retaining.moveTo(0,0);retaining.lineTo(run,rise);retaining.lineTo(0,rise);retaining.closePath();
  const retainingGeometry=new THREE.ExtrudeGeometry(retaining,{depth:.2,bevelEnabled:false});
  geometries.push(retainingGeometry);
  const edge=rampHalf+.15;
  for(const side of [-1,1]){
    const sideWall=new THREE.Mesh(retainingGeometry,material(WALL));
    sideWall.position.z=side*edge-.1;
    surfaceRamp.add(sideWall);
    box(surfaceRamp,0x6e7d7b,run/2,rise+.24,side*edge,run,.48,.25);
    box(surfaceRamp,AMBER,run-.25,rise+.3,side*edge,.35,.60,.26);
  }
  box(surfaceRamp,0x616971,run+2.4,rise-.11,0,4.8,.24,rampHalf*2);
  for(const z of [-rampHalf,rampHalf])box(group,0x426675,maxX,1.4,rampZ+z,.5,2.8,.44);
  box(group,0x355766,maxX,2.8,rampZ,.48,.46,rampHalf*2+.45);

  function sign(label,detail,x,y,z,width,height,rotation=0){
    const canvas=document.createElement('canvas');
    canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#304f60';ctx.fillRect(0,0,512,128);
    ctx.fillStyle='#ecc372';ctx.fillRect(0,0,12,128);
    ctx.textBaseline='middle';
    ctx.font='bold 63px system-ui';ctx.fillText(label,34,64);
    ctx.fillStyle='#f0f4ec';ctx.font='600 31px system-ui';ctx.fillText(detail,146,66);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const geometry=new THREE.PlaneGeometry(width,height);
    const face=new THREE.MeshBasicMaterial({map:texture,fog:false});
    geometries.push(geometry);materials.set(texture,face);
    const board=new THREE.Mesh(geometry,face);
    board.position.set(x,y,z);board.rotation.y=rotation;group.add(board);
  }
  sign('B1','PARKING',midX,2.48,minZ+.182,7.8,1.05);
  sign('B1','EXIT RAMP',maxX-.247,2.8,rampZ,5.5,.39,-Math.PI/2);

  group.add(new THREE.HemisphereLight(0xe5f4fc,0xa7a8a3,1.8));
  const light=new THREE.DirectionalLight(0xfff5de,1.35);
  light.position.set(18,36,22);group.add(light);
  batch(group);
  return {
    group,
    surfaceRamp,
    opening:{minX:maxX,maxX:maxX+run,minZ:rampZ-edge,maxZ:rampZ+edge},
    target:new THREE.Vector3(midX+run*.17,FLOOR_Y-.35,midZ),
    framePoints:[
      ...[minX,maxX].flatMap(x=>[minZ,maxZ].map(z=>new THREE.Vector3(x,FLOOR_Y,z))),
      new THREE.Vector3(minX,FLOOR_Y+3.6,minZ),
      ...[-1,1].map(side=>new THREE.Vector3(maxX+run,GROUND_LEVEL,rampZ+side*edge)),
      ...[-1,1].flatMap(side=>[
        new THREE.Vector3(elevatorPosition.x+side*elevatorPosition.width/2,FLOOR_Y+3.35,elevatorPosition.z-elevatorPosition.depth/2),
        new THREE.Vector3(elevatorPosition.x+side*elevatorPosition.width/2,FLOOR_Y+3.35,elevatorPosition.z+elevatorPosition.depth/2),
      ]),
    ],
    dispose(){
      group.removeFromParent();
      surfaceRamp.removeFromParent();
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials.values())material.dispose();
      for(const texture of textures)texture.dispose();
      elevator.dispose();
    },
  };
}

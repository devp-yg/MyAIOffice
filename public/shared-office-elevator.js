import * as THREE from './vendor/three/three.module.js';

const WIDTH=2.8,DEPTH=2.8;
const COLORS={frame:0x526a70,metal:0xb8c4c1,glass:0x8fc2c5,door:0x687d81,light:0xffdf9a,floor:0xe2d9c5};

function createSign(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
  const context=canvas.getContext('2d');
  context.fillStyle='#304f60';context.fillRect(0,0,512,160);
  context.fillStyle='#e9bd70';context.fillRect(0,0,14,160);
  context.fillStyle='#f5f1e5';context.font='700 72px system-ui';context.textBaseline='middle';context.fillText('B1  ↕  1F',34,80);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function makeElevator({x,z,baseY,topY,parking=false}){
  const root=new THREE.Group();root.position.set(x,baseY,z);
  const geometry=new THREE.BoxGeometry(1,1,1);
  const materials=new Map();
  const material=(color,options={})=>{
    const key=`${color}:${options.transparent||false}:${options.emissive||0}`;
    if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.52,...options}));
    return materials.get(key);
  };
  const addBox=(parent,color,px,py,pz,w,h,d,options={})=>{
    const mesh=new THREE.Mesh(geometry,material(color,options));
    mesh.position.set(px,py,pz);mesh.scale.set(w,h,d);mesh.castShadow=!options.transparent;mesh.receiveShadow=true;mesh.userData.unbatched=true;parent.add(mesh);return mesh;
  };
  const height=topY-baseY;
  const post=.13;
  for(const sx of [-1,1])for(const sz of [-1,1])addBox(root,COLORS.frame,sx*(WIDTH/2-post/2),height/2,sz*(DEPTH/2-post/2),post,height,post);
  // Frosted glass keeps the lift readable while leaving the office open visually.
  const glass={transparent:true,opacity:.22,depthWrite:false,metalness:.08};
  for(const side of [-1,1]){
    addBox(root,COLORS.glass,side*(WIDTH/2-post/2),height/2,0,post,height,DEPTH-post,glass);
    addBox(root,COLORS.glass,0,height/2,side*(DEPTH/2-post/2),WIDTH-post,height,post,glass);
  }
  // Opposing doors connect the park approach to the office interior.
  const doorY=parking?1.16:1.05;
  const entranceSide=-1,doorZ=entranceSide*(DEPTH/2+.035);
  addBox(root,COLORS.door,-.42,doorY,doorZ,.91,2.12,.075);
  addBox(root,COLORS.door,.42,doorY,doorZ,.91,2.12,.075);
  addBox(root,COLORS.metal,0,doorY,doorZ,.055,2.2,.035);
  addBox(root,COLORS.metal,-1.02,1.5,entranceSide*(DEPTH/2+.09),.36,.09,.12);
  addBox(root,COLORS.light,-1.02,1.54,entranceSide*(DEPTH/2+.15),.11,.025,.07,{emissive:COLORS.light,emissiveIntensity:.7});
  addBox(root,COLORS.floor,0,.045,0,WIDTH-.18,.09,DEPTH-.18);
  addBox(root,COLORS.light,0,height-.08,0,WIDTH-.42,.08,DEPTH-.42,{emissive:COLORS.light,emissiveIntensity:.38});
  const texture=createSign(),signMaterial=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
  const signGeometry=new THREE.PlaneGeometry(2.05,.64);
  for(const side of [-1,1]){
    const sign=new THREE.Mesh(signGeometry,signMaterial);
    sign.position.set(0,height-.34,side*(DEPTH/2+.015));
    if(side<0)sign.rotation.y=Math.PI;
    sign.userData.unbatched=true;root.add(sign);
  }
  root.userData.unbatched=true;
  return {root,dispose(){geometry.dispose();signGeometry.dispose();texture.dispose();for(const item of materials.values())item.dispose();signMaterial.dispose();}};
}

export function buildOfficeElevator(parent,layout){
  const lift=makeElevator({x:layout.elevator.x,z:layout.elevator.z,baseY:-.04,topY:3.25});
  parent.add(lift.root);return lift;
}

export function buildParkingElevator(parent,elevator){
  const lift=makeElevator({x:elevator.x,z:elevator.z,baseY:0,topY:3.35,parking:true});
  parent.add(lift.root);return lift;
}

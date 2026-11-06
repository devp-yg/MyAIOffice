import * as THREE from './vendor/three/three.module.js';

// A small tuxedo cat that patrols only the outdoor courtyard perimeter.
// Its route stays on the paved edge, clear of planted beds and every office room.
export class CourtyardCat {
  constructor(parent, courtyardStart) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.root.scale.setScalar(.58);
    this.materials = {
      black: new THREE.MeshStandardMaterial({color:0x202329,roughness:.82}),
      white: new THREE.MeshStandardMaterial({color:0xf5f1e8,roughness:.9}),
      pink: new THREE.MeshStandardMaterial({color:0xd78f91,roughness:.8}),
      eye: new THREE.MeshStandardMaterial({color:0xd5b75d,roughness:.55}),
    };
    this.geometries = [
      new THREE.SphereGeometry(1,16,12),
      new THREE.ConeGeometry(1,1,12),
      new THREE.CylinderGeometry(.055,.075,.29,10),
    ];
    const [ball,cone,legGeometry]=this.geometries;
    const add=(geometry,material,parent=this.root)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    this.body=new THREE.Group();this.root.add(this.body);
    const torso=add(ball,this.materials.black,this.body);torso.position.set(0,.43,-.08);torso.scale.set(.34,.33,.55);
    const bib=add(ball,this.materials.white,this.body);bib.position.set(0,.42,.34);bib.scale.set(.20,.27,.08);
    this.head=new THREE.Group();this.head.position.set(0,.70,.38);this.body.add(this.head);
    const face=add(ball,this.materials.black,this.head);face.scale.set(.29,.27,.27);
    for(const side of [-1,1]){
      const ear=add(cone,this.materials.black,this.head);ear.position.set(side*.18,.22,-.005);ear.scale.set(.12,.23,.10);ear.rotation.z=side*-.16;
      const inner=add(cone,this.materials.pink,this.head);inner.position.set(side*.18,.22,.055);inner.scale.set(.058,.13,.025);inner.rotation.z=side*-.16;
      const eye=add(ball,this.materials.eye,this.head);eye.position.set(side*.115,.015,.238);eye.scale.set(.042,.05,.025);
      const pupil=add(ball,this.materials.black,this.head);pupil.position.set(side*.115,.015,.26);pupil.scale.set(.014,.036,.012);
      for(let i=0;i<2;i++){
        const whisker=add(new THREE.CylinderGeometry(.006,.006,.20,5),this.materials.white,this.head);
        whisker.position.set(side*.25,-.055-i*.035,.19);whisker.rotation.z=side*(Math.PI/2-.18+i*.17);
      }
    }
    const nose=add(ball,this.materials.pink,this.head);nose.position.set(0,-.065,.255);nose.scale.set(.045,.032,.025);
    this.legs=[];
    for(const x of [-.20,.20])for(const z of [-.37,.31]){
      const leg=add(legGeometry,this.materials.black,this.body);leg.position.set(x,.19,z);
      const paw=add(ball,this.materials.white,this.body);paw.position.set(x,.055,z+.015);paw.scale.set(.09,.055,.105);
      this.legs.push(leg);
    }
    this.tail=new THREE.Group();this.tail.position.set(0,.52,-.52);this.body.add(this.tail);
    const tailBase=add(new THREE.CylinderGeometry(.07,.09,.5,10),this.materials.black,this.tail);tailBase.position.y=.25;tailBase.rotation.x=.38;
    const tailTip=add(ball,this.materials.black,this.tail);tailTip.position.set(0,.48,.10);tailTip.scale.set(.075,.075,.09);

    const z=courtyardStart;
    this.route=[{x:7.0,z:z+.65},{x:25.6,z:z+.65},{x:25.6,z:z+12.95},{x:7.0,z:z+12.95}];
    this.target=1;this.speed=1.55;this.distance=0;this.motion=true;
    this.root.position.set(this.route[0].x,0,this.route[0].z);
  }
  update(dt,time,motion=true){
    this.motion=motion;
    if(!motion)return;
    const point=this.route[this.target],dx=point.x-this.root.position.x,dz=point.z-this.root.position.z,distance=Math.hypot(dx,dz),step=this.speed*dt;
    if(distance<=step){this.root.position.set(point.x,0,point.z);this.target=(this.target+1)%this.route.length;}
    else{this.root.position.x+=dx/distance*step;this.root.position.z+=dz/distance*step;this.root.rotation.y=Math.atan2(dx,dz);this.distance+=step;}
    const stride=time*.012;
    this.body.position.y=.035+Math.abs(Math.sin(stride))*.045;
    this.body.rotation.z=Math.sin(stride)*.035;
    this.legs.forEach((leg,index)=>{leg.rotation.x=Math.sin(stride+(index%2)*Math.PI+(index>1?Math.PI:0))*.45;});
    this.tail.rotation.x=Math.sin(time*.002)*.22;
    this.head.rotation.y=Math.sin(time*.0015)*.13;
  }
  dispose(){
    this.root.removeFromParent();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of Object.values(this.materials))material.dispose();
    this.root.traverse(object=>{if(object.isMesh&&!this.geometries.includes(object.geometry))object.geometry.dispose();});
  }
}

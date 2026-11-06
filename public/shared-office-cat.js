import * as THREE from './vendor/three/three.module.js';
import {OfficeWalker} from './office-navigation.js';

export const COURTYARD_CATS = [
  {name:'토양이', coat:0x202329, markings:0xf5f1e8, eyes:0xd5b75d,
    build:[.57,.73,.65], head:[.94,1.03,.96], earHeight:.29, tail:'upright', speed:1.85, loafChance:.30},
  {name:'포키', coat:0xf1e8d6, markings:0xfbf4e7, eyes:0x77afcb, boots:0x222126,
    build:[.76,.69,.66], head:[1.15,1.06,1.02], earHeight:.17, tail:'fluffy', speed:1.25, loafChance:.58},
  {name:'치즈냥이', coat:0xe4964f, markings:0xffe1b9, eyes:0x91ad72, stripes:0xb95d2f,
    build:[.71,.58,.82], head:[1.08,.91,1.03], earHeight:.21, tail:'hook', speed:1.65, loafChance:.37},
];

const TAILS = {
  upright:{radius:.052,points:[[0,0,0],[0,.29,-.12],[.015,.58,-.18],[.09,.76,-.12]]},
  fluffy:{radius:.125,points:[[0,0,0],[.04,.08,-.22],[.12,.17,-.43],[.20,.29,-.52]]},
  hook:{radius:.078,points:[[0,0,0],[0,.05,-.24],[-.07,.19,-.43],[-.17,.38,-.46],[-.22,.45,-.36]]},
};

export class CourtyardCat {
  constructor(parent, habitat, appearance, startIndex, random=Math.random) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.root.scale.set(...appearance.build);
    this.materials = {
      coat: new THREE.MeshStandardMaterial({color:appearance.coat,roughness:.82}),
      markings: new THREE.MeshStandardMaterial({color:appearance.markings,roughness:.9}),
      pink: new THREE.MeshStandardMaterial({color:0xd78f91,roughness:.8}),
      eye: new THREE.MeshStandardMaterial({color:appearance.eyes,roughness:.55}),
      pupil: new THREE.MeshStandardMaterial({color:0x202329,roughness:.65}),
      mouth: new THREE.MeshStandardMaterial({color:0x57262d,roughness:.92}),
    };
    this.geometries = [
      new THREE.SphereGeometry(1,16,12),
      new THREE.ConeGeometry(1,1,12),
      new THREE.CylinderGeometry(.055,.075,.29,10),
    ];
    const [ball,cone,legGeometry]=this.geometries;
    const add=(geometry,material,parent=this.root)=>{const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    this.body=new THREE.Group();this.root.add(this.body);
    const torso=add(ball,this.materials.coat,this.body);torso.position.set(0,.46,-.08);torso.scale.set(.36,.35,.60);
    const bib=add(ball,this.materials.markings,this.body);bib.position.set(0,.43,.42);bib.scale.set(.20,.26,.12);
    const neck=add(ball,this.materials.coat,this.body);neck.position.set(0,.64,.27);neck.scale.set(.235,.245,.25);
    if(appearance.stripes){
      const stripe=this.materials.stripe=new THREE.MeshStandardMaterial({color:appearance.stripes,roughness:.88});
      for(const offset of [-.35,-.17,.01]){
        const points=Array.from({length:9},(_,i)=>{
          const angle=(i-4)*.32;
          const z=offset+.07*Math.cos(angle);
          const crossSection=Math.sqrt(1-(z/.60)**2);
          return new THREE.Vector3(
            .36*crossSection*Math.sin(angle),
            .46+.35*crossSection*Math.cos(angle),
            -.08+z,
          );
        });
        const curve=new THREE.CatmullRomCurve3(points);
        add(new THREE.TubeGeometry(curve,16,.022,6,false),stripe,this.body);
      }
    }
    this.head=new THREE.Group();this.head.position.set(0,.66,.34);this.body.add(this.head);
    this.head.scale.set(...appearance.head);
    const face=add(ball,this.materials.coat,this.head);face.scale.set(.29,.27,.27);
    this.ears=[];this.eyes=[];
    for(const side of [-1,1]){
      const ear=new THREE.Group();
      ear.position.set(side*.18,.15,-.005);ear.rotation.z=side*-.22;this.head.add(ear);this.ears.push(ear);
      const fur=add(cone,this.materials.coat,ear);fur.position.y=appearance.earHeight*.36;fur.scale.set(.12,appearance.earHeight,.10);
      const inner=add(cone,this.materials.pink,ear);inner.position.set(0,fur.position.y,.055);inner.scale.set(.058,appearance.earHeight*.58,.025);
      const eye=new THREE.Group();eye.position.set(side*.115,.015,.238);this.head.add(eye);this.eyes.push(eye);
      add(ball,this.materials.eye,eye).scale.set(.042,.05,.025);
      const pupil=add(ball,this.materials.pupil,eye);pupil.position.z=.022;pupil.scale.set(.014,.036,.012);
      if(appearance.tail==='fluffy'){
        const cheek=add(ball,this.materials.markings,this.head);
        cheek.position.set(side*.20,-.075,.06);cheek.scale.set(.145,.15,.18);
      }
      if(appearance.stripes){
        const brow=add(ball,this.materials.stripe,this.head);
        brow.position.set(side*.08,.144,.199);brow.scale.set(.023,.078,.02);brow.rotation.z=side*.39;
      }
      for(let i=0;i<2;i++){
        const whisker=add(new THREE.CylinderGeometry(.006,.006,.20,5),this.materials.markings,this.head);
        whisker.position.set(side*.25,-.055-i*.035,.19);whisker.rotation.z=side*(Math.PI/2-.18+i*.17);
      }
    }
    const nose=add(ball,this.materials.pink,this.head);nose.position.set(0,-.065,.255);nose.scale.set(.045,.032,.025);
    this.hissMouth=new THREE.Group();this.hissMouth.position.set(0,-.135,.226);this.head.add(this.hissMouth);
    const openMouth=add(ball,this.materials.mouth,this.hissMouth);openMouth.scale.set(.107,.084,.04);
    for(const side of [-1,1]){
      const fang=add(cone,this.materials.markings,this.hissMouth);
      fang.position.set(side*.058,.032,.028);fang.scale.set(.018,.066,.018);fang.rotation.z=Math.PI;
    }
    this.hissMouth.visible=false;
    this.legs=[];
    let bootGeometry;
    if(appearance.boots!==undefined){
      this.materials.boots=new THREE.MeshStandardMaterial({color:appearance.boots,roughness:.9});
      bootGeometry=new THREE.CylinderGeometry(.065,.077,.175,10);
      this.geometries.push(bootGeometry);
    }
    for(const x of [-.20,.20])for(const z of [-.37,.31]){
      const leg=new THREE.Group();leg.position.set(x,.32,z);this.body.add(leg);
      add(legGeometry,this.materials.coat,leg).position.y=-.14;
      if(bootGeometry)add(bootGeometry,this.materials.boots,leg).position.y=-.1975;
      const paw=add(ball,this.materials.boots??this.materials.markings,leg);paw.position.set(0,-.275,.015);paw.scale.set(.09,.055,.105);
      this.legs.push(leg);
    }
    this.tail=new THREE.Group();this.tail.position.set(0,.52,-.52);this.body.add(this.tail);
    const {radius,points}=TAILS[appearance.tail];
    const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));
    add(new THREE.TubeGeometry(curve,16,radius,8,false),this.materials.coat,this.tail);
    const tailTip=add(ball,this.materials.coat,this.tail);
    tailTip.position.copy(curve.getPoint(1));tailTip.scale.setScalar(radius);

    this.habitat=habitat;this.appearance=appearance;this.random=random;
    this.walker=new OfficeWalker(habitat.navigator,habitat.starts[startIndex]);
    this.action='watch';
    this.remaining=.9+startIndex*.85;
    this.elapsed=startIndex*2.4;
    this.hissCooldown=0;
    this.placeOnGround();
  }
  placeOnGround(){
    const point=this.walker.position;
    this.root.position.set(point.x,this.habitat.floorHeight(point)+.012,point.z);
  }
  chooseDestination(){
    const {x,z}=this.walker.position;
    const minimum=this.random()<.34?13:4;
    const choices=this.habitat.destinations.filter(point=>{
      const distance=Math.hypot(x-point.x,z-point.z);
      return distance>=minimum&&distance<minimum+12;
    });
    if(choices.length){
      const target=choices[Math.floor(this.random()*choices.length)];
      this.walker.setDestination(target,null);
    }
    this.action=this.walker.walking?'walk':'watch';
    this.remaining=1;
  }
  rest(){
    const choice=this.random();
    if(choice<this.appearance.loafChance){
      this.action='loaf';this.remaining=4+this.random()*6;
    }else if(choice<.78){
      this.action='sniff';this.remaining=1.2+this.random()*1.5;
    }else{
      this.action='watch';this.remaining=1.8+this.random()*2;
    }
  }
  update(dt,motion,nearby){
    if(!motion)return;
    this.elapsed+=dt;
    this.hissCooldown-=dt;
    if(nearby&&this.hissCooldown<=0){
      this.action='hiss';this.remaining=1.05;this.hissCooldown=18+this.random()*10;
      this.hissHeading=Math.atan2(nearby.x-this.root.position.x,nearby.z-this.root.position.z);
    }
    if(this.action==='walk'){
      this.walker.tick(dt,this.appearance.speed);
      this.placeOnGround();
      if(!this.walker.walking)this.rest();
    }else if((this.remaining-=dt)<=0){
      if(this.walker.walking)this.action='walk';
      else this.chooseDestination();
    }
    this.updatePose(dt);
  }
  updatePose(dt){
    const walking=this.action==='walk',loaf=this.action==='loaf';
    const hissing=this.action==='hiss',sniffing=this.action==='sniff';
    const t=this.elapsed,stride=this.walker.distanceWalked*10;
    const blend=Math.min(1,dt*10);
    const approach=(value,target)=>THREE.MathUtils.lerp(value,target,blend);
    if(walking||hissing){
      const heading=hissing?this.hissHeading:this.walker.heading;
      const difference=heading-this.root.rotation.y;
      this.root.rotation.y+=Math.atan2(Math.sin(difference),Math.cos(difference))*blend;
    }
    const bodyY=loaf?-.11:walking?Math.abs(Math.sin(stride))*.05:Math.sin(t*3)*.009;
    this.body.position.y=approach(this.body.position.y,bodyY);
    this.body.scale.y=approach(this.body.scale.y,loaf?.85:hissing?1.14:1);
    this.body.rotation.z=approach(this.body.rotation.z,walking?Math.sin(stride)*.035:0);
    for(const [index,leg] of this.legs.entries()){
      const front=index%2===1;
      const phase=(front===(index>1)?Math.PI:0);
      const swing=loaf?(front?1.33:-1.33):walking?Math.sin(stride+phase)*.46:0;
      leg.rotation.x=approach(leg.rotation.x,swing);
    }
    this.tail.rotation.x=approach(this.tail.rotation.x,loaf?.75:hissing?-.24:Math.sin(t*3)*.16);
    this.tail.rotation.y=approach(this.tail.rotation.y,loaf?-.6:Math.sin(t*4)*(hissing?.32:.13));
    this.head.rotation.x=approach(this.head.rotation.x,sniffing?.48+Math.sin(t*10)*.09:hissing?-.15:0);
    this.head.rotation.y=approach(this.head.rotation.y,hissing?0:Math.sin(t*2)*(walking?.10:.24));
    for(const ear of this.ears)ear.rotation.x=approach(ear.rotation.x,hissing?-1.15:Math.sin(t*4)*.08);
    for(const eye of this.eyes)eye.scale.y=approach(eye.scale.y,loaf?.15:hissing?.60:1);
    this.hissMouth.visible=hissing;
  }
  dispose(){
    this.root.removeFromParent();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of Object.values(this.materials))material.dispose();
    this.root.traverse(object=>{if(object.isMesh&&!this.geometries.includes(object.geometry))object.geometry.dispose();});
  }
}

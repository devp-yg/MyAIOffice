import * as THREE from './vendor/three/three.module.js';
import {beginCameraOrbit,characterFocusPoint} from './office-camera.js';
import {OfficeScene,createCharacter,disposeCharacter,furniture} from './office-scene.js';
import {OfficeNavigator,OfficeWalker} from './office-navigation.js';
import {SHARED_ROOMS,ROOM_CORNER_RADIUS,ZONE_BOUNDARY_STYLES,createSharedLayout,createPreviewAssignments} from './shared-office-layout.js?v=20261107-3';
import {buildWoodenSign} from './office-room-signs.js';
import {SharedExecutiveWing} from './shared-office-executive.js';
import {celestialAt} from './office-celestial.js';
import {SharedOfficeSky} from './shared-office-sky.js';
import {buildPerimeter} from './shared-office-perimeter.js';
import {buildSharedParking} from './shared-office-parking.js';
import {buildOfficeElevator} from './shared-office-elevator.js';
import {buildOfficeTerrain,buildSharedGround,groundShapeGeometry,CITY_CAMERA_LIMIT,GROUND_LEVEL,WORLD_DISTANCE} from './shared-office-ground.js';
import {SharedOfficeLabels} from './shared-office-labels.js';
import {OfficeVisitor} from './office-visitor.js';
import {COURTYARD_CATS,CourtyardCat} from './shared-office-cat.js';
import {createCatHabitat} from './shared-office-cat-habitat.js';

const materialCache=new Map();
const CAT_ACTION_LABELS={loaf:'식빵 굽는 중',sniff:'킁킁',hiss:'하악!'};
const MAP_CAMERA_LABEL='공용 오피스 3D 공간. 드래그로 이동, Shift + 드래그로 회전, 스크롤로 확대할 수 있습니다. 고양이나 말풍선을 선택하면 고양이 시점으로 전환합니다.';
const PARKING_BACKGROUND=new THREE.Color('#2c3a44');
const DAY_LIGHT=new THREE.Color('#fff4dc'),TWILIGHT_LIGHT=new THREE.Color('#ffc58c');
const MAP_ELEVATION=21*Math.PI/180;
const MIN_MAP_ZOOM=.8;
const SEAT_BACKSET=.25,SOFA_BACKSET=.82,SOFA_LIFT=.32;
function mat(color){if(!materialCache.has(color))materialCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return materialCache.get(color);}
const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12),cylinder=new THREE.CylinderGeometry(1,1,1,48);
function mesh(parent,geometry,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>mesh(p,cube,c,x,y,z,w,h,d);
function restingPoint(seat){const backset=seat.room==='desk'?SOFA_BACKSET:seat.room==='studio'?-.08:SEAT_BACKSET;return{x:seat.x-Math.sin(seat.heading)*backset,z:seat.z-Math.cos(seat.heading)*backset};}
function roundedShape(x0,x1,z0,z1,r=1.5){
  const s=new THREE.Shape();s.moveTo(x0+r,z0);s.lineTo(x1-r,z0);s.quadraticCurveTo(x1,z0,x1,z0+r);s.lineTo(x1,z1-r);s.quadraticCurveTo(x1,z1,x1-r,z1);s.lineTo(x0+r,z1);s.quadraticCurveTo(x0,z1,x0,z1-r);s.lineTo(x0,z0+r);s.quadraticCurveTo(x0,z0,x0+r,z0);return s;
}
function tile(parent,shape,color,y){const geometry=groundShapeGeometry(shape,48);const m=mesh(parent,geometry,color,0,y,0);m.material=new THREE.MeshStandardMaterial({color,roughness:.95});m.castShadow=false;return m;}
function zoneBoundary(parent,item,glassMaterial){
  const g=new THREE.Group();g.position.set(item.x,0,item.z);g.rotation.y=item.rotation;parent.add(g);
  const {w,h}=item,d=item.bodyDepth;
  box(g,0xd9d2bf,0,.075,0,w,.15,d+.025);
  if(item.finish==='shelf'){
    box(g,0xb19a77,0,h/2,0,w,h-.1,d);
    if(w>.8){
      for(const side of [-1,1]){
        box(g,0x7e6b51,0,.58,side*(d/2+.004),w-.1,.61,.015);
        const count=Math.max(2,Math.floor(w/.19));
        for(let i=0;i<count;i++){const height=.31+(i%3)*.055,x=-w/2+.14+i*(w-.28)/Math.max(1,count-1);box(g,[0xa0ae86,0xc09c76,0x8eaba8,0xaf98b4,0xceba82][i%5],x,.3+height/2,side*.145,Math.min(.12,w/count*.65),height,.09);}
        box(g,0xd3bd96,0,.29,side*.12,w,.065,.13);
      }
    }
    box(g,0xdcc7a2,0,h-.025,0,w+.025,.075,d+.025);
  }else if(item.finish==='glass'){
    box(g,0x9fafb4,0,.26,0,w,.52,d);
    box(g,0xdce2d9,0,.55,0,w,.065,d+.025);
    const pane=new THREE.Mesh(cube,glassMaterial);pane.position.set(0,(h+.59)/2,0);pane.scale.set(w,h-.59,.065);pane.castShadow=false;g.add(pane);
    box(g,0x758c96,0,h,0,w+.02,.055,.1);
    if(w>.8)for(const x of [-w/2+.025,w/2-.025])box(g,0x899fa7,x,(h+.55)/2,0,.045,h-.55,.1);
  }else if(item.finish==='fabric'){
    box(g,0x9d88ad,0,h/2,0,w,h-.08,d);
    if(w>.8)for(const side of [-1,1])box(g,0xbeadc9,0,h*.52,side*(d/2+.008),w-.12,h-.25,.018);
    box(g,0x887293,0,h-.025,0,w+.02,.065,d+.025);
  }else{
    const baseHeight=item.room==='studio'?.56:.48;
    box(g,0xd9d9c6,0,baseHeight/2,0,w,baseHeight,d);
    box(g,0xb6b9a0,0,baseHeight+.015,0,w+.02,.06,d+.025);
    box(g,0x6d865d,0,baseHeight+.16,0,w,.25,d*.82);
    const count=Math.max(1,Math.ceil(w/.5));
    for(let i=0;i<count;i++)mesh(g,sphere,[0x829c6d,0x97af7c,0x6e8b5d][i%3],-w/2+(i+.5)*w/count,h-.08,0,Math.min(.27,w/count*.6),.15,.14);
  }
}
function batchStatic(root){
  root.updateMatrixWorld(true);const groups=new Map(),inverse=root.matrixWorld.clone().invert();
  root.traverse(node=>{if(!node.isMesh||node.userData.room||node.userData.unbatched||node.material.transparent)return;const key=node.geometry.uuid+node.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);});
  for(const meshes of groups.values()){
    if(meshes.length<3)continue;
    const instanced=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);instanced.castShadow=meshes.some(m=>m.castShadow);instanced.receiveShadow=true;
    meshes.forEach((m,i)=>{instanced.setMatrixAt(i,inverse.clone().multiply(m.matrixWorld));m.removeFromParent();});root.add(instanced);
  }
}

export class SharedOfficeScene {
  constructor(element,{onRoom,onActor,onOwner,onOwnerStatus,onView,onCatView,onFloor,onWalkEnd,preferences={}}={}){
    this.element=element;this.onRoom=onRoom;this.onActor=onActor;this.onOwner=onOwner;this.onOwnerStatus=onOwnerStatus;this.onView=onView;this.onWalkEnd=onWalkEnd;
    this.scene=new THREE.Scene();this.outdoorSky=new SharedOfficeSky(this.scene);this.lightingMinute=-1;this.location=null;this.ambientFixtures=[];
    this.world=new THREE.Group();this.scene.add(this.world);this.camera=new THREE.PerspectiveCamera(57,1,1,WORLD_DISTANCE);
    this.catCamera=new THREE.PerspectiveCamera(65,1,.09,WORLD_DISTANCE);
    this.catLookTarget=new THREE.Vector3();this.catView=null;this.onCatView=onCatView;this.onFloor=onFloor;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const canvas=this.renderer.domElement;canvas.setAttribute('aria-label',MAP_CAMERA_LABEL);canvas.setAttribute('role','img');element.append(canvas);
    this.sky=new THREE.HemisphereLight(0xfff9ed,0xb0bc9f,1.9);this.scene.add(this.sky);
    this.sun=new THREE.DirectionalLight(0xfff4dc,2.1);this.sun.position.set(-16,32,8);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:80});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.03;this.sun.shadow.radius=4;this.scene.add(this.sun,this.sun.target);
    this.angle=.48;this.elevation=MAP_ELEVATION;this.zoom=1;this.viewTarget=new THREE.Vector3(0,0,0);this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.showLabels=true;this.project=null;this.selectedId=null;this.selectedOwner=false;this.selectedAmbient=null;this.selectedRoom=null;this.actors=[];this.lights=[];
    this.labelLayer=document.createElement('div');this.labelLayer.className='study-labels';element.append(this.labelLayer);
    this.cats=[];
    this.roomSigns=new Map();
    this.landmarkSigns=[];
    this.executive=new SharedExecutiveWing(this.world,this.labelLayer,{batch:batchStatic,onOwnerSelect:()=>this.onOwner?.(),onSecretarySelect:()=>this.selectAmbient('secretary'),preferences});
    this.executive.secretary.root.userData.ambientCharacter='secretary';this.executive.companion.root.userData.ambientCharacter='secretary';
    this.actorLabels=new SharedOfficeLabels(this.labelLayer);
    this.actorLabels.add(this.executive.ownerLabel,{
      model:()=>this.executive.owner,name:()=>this.executive.ownerName,
      working:()=>this.executive.patrol.active||this.executive.patrol.commandUntil>performance.now(),
      alwaysFull:true,selected:()=>this.selectedOwner,
      visible:()=>!this.executive.roof.visible||!this.isExecutivePoint(this.executive.owner.root.position),
    });
    this.actorLabels.add(this.executive.secretaryLabel,{
      model:()=>this.executive.assisting?this.executive.companion:this.executive.secretary,
      name:()=>this.executive.secretaryName,working:()=>true,selected:()=>this.selectedAmbient==='secretary',
      visible:()=>!this.executive.roof.visible||(
        this.executive.assisting&&!this.isExecutivePoint(this.executive.companion.root.position)
      ),
    });
    this.visitor=new OfficeVisitor(this.world,this.labelLayer,createCharacter,{shared:true,preferences});
    this.visitor.model.root.userData.ambientCharacter='visitor';this.visitor.label.addEventListener('click',()=>this.selectAmbient('visitor'));
    this.actorLabels.add(this.visitor.label,{
      model:()=>this.visitor.model,name:()=>this.visitor.profile.name,working:()=>false,
      alwaysFull:true,selected:()=>this.selectedAmbient==='visitor',
      visible:()=>!this.executive.roof.visible||!this.isExecutivePoint(this.visitor.model.root.position),
    });
    // Use the existing office camera gestures and keyboard controls.
    canvas.addEventListener('pointerdown',()=>{this.transition=null;});
    OfficeScene.prototype.bindControls.call(this,()=>!this.catView);
    this.setLocation(preferences.latitude,preferences.longitude);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);this.resize();this.lastTime=performance.now();this.frame=this.frame.bind(this);this.frameHandle=requestAnimationFrame(this.frame);
  }
  removeActor(actor){this.actorLabels.remove(actor.label);actor.model.root.removeFromParent();disposeCharacter(actor.model);actor.label.remove();actor.marker.geometry.dispose();actor.marker.material.dispose();actor.marker.removeFromParent();}
  clearCats(){
    for(const {model,label,actionLabel} of this.cats){
      model.dispose();
      label.remove();
      actionLabel.remove();
    }
    this.cats=[];
  }
  rebuildLayout(layout){
    const followedCat=this.catView?.appearance;
    const previous=this.layout?.bounds;
    const keepOverview=!previous||(!this.orbitFrame&&this.zoom===1&&this.viewTarget.y===0&&
      this.viewTarget.x===(previous.minX+previous.maxX)/2&&this.viewTarget.z===(previous.minZ+previous.maxZ)/2);
    this.clearCats();
    if(this.layoutGroup){
      this.disposeLayout();
    }
    this.lights=[];this.ambientFixtures=[];this.layout=layout;this.navigator=new OfficeNavigator(this.layout);
    this.parking=buildSharedParking(layout.bounds,layout.elevator,batchStatic);
    this.layoutGroup=new THREE.Group();this.world.add(this.layoutGroup);this.buildSpace();
    this.buildSigns();
    this.layoutGroup.add(this.parking.surfaceRamp);
    this.parking.group.visible=Boolean(this.parkingView);
    this.scene.add(this.parking.group);
    if(this.parkingView)this.frameOverview();
    else if(keepOverview)this.frameOverview();
    // Animated meshes must stay out of the layout group's static batch.
    const habitat=createCatHabitat(layout);
    this.cats=COURTYARD_CATS.map((appearance,index)=>{
      const model=new CourtyardCat(this.world,habitat,appearance,index);
      model.root.userData.catIndex=index;
      const label=document.createElement('button');
      label.type='button';
      label.className='study-nameplate study-cat-nameplate';
      label.textContent=appearance.name;
      label.title='고양이 시점으로 보기';
      label.setAttribute('aria-label',`${appearance.name} 시점으로 보기`);
      label.addEventListener('click',()=>this.selectCat(model));
      const actionLabel=document.createElement('button');
      actionLabel.className='study-cat-label';
      actionLabel.type='button';
      actionLabel.tabIndex=-1;
      actionLabel.hidden=true;
      actionLabel.title=label.title;
      actionLabel.addEventListener('click',()=>this.selectCat(model));
      this.labelLayer.append(label,actionLabel);
      return {model,label,actionLabel,anchor:new THREE.Vector3()};
    });
    if(followedCat)this.catView=this.cats.find(({model})=>model.appearance===followedCat).model;
    this.executive.place(layout.executive,this.navigator);
    this.visitor.update(this.navigator,0,performance.now(),this.motion,true,this.executive.spouseTargets());
    for(const actor of this.actors){actor.walker.navigator=this.navigator;actor.walker.route=[];actor.walker.pending=null;actor.walker.destination={x:Infinity,z:Infinity};}
    this.renderer.shadowMap.needsUpdate=true;this.resize();
  }
  setPreferences(preferences){
    this.motion=preferences.motion;this.executive.setPreferences(preferences);this.visitor.setProfile(preferences);
    this.setLocation(preferences.latitude,preferences.longitude);this.updateLabels();
  }
  setLocation(latitude,longitude){
    this.location=Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude}:null;
    this.lightingMinute=-1;
  }
  updateLighting(date){
    const minute=Math.floor(date.getTime()/60000);if(minute===this.lightingMinute)return;
    this.lightingMinute=minute;
    const celestial=celestialAt(date,this.location),daylight=this.outdoorSky.update(celestial),darkness=1-daylight;
    this.sky.intensity=.78+1.12*daylight;
    const [east,up,south]=celestial.sun.direction;
    this.sun.intensity=2.1*THREE.MathUtils.smoothstep(up,-.012,.24);
    this.sun.color.copy(TWILIGHT_LIGHT).lerp(DAY_LIGHT,THREE.MathUtils.smoothstep(up,.04,.35));
    this.sun.position.set(east,Math.max(.23,up),south).setLength(this.shadowSpan||40).add(this.sun.target.position);
    this.renderer.shadowMap.needsUpdate=true;
    for(const fixture of this.ambientFixtures)fixture.light.intensity=fixture.maxIntensity*darkness;
    if(this.lampGlowMaterial)this.lampGlowMaterial.emissiveIntensity=.04+darkness*.72;
    this.groundDesign?.updateLighting(darkness);
  }
  updateEntrance(dt){
    const {x,z}=this.layout.entrance;
    const opening=this.actors.some(({walker})=>walker.walking&&Math.abs(walker.position.x-x)<3.1&&Math.abs(walker.position.z-z)<1.45);
    const amount=this.motion?THREE.MathUtils.damp(this.doorAmount,Number(opening),12,dt):Number(opening);
    if(Math.abs(amount-this.doorAmount)<.0001)return;
    this.doorAmount=amount;
    this.slideDoors(amount);
  }
  setScenario(scenario){
    this.live=false;this.geometrySignature='';this.stopWalk();for(const actor of this.actors)this.removeActor(actor);this.actors=[];this.selectedId=null;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');
    this.rebuildLayout(createSharedLayout(scenario));
    for(const assignment of createPreviewAssignments(this.layout,scenario))this.addActor(assignment);
    this.setProject(this.project);this.renderer.shadowMap.needsUpdate=true;this.updateLabels();return this.actors;
  }
  setLiveData({layout,assignments}){
    if(!this.live)this.stopWalk();this.live=true;
    const animateArrivals=this.hasLiveAssignments;
    const signature=JSON.stringify({pods:layout.pods.map(p=>[p.id,p.x,p.z]),bounds:layout.bounds,executive:layout.executive});
    const changed=signature!==this.geometrySignature;
    if(changed){this.rebuildLayout(layout);this.geometrySignature=signature;this.routeSignature='';}
    const ids=new Set(assignments.map(a=>a.id));
    for(const actor of [...this.actors])if(!ids.has(actor.id)&&!actor.departing){
      if(actor.session?.active)this.departActor(actor);
      else{this.removeActor(actor);this.actors=this.actors.filter(item=>item!==actor);if(this.selectedId===actor.id)this.selectedId=null;}
    }
    for(const assignment of assignments){
      let actor=this.actors.find(a=>a.id===assignment.id);
      if(!actor){
        let startPoint=null;
        if(animateArrivals&&assignment.session?.active){
          startPoint=this.navigator.point(this.navigator.nearest(this.layout.entrance.arrival));
        }
        this.addActor(assignment,startPoint);continue;
      }
      actor.departing=false;
      actor.session=assignment.session;actor.project=assignment.project;actor.seat=assignment.seat;
      const point=restingPoint(actor.seat);
      actor.walker.setDestination(point,actor.seat.room);this.updateActorLabel(actor);
    }
    if(assignments.length)this.hasLiveAssignments=true;
    this.setProject(this.project);
  }
  buildSigns(){
    const {rooms,boundaries,entrance}=this.layout;
    this.roomSigns=new Map();
    for(const room of rooms){
      const gate=boundaries.gates.find(gate=>gate.room===room.key&&gate.side==='south');
      const door={x:gate.center,z:room.bounds[3],w:gate.width};
      const align=['studio','desk'].includes(room.key)?'right':'left';
      const sign=buildWoodenSign(this.layoutGroup,{
        door,side:gate.side,align,room:room.key,title:room.name,description:room.note,width:2.7,height:1,
      });
      this.roomSigns.set(room.key,sign);
    }
    this.landmarkSigns=[
      buildWoodenSign(this.layoutGroup,{
        door:{x:entrance.x+3.45,z:entrance.z,w:entrance.width},side:'east',
        title:'출퇴근 출입구',description:'공용 오피스 정문',width:2.2,height:.82,
      }),
    ];
  }
  buildSpace(){
    const root=this.layoutGroup;
    const {minX,maxX,minZ,maxZ}=this.layout.bounds,width=maxX-minX,depth=maxZ-minZ,centerZ=(minZ+maxZ)/2;
    box(root,0xe2e6d8,0,-.13,centerZ,width+.32,.15,depth+.32).castShadow=false;
    const terrain=buildOfficeTerrain(this.layout.bounds,this.parking.opening);
    root.add(terrain);
    const diagonal=Math.hypot(width,depth);
    this.outdoorSky.fog.near=Math.max(110,diagonal*1.45);
    this.outdoorSky.fog.far=this.outdoorSky.fog.near+310;
    this.shadowSpan=diagonal/2+7;
    const span=this.shadowSpan;
    this.sun.target.position.set(0,0,centerZ);
    Object.assign(this.sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,far:span*2.2});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.groundDesign=buildSharedGround(root,this.layout,terrain);
    this.roomMeshes=new Map();
    for(const room of this.layout.rooms){
      const [x0,x1,z0,z1]=room.bounds,r=ROOM_CORNER_RADIUS;
      const m=tile(root,roundedShape(x0,x1,z0,z1,r),room.color,.006);m.material.map=this.groundDesign.texture(room.key);m.userData.room=room.key;this.roomMeshes.set(room.key,m);
      const rim=roundedShape(x0,x1,z0,z1,r),inner=roundedShape(x0+.2,x1-.2,z0+.2,z1-.2,r-.2);
      rim.holes.push(new THREE.Path(inner.getPoints(16)));
      const geometry=new THREE.ExtrudeGeometry(rim,{depth:.055,bevelEnabled:false,curveSegments:16});geometry.rotateX(Math.PI/2);
      const trim=mesh(root,geometry,ZONE_BOUNDARY_STYLES[room.key].color,0,.075,0);trim.userData.room=room.key;
    }
    this.lampGlowMaterial=new THREE.MeshStandardMaterial({color:0xffe3a2,emissive:0xffcf78,emissiveIntensity:.04,roughness:.45});
    const addAmbientFixture=(x,z,y,maxIntensity,distance)=>{
      const light=new THREE.PointLight(0xffd99a,0,distance,2);light.position.set(x,y,z);root.add(light);this.ambientFixtures.push({light,maxIntensity});
      mesh(root,cylinder,0xd4c8a7,x,2.58,z,.22,.07,.22);
      const globe=new THREE.Mesh(sphere,this.lampGlowMaterial);globe.position.set(x,2.53,z);globe.scale.setScalar(.12);globe.castShadow=false;root.add(globe);
    };
    for(const room of this.layout.rooms){const [x0,x1,z0,z1]=room.bounds;addAmbientFixture((x0+x1)/2,(z0+z1)/2,2.28,.34,8);}
    addAmbientFixture(maxX+.28,0,2.15,.42,7);
    addAmbientFixture(this.layout.executive.bounds[1]+1,this.layout.executive.z,2.15,.34,7);
    const entryGlass=new THREE.MeshStandardMaterial({color:0x9cc9c9,transparent:true,opacity:.27,roughness:.22,depthWrite:false});
    this.slideDoors=buildPerimeter(root,this.layout,box,cube,entryGlass,this.lampGlowMaterial);
    this.doorAmount=0;
    this.officeElevator=buildOfficeElevator(root,this.layout);
    for(const side of [-1,1]){
      const z=this.layout.entrance.z+side*2.62,x=maxX+2.92;
      box(root,0xa7a089,x,.19,z,.68,.38,.66);
      box(root,0xc4b694,x,.38,z,.75,.09,.73);
      for(const [dx,dz,size]of [[-.15,-.13,.26],[.12,.10,.25],[.12,-.17,.18]]){
        mesh(root,sphere,0x718f66,x+dx,.48+size/2,z+dz,size,size*.9,size);
      }
    }
    for(const item of this.layout.furniture){
      if(item.type==='partition'){
        box(root,0xc6b8cd,item.x,item.h/2,item.z,item.w,item.h,item.d);box(root,0xdacfe0,item.x,item.h,item.z,item.w+.02,.06,item.d);
      }else if(item.type==='garden-bench'){
        const bench=new THREE.Group();bench.position.set(item.x,0,item.z);bench.rotation.y=item.rotation;root.add(bench);box(bench,0xc1a47a,0,.53,0,item.w,.16,item.d);for(const side of [-1,1])box(bench,0x7d8c76,side*.9,.24,0,.12,.48,.4);
      }else furniture(root,item,this.lights);
    }
    const boundaryGlass=new THREE.MeshStandardMaterial({color:0x8db4c3,transparent:true,opacity:.38,roughness:.25,metalness:.06,depthWrite:false,side:THREE.DoubleSide});
    for(const wall of this.layout.boundaries.walls)zoneBoundary(root,wall,boundaryGlass);
    for(const gate of this.layout.boundaries.gates){
      const room=this.layout.rooms.find(r=>r.key===gate.room),[x0,x1,z0,z1]=room.bounds,horizontal=['north','south'].includes(gate.side);
      const x=horizontal?gate.center:gate.side==='west'?x0:x1,z=horizontal?(gate.side==='north'?z0:z1):gate.center;
      // Flush thresholds mark entrances without creating a navigation obstacle.
      box(root,0xe2d7bd,x,.08,z,horizontal?gate.width:.36,.03,horizontal?.36:gate.width);
    }
    const knownGeometry=new Set([cube,sphere,cylinder]),knownMaterial=new Set(materialCache.values());
    // Track owned resources before batching; shared office primitives stay alive.
    this.ownedGeometries=new Set();this.ownedMaterials=new Set();
    root.traverse(o=>{if(!o.isMesh||o.userData.landscape)return;if(!knownGeometry.has(o.geometry)&&['ShapeGeometry','ExtrudeGeometry','TorusGeometry','PlaneGeometry','TubeGeometry'].includes(o.geometry.type))this.ownedGeometries.add(o.geometry);if(!knownMaterial.has(o.material)&&o.geometry.type==='ShapeGeometry')this.ownedMaterials.add(o.material);});
    this.ownedGeometries.add(terrain.geometry);this.ownedMaterials.add(terrain.material);
    this.ownedMaterials.add(boundaryGlass);this.ownedMaterials.add(entryGlass);this.ownedMaterials.add(this.lampGlowMaterial);batchStatic(root);this.lightingMinute=-1;
  }
  addActor({id,seat,project,index,session=null},startPoint=null){
    const accessories=['beanie','headphones','glasses','cap','scarf','freckles','bowtie','none'];
    const model=createCharacter(this.world,session?.identity?.palette||seat.room,session?.identity||{index,accessory:accessories[index%8]});
    // Navigation snaps to the nearest walkable grid cell, which can leave a
    // character beside the chair. Seat coordinates are deliberately kept clear
    // of tables, so use the authored seat as the resting anchor.
    const point=restingPoint(seat),spawn=startPoint||point;
    model.root.position.set(spawn.x,0,spawn.z);model.root.rotation.y=startPoint?Math.atan2(point.x-spawn.x,point.z-spawn.z):seat.heading;model.root.userData.sessionId=id;model.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
    const marker=new THREE.Mesh(new THREE.RingGeometry(.39,.48,24),new THREE.MeshBasicMaterial({color:project.color,side:THREE.DoubleSide,transparent:true,opacity:.9}));marker.rotation.x=-Math.PI/2;marker.position.set(spawn.x,.038,spawn.z);this.world.add(marker);
    const name=session?.identity?.name||['Alex','Riley','Noah','Ethan','Luca','Kai','Mia','Leo','Owen','Ivy','Aria','Finn'][index%12];
    const label=document.createElement('button');
    label.className='study-agent-label';
    label.style.setProperty('--project',project.color);
    const rankLine=document.createElement('small'),projectLine=document.createElement('small'),actionLine=document.createElement('span');
    rankLine.className='study-agent-rank';
    projectLine.className='study-agent-project';
    actionLine.className='study-agent-action';
    const metadata=document.createElement('span');
    metadata.className='study-agent-metadata';
    metadata.append(projectLine,rankLine);
    label.append(actionLine,metadata);
    label.addEventListener('click',()=>this.onActor?.(id));
    this.labelLayer.append(label);
    const walker=new OfficeWalker(this.navigator,spawn);if(startPoint)walker.setDestination(point,seat.room);
    const actor={id,model,label,marker,seat,project,index,session,walker,name};
    this.actorLabels.add(label,{
      model:()=>actor.model,name:()=>actor.name,selected:()=>actor.id===this.selectedId,
      working:()=>!actor.departing&&(!actor.session||actor.session.active||actor.session.error||(actor.commandUntil||0)>performance.now()),
      showMetadata:()=>!actor.departing&&Boolean(actor.session?.active),
      summary:()=>actor.departing?'↗ 퇴근':actor.session?.aborted?'◷ 중단':actor.session?.finished?'✓ 완료':actor.session&&!actor.session.active?'◷ 응답 대기':({nap:'☾ 낮잠',game:'◇ 게임',read:'▤ 독서',relax:'☕ 휴식',stretch:'↟ 스트레칭'}[actor.session?.identity?.idle]||'… 대기'),
    });
    for(const [key,prop]of Object.entries(model.props))prop.visible=key===seat.mode;
    this.actors.push(actor);
    this.updateActorLabel(actor);
  }
  departActor(actor){
    actor.departing=true;actor.session=null;actor.label.dataset.state='departing';actor.label.querySelector('.study-agent-action').textContent='출입구로 이동 중';
    actor.walker.setDestination(this.layout.entrance.arrival,null);
  }
  updateActorLabel(actor){
    const room=SHARED_ROOMS.find(r=>r.key===actor.seat.room).name,receiving=(actor.commandUntil||0)>performance.now();
    const session=actor.session;
    let activity=`${room}에서 함께 일하는 중`;
    if(receiving)activity='☎ CEO의 지시를 확인하는 중';
    else if(session?.active){
      const action=session.meetingIntent?session.label:session.codexNote||session.label;
      activity=action||`${room}에서 작업 중`;
    }else if(session)activity=session.aborted?'작업 중단 · 휴식 중':session.finished?'작업 완료 · 휴식 중':'응답 대기 중';
    const rank=actor.session?.hasParent?'서브에이전트':'메인 세션';
    const project=actor.project.name||actor.project.code;
    actor.label.querySelector('.study-agent-rank').textContent=rank;
    actor.label.querySelector('.study-agent-project').textContent=project;
    actor.label.querySelector('.study-agent-action').textContent=activity;
    const metadata=actor.session?.active?` · ${rank} · ${project} 프로젝트`:'';
    actor.label.setAttribute('aria-label',`${actor.name} · ${activity}${metadata}`);
    actor.label.dataset.error=String(Boolean(actor.session?.error));
  }
  setProject(key){
    this.project=key;for(const actor of this.actors){const visible=!key||actor.project.key===key;actor.model.root.visible=visible;actor.marker.visible=visible;actor.label.hidden=!visible;}
    if(this.selectedId&&!this.actors.find(a=>a.id===this.selectedId)?.model.root.visible)this.selectedId=null;
    for(const actor of this.actors){actor.model.selection.visible=actor.id===this.selectedId;actor.label.classList.toggle('selected',actor.id===this.selectedId);}
    for(const [room, sign] of this.roomSigns){
      const actors=this.actors.filter(actor=>actor.seat.room===room);
      const count=key?`${actors.filter(actor=>actor.model.root.visible).length}/${actors.length}`:actors.length;
      const pods=this.layout.pods.filter(pod=>pod.room===room).length;
      sign.write(undefined,`${count}명 · ${pods} 포드`);
    }
    if(this.routeLine)this.routeLine.visible=this.walkActor?.model.root.visible;this.updateLabels();
  }
  selectActor(id){this.leaveCatView();this.selectedId=id;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');this.selectedRoom=null;for(const m of [...this.roomMeshes.values(),...this.executive.floors.values()])m.material.emissive.set(0);for(const a of this.actors){a.model.selection.visible=a.id===id;a.label.classList.toggle('selected',a.id===id);}const actor=this.actors.find(a=>a.id===id);if(actor)this.focusCharacter(actor.model);}
  selectOwner(){this.leaveCatView();this.selectedOwner=!this.selectedOwner;this.selectedId=null;this.selectedRoom=null;this.executive.owner.selection.visible=this.selectedOwner;this.executive.ownerLabel.classList.toggle('selected',this.selectedOwner);this.executive.ownerLabel.setAttribute('aria-pressed',String(this.selectedOwner));for(const a of this.actors){a.model.selection.visible=false;a.label.classList.remove('selected');}for(const m of [...this.roomMeshes.values(),...this.executive.floors.values()])m.material.emissive.set(0);if(this.selectedOwner)this.focusCharacter(this.executive.owner);}
  selectRoom(key){this.leaveCatView();this.selectedRoom=key;this.selectedId=null;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');for(const a of this.actors){a.model.selection.visible=false;a.label.classList.remove('selected');}for(const [k,m]of this.roomMeshes)m.material.emissive.set(k===key?'#213921':'#000000');for(const m of this.executive.floors.values())m.material.emissive.set(key==='executive'?'#172315':'#000000');const room=key==='executive'?this.layout.executive:this.layout.rooms.find(r=>r.key===key);if(room){const [x0,x1,z0,z1]=room.bounds;this.focus(new THREE.Vector3((x0+x1)/2,0,(z0+z1)/2),2.05);}}
  selectCat(model){
    this.selectActor(null);
    this.transition=null;
    this.catView=model;
    this.labelLayer.hidden=true;
    this.updateExecutivePrivacy();
    this.renderer.domElement.setAttribute('aria-label',`${model.appearance.name}의 눈높이로 보는 공용 오피스`);
    this.updateCatCamera();
    this.onCatView?.(model.appearance.name);
  }
  leaveCatView(){
    if(!this.catView)return;
    this.catView=null;
    this.labelLayer.hidden=false;
    this.renderer.domElement.setAttribute('aria-label',MAP_CAMERA_LABEL);
    this.updateLabels();
    this.onCatView?.(null);
  }
  updateCatCamera(){
    const {head}=this.catView;
    // Place the lens just ahead of the eyes so the face never fills the view.
    const eye=head.localToWorld(this.catCamera.position.set(0,.015,.31));
    this.catLookTarget.set(0,0,1).transformDirection(head.matrixWorld).add(eye);
    this.catCamera.lookAt(this.catLookTarget);
  }
  focusCharacter(model){
    beginCameraOrbit(this);
    const target=characterFocusPoint(model);
    if(this.motion)this.focus(target,2.8,model);
    else{
      this.viewTarget.copy(target);
      this.zoom=2.8;
      this.resize();
    }
  }
  focus(to,zoom,model){this.transition={from:this.viewTarget.clone(),to,zoomFrom:this.zoom,zoomTo:zoom,start:performance.now(),model};}
  setParkingView(enabled){
    if(!this.parking||enabled===Boolean(this.parkingView))return;
    this.leaveCatView();
    this.transition=null;
    if(enabled){
      this.officeCameraView={angle:this.angle,elevation:this.elevation,zoom:this.zoom,orbitFrame:this.orbitFrame,target:this.viewTarget.clone()};
    }else{
      const {angle,elevation,zoom,orbitFrame,target}=this.officeCameraView;
      Object.assign(this,{angle,elevation,zoom,orbitFrame});
      this.viewTarget.copy(target);
      this.officeCameraView=null;
    }
    this.parkingView=enabled;
    this.parking.group.visible=enabled;
    this.world.visible=this.outdoorSky.mesh.visible=this.sky.visible=this.sun.visible=!enabled;
    this.scene.background=enabled?PARKING_BACKGROUND:null;
    this.labelLayer.hidden=enabled;
    this.renderer.domElement.setAttribute('aria-label',enabled?'지하 1층 주차장 3D 공간. 드래그로 이동, Shift + 드래그로 회전, 스크롤로 확대합니다.':MAP_CAMERA_LABEL);
    this.renderer.shadowMap.needsUpdate=!enabled;
    if(enabled)this.resetView();
    else this.resize();
    this.onFloor?.(enabled);
  }
  resetView(){
    if(this.parkingView){
      this.orbitFrame=this.transition=null;
      this.angle=.56;this.elevation=47*Math.PI/180;this.zoom=1;
      this.frameOverview();this.resize();return;
    }
    this.leaveCatView();this.orbitFrame=null;this.transition=null;this.angle=.48;this.elevation=MAP_ELEVATION;this.zoom=1;this.selectedRoom=null;this.selectedId=null;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');this.frameOverview();for(const m of [...(this.roomMeshes?.values()||[]),...this.executive.floors.values()])m.material.emissive.set(0);for(const a of this.actors){a.model.selection.visible=false;a.label.classList.remove('selected');}this.resize();}
  setElevation(degrees){this.transition=null;this.elevation=THREE.MathUtils.clamp(Number(degrees),12,89)*Math.PI/180;this.resize();}
  setZoom(value){this.transition=null;this.zoom=THREE.MathUtils.clamp(value,MIN_MAP_ZOOM,12);this.resize();}
  frameOverview(){
    if(this.parkingView){this.viewTarget.copy(this.parking.target);return;}
    const bounds=this.layout?.bounds;
    this.viewTarget.set(bounds?(bounds.minX+bounds.maxX)/2:0,0,bounds?(bounds.minZ+bounds.maxZ)/2:0);
  }
  resize(){
    const width=this.element.clientWidth,height=this.element.clientHeight;
    if(!width||!height)return;
    if(width!==this.width||height!==this.height)this.renderer.setSize(width,height,false);
    this.width=width;this.height=height;
    const camera=this.camera,aspect=width/height;
    const elevation=Math.max(this.elevation,Math.PI/36);
    const back=new THREE.Vector3(Math.sin(this.angle)*Math.cos(elevation),Math.sin(elevation),Math.cos(this.angle)*Math.cos(elevation));
    const right=new THREE.Vector3(Math.cos(this.angle),0,-Math.sin(this.angle)),up=back.clone().cross(right);
    const bounds=this.layout?.navigationBounds||this.layout?.bounds||{minX:-20,maxX:20,minZ:-12,maxZ:12};
    const panMaxX=this.parkingView?this.parking.opening.maxX:bounds.maxX;
    this.viewTarget.x=THREE.MathUtils.clamp(this.viewTarget.x,bounds.minX,panMaxX);
    this.viewTarget.z=THREE.MathUtils.clamp(this.viewTarget.z,bounds.minZ,bounds.maxZ);
    const tanHalfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    let distance=this.orbitFrame?.distance;
    if(!distance){
      const center=this.parkingView?this.parking.target:new THREE.Vector3((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);
      let points=this.parkingView?this.parking.framePoints:[];
      if(!this.parkingView){
        for(const x of [bounds.minX-2,bounds.maxX+2])for(const z of [bounds.minZ-2,bounds.maxZ+2])for(const y of [GROUND_LEVEL,3.5]){
          points.push(new THREE.Vector3(x,y,z));
        }
      }
      const offset=new THREE.Vector3();
      distance=0;
      for(const point of points){
        offset.copy(point).sub(center);
        const extent=Math.max(Math.abs(offset.dot(right))/(aspect*.88),Math.abs(offset.dot(up))/.8);
        distance=Math.max(distance,offset.dot(back)+extent/tanHalfFov);
      }
    }
    distance/=this.zoom;
    if(!this.parkingView){
      const cityBoundary=bounds.minZ-CITY_CAMERA_LIMIT;
      if(back.z<0)distance=Math.min(distance,(this.viewTarget.z-cityBoundary)/-back.z);
    }
    camera.aspect=aspect;
    camera.near=Math.max(.16,distance*.024);
    camera.position.copy(this.viewTarget).addScaledVector(back,distance);
    camera.lookAt(this.viewTarget);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    if(this.catCamera){
      this.catCamera.aspect=aspect;
      this.catCamera.updateProjectionMatrix();
    }
    this.updateLabels();
    this.onView?.({zoom:this.zoom,elevation:Math.round(elevation*180/Math.PI),parking:Boolean(this.parkingView)});
  }
  pick(event){
    if(!this.layout||this.parkingView)return;
    const b=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2),this.camera);
    const roots=this.actors.filter(actor=>actor.model.root.visible).map(actor=>actor.model.root);
    if(this.executive.owner.root.visible)roots.push(this.executive.owner.root);
    if(this.visitor?.model.root.visible)roots.push(this.visitor.model.root);
    const secretary=this.executive.assisting?this.executive.companion:this.executive.secretary;
    if(secretary.root.visible)roots.push(secretary.root);
    if(this.executive.roof.visible)roots.push(this.executive.roof);
    const hits=ray.intersectObjects([
      ...roots,...this.cats.map(({model})=>model.root),
      ...this.roomMeshes.values(),...this.executive.floors.values(),
      ...Array.from(this.roomSigns.values(),sign=>sign.root),this.executive.suiteSign.root,
    ],true);
    for(const hit of hits){let o=hit.object;while(o){if(o.userData.catIndex!==undefined){this.selectCat(this.cats[o.userData.catIndex].model);return;}if(o.userData.owner){this.onOwner?.();return;}if(o.userData.ambientCharacter){this.selectAmbient(o.userData.ambientCharacter);return;}if(o.userData.sessionId){this.onActor?.(o.userData.sessionId);return;}if(o.userData.room){this.onRoom?.(o.userData.room);return;}o=o.parent;}}
  }
  selectAmbient(kind){const model=kind==='visitor'?this.visitor?.model:(this.executive.assisting?this.executive.companion:this.executive.secretary);if(!model?.root.visible)return;this.leaveCatView();this.selectedAmbient=this.selectedAmbient===kind?null:kind;this.visitor.model.selection.visible=this.selectedAmbient==='visitor';this.executive.secretary.selection.visible=this.selectedAmbient==='secretary';this.executive.companion.selection.visible=this.selectedAmbient==='secretary';this.visitor.label.classList.toggle('selected',this.selectedAmbient==='visitor');this.executive.secretaryLabel.classList.toggle('selected',this.selectedAmbient==='secretary');if(this.selectedAmbient)this.focusCharacter(model);}
  projectPoint(node,point){const p=point.clone().project(this.camera);node.hidden=p.z< -1||p.z>1||p.x<-.97||p.x>.97||p.y<-.95||p.y>.95;node.style.left=`${(p.x+1)*this.width/2}px`;node.style.top=`${(1-p.y)*this.height/2}px`;return {x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2};}
  isExecutivePoint({x,z}){
    if(!this.layout)return false;
    const [minX,maxX,minZ,maxZ]=this.layout.executive.bounds;
    return x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ;
  }
  updateExecutivePrivacy(){
    const followingPerson=!this.selectedRoom&&(this.selectedOwner||this.selectedAmbient);
    const insideView=this.selectedRoom==='executive'||(followingPerson&&this.isExecutivePoint(this.viewTarget));
    const covered=Boolean(this.catView)||!insideView;
    if(this.executive.roof.visible===covered)return;
    this.executive.roof.visible=covered;
    this.renderer.shadowMap.needsUpdate=true;
  }
  updateLabels(){
    this.updateExecutivePrivacy();
    if(!this.width||!this.layout||this.catView||this.parkingView)return;
    for(const {model,label,actionLabel,anchor} of this.cats){
      if(this.showLabels){
        anchor.copy(model.root.position);
        this.projectPoint(label,anchor);
        anchor.y+=model.root.scale.y*1.18;
        if(actionLabel.textContent)this.projectPoint(actionLabel,anchor);
        else actionLabel.hidden=true;
      }else label.hidden=actionLabel.hidden=true;
    }
    this.actorLabels?.update(this.camera,this.width,this.height,this.showLabels);
  }
  startWalk(){
    if(this.walkActor)return false;
    const actor=this.actors.find(a=>a.id===this.selectedId)||this.actors.find(a=>a.model.root.visible&&a.seat.room==='studio')||this.actors.find(a=>a.model.root.visible);if(!actor)return false;
    const target=this.navigator.point(this.navigator.nearest(this.layout.circulation.gardenVisit));actor.walker.setDestination(target,null);if(actor.walker.blocked)return false;
    this.walkActor=actor;this.walkReturning=false;this.drawRoute(actor);return true;
  }
  drawRoute(actor){this.clearRoute();const points=[actor.walker.position,...actor.walker.route].map(p=>new THREE.Vector3(p.x,.06,p.z));const geometry=new THREE.BufferGeometry().setFromPoints(points);this.routeLine=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:actor.project.color,dashSize:.18,gapSize:.12,depthTest:false}));this.routeLine.computeLineDistances();this.routeLine.renderOrder=10;this.routeLine.visible=actor.model.root.visible;this.world.add(this.routeLine);}
  clearRoute(){if(this.routeLine){this.routeLine.removeFromParent();this.routeLine.geometry.dispose();this.routeLine.material.dispose();this.routeLine=null;}}
  stopWalk(){this.walkActor=null;this.walkReturning=false;this.clearRoute();this.onWalkEnd?.();}
  updateActor(actor,dt,time){
    const hurrying=actor.session?.active&&!actor.departing&&this.walkActor!==actor&&(actor.commandUntil||0)<=time;
    actor.walker.tick(dt,hurrying?4.4:1.9);const {model,walker,seat}=actor,walking=walker.walking,running=walking&&hurrying;
    if(actor.departing&&!walking){this.removeActor(actor);actor.departed=true;if(this.selectedId===actor.id)this.selectedId=null;return;}
    const point=walking?walker.position:restingPoint(seat);
    model.root.position.set(point.x,!walking&&seat.room==='desk'?SOFA_LIFT:0,point.z);actor.marker.position.set(point.x,.038,point.z);
    const heading=walking?walker.heading:seat.heading,difference=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));model.root.rotation.y+=difference*Math.min(1,dt*10);
    const cycle=walker.distanceWalked*(running?8:12),beat=time*.009+actor.index;
    model.body.position.y=this.motion?(walking?Math.abs(Math.sin(cycle))*(running?.09:.04):Math.sin(time*.002+actor.index)*.008):0;
    model.body.rotation.x=this.motion&&running?.16:0;
    const seated=!walking&&seat.room!=='library';if(seated)model.body.position.y+=.29;
    model.legL.rotation.x=walking?(this.motion?Math.sin(cycle)*(running?.85:.5):0):seated?-1.05:0;model.legR.rotation.x=walking?-model.legL.rotation.x:model.legL.rotation.x;
    model.armL.rotation.x=walking?(this.motion?-Math.sin(cycle)*(running?.75:.4):0):seat.room==='studio'||seat.room==='server'?-1.1+(this.motion?Math.sin(beat)*.08:0):-.55;
    model.armR.rotation.x=walking?-model.armL.rotation.x:seat.room==='studio'||seat.room==='server'?-1.15+(this.motion?Math.cos(beat)*.09:0):-.7;
    model.eyes.scale.y=this.motion&&(time+actor.index*230)%5400>5250?.1:1;
    const resting=actor.session&&!actor.session.active,idle=actor.session?.identity?.idle;
    const receiving=(actor.commandUntil||0)>time;
    const pose=receiving?'phone':resting?({game:'game',read:'book',relax:'cup'}[idle]||'none'):actor.session?.room==='research'?'magnifier':actor.session?.active&&seat.room==='desk'?'clipboard':seat.mode;
    for(const [key,prop]of Object.entries(model.props))prop.visible=key===pose&&(!walking||key==='phone');
    if(receiving&&!walking){model.armL.rotation.x=-1.1;model.armR.rotation.x=-1.1;}
    model.head.rotation.x=resting&&idle==='nap'?.18:0;
    if(resting&&idle==='nap')model.eyes.scale.y=.08;
    model.armL.rotation.z=resting&&idle==='stretch'?-2.6:0;model.armR.rotation.z=resting&&idle==='stretch'?2.6:0;
    actor.label.dataset.state=actor.departing?'departing':receiving?'receiving':walking?'walking':resting?'resting':'working';
    if(actor.wasReceiving!==receiving){actor.wasReceiving=receiving;this.updateActorLabel(actor);}
    if(this.walkActor===actor&&!walking){
      if(!this.walkReturning){const home=restingPoint(seat);walker.setDestination(home,seat.room);this.walkReturning=true;this.drawRoute(actor);}
      else this.stopWalk();
    }
  }
  frame(time){
    this.frameHandle=requestAnimationFrame(this.frame);const dt=Math.min((time-this.lastTime)/1000,.05);this.lastTime=time;if(document.hidden)return;this.updateLighting(new Date());
    for(const actor of this.actors)this.updateActor(actor,dt,time);this.actors=this.actors.filter(actor=>!actor.departed);this.updateEntrance(dt);
    this.executive.update(dt,time,this.motion,this.actors);
    for(const {model,label,actionLabel} of this.cats){
      const neighbor=this.cats.find(other=>other.model!==model&&
        other.model.root.position.distanceToSquared(model.root.position)<1.2**2);
      model.update(dt,this.motion,neighbor?.model.root.position);
      if(actionLabel.dataset.action!==model.action){
        actionLabel.dataset.action=model.action;
        const action=CAT_ACTION_LABELS[model.action];
        actionLabel.textContent=action||'';
        const name=model.appearance.name;
        label.setAttribute('aria-label',`${action?`${name} · ${action}`:name} · 고양이 시점으로 보기`);
      }
    }
    if(this.ownerStatusText!==this.executive.patrol.text){this.ownerStatusText=this.executive.patrol.text;this.onOwnerStatus?.();}
    this.visitor.update(this.navigator,dt,time,this.motion,true,this.executive.spouseTargets());
    if(this.live){const actor=this.showPaths!==false&&(this.actors.find(a=>a.id===this.selectedId&&a.walker.walking)||this.actors.find(a=>a.model.root.visible&&a.walker.walking)),signature=actor?`${actor.id}:${actor.walker.route.length}:${actor.walker.destination.x}:${actor.walker.destination.z}`:'';if(signature!==this.routeSignature){this.routeSignature=signature;if(actor)this.drawRoute(actor);else this.clearRoute();}}
    if(this.catView)this.updateCatCamera();
    else if(this.transition){
      const {from,to,zoomFrom,zoomTo,start,model}=this.transition;
      const t=THREE.MathUtils.clamp((time-start)/650,0,1),smooth=t*t*(3-2*t);
      if(model)characterFocusPoint(model,to);
      this.viewTarget.lerpVectors(from,to,smooth);
      this.zoom=THREE.MathUtils.lerp(zoomFrom,zoomTo,smooth);
      if(t===1)this.transition=null;
      this.resize();
    }else this.updateLabels();
    const camera=this.catView?this.catCamera:this.camera;
    if(!this.parkingView)this.outdoorSky.orient(camera);
    this.renderer.render(this.scene,camera);
  }
  disposeLayout(){
    for(const sign of this.roomSigns.values())sign.dispose();
    for(const sign of this.landmarkSigns)sign.dispose();
    this.parking?.dispose();
    this.groundDesign?.dispose();
    this.layoutGroup?.removeFromParent();
    for(const geometry of this.ownedGeometries||[])geometry.dispose();
    for(const material of this.ownedMaterials||[])material.dispose();
    this.officeElevator?.dispose();this.officeElevator=null;
    for(const light of this.lights)light.mesh.material.dispose();
  }
  destroy(){cancelAnimationFrame(this.frameHandle);this.resizeObserver.disconnect();this.actorLabels.destroy();this.visitor.destroy(disposeCharacter);for(const actor of this.actors)disposeCharacter(actor.model);this.executive.destroy();this.clearCats();this.disposeLayout();this.outdoorSky.dispose();this.renderer.dispose();this.element.replaceChildren();}
}

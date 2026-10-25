import * as THREE from './vendor/three/three.module.js';
import {OfficeScene,createCharacter,disposeCharacter,furniture} from './office-scene.js';
import {OfficeNavigator,OfficeWalker} from './office-navigation.js';
import {SHARED_ROOMS,ROOM_CORNER_RADIUS,ZONE_BOUNDARY_STYLES,createSharedLayout,createPreviewAssignments} from './shared-office-layout.js';
import {SharedExecutiveWing} from './shared-office-executive.js';
import {daylightAt,sunriseSunset} from './solar-time.js';
import {buildSharedGround} from './shared-office-ground.js';
import {SharedOfficeLabels} from './shared-office-labels.js';
import {OfficeVisitor} from './office-visitor.js';

const materialCache=new Map();
const DAY_BACKGROUND=new THREE.Color('#eef2ed'),NIGHT_BACKGROUND=new THREE.Color('#68747d');
const SEAT_BACKSET=.25,SOFA_BACKSET=.82,SOFA_LIFT=.32;
function mat(color){if(!materialCache.has(color))materialCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return materialCache.get(color);}
const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,16,12),cylinder=new THREE.CylinderGeometry(1,1,1,48);
function mesh(parent,geometry,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d)=>mesh(p,cube,c,x,y,z,w,h,d);
function restingPoint(seat){const backset=seat.room==='desk'?SOFA_BACKSET:seat.room==='studio'?-.08:SEAT_BACKSET;return{x:seat.x-Math.sin(seat.heading)*backset,z:seat.z-Math.cos(seat.heading)*backset};}
function roundedShape(x0,x1,z0,z1,r=1.5){
  const s=new THREE.Shape();s.moveTo(x0+r,z0);s.lineTo(x1-r,z0);s.quadraticCurveTo(x1,z0,x1,z0+r);s.lineTo(x1,z1-r);s.quadraticCurveTo(x1,z1,x1-r,z1);s.lineTo(x0+r,z1);s.quadraticCurveTo(x0,z1,x0,z1-r);s.lineTo(x0,z0+r);s.quadraticCurveTo(x0,z0,x0+r,z0);return s;
}
function tile(parent,shape,color,y){const geometry=new THREE.ShapeGeometry(shape,48);geometry.rotateX(Math.PI/2);const m=mesh(parent,geometry,color,0,y,0);m.material=new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.95});m.castShadow=false;return m;}
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
  root.traverse(node=>{if(!node.isMesh||node.userData.room)return;const key=node.geometry.uuid+node.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);});
  for(const meshes of groups.values()){
    if(meshes.length<3)continue;
    const instanced=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);instanced.castShadow=meshes.some(m=>m.castShadow);instanced.receiveShadow=true;
    meshes.forEach((m,i)=>{instanced.setMatrixAt(i,inverse.clone().multiply(m.matrixWorld));m.removeFromParent();});root.add(instanced);
  }
}

export class SharedOfficeScene {
  constructor(element,{onRoom,onActor,onOwner,onView,onWalkEnd,preferences={}}={}){
    this.element=element;this.onRoom=onRoom;this.onActor=onActor;this.onOwner=onOwner;this.onView=onView;this.onWalkEnd=onWalkEnd;
    this.scene=new THREE.Scene();this.scene.background=DAY_BACKGROUND.clone();this.lightingMinute=-1;this.location=null;this.solarEvents=null;this.ambientFixtures=[];
    this.world=new THREE.Group();this.scene.add(this.world);this.camera=new THREE.OrthographicCamera(-24,24,16,-16,.1,180);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const canvas=this.renderer.domElement;canvas.setAttribute('aria-label','공용 오피스 3D 공간 시안. 드래그로 회전, 스크롤로 확대하고 직원이나 업무 구역을 선택하세요.');canvas.setAttribute('role','img');element.append(canvas);
    this.sky=new THREE.HemisphereLight(0xfff9ed,0xb0bc9f,1.9);this.scene.add(this.sky);
    this.sun=new THREE.DirectionalLight(0xfff4dc,2.1);this.sun.position.set(-16,32,8);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:80});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.03;this.sun.shadow.radius=4;this.scene.add(this.sun);
    this.angle=.48;this.elevation=.72;this.zoom=1;this.viewTarget=new THREE.Vector3(0,0,0);this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.showLabels=true;this.project=null;this.selectedId=null;this.selectedOwner=false;this.selectedRoom=null;this.actors=[];this.lights=[];
    this.labelLayer=document.createElement('div');this.labelLayer.className='study-labels';element.append(this.labelLayer);this.roomLabels=new Map();
    for(const room of SHARED_ROOMS){
      const label=document.createElement('button');label.className='study-room-label';label.style.setProperty('--room-color',room.color);const name=document.createElement('strong');name.textContent=room.name;const count=document.createElement('span');label.append(name,count);label.addEventListener('click',()=>this.onRoom?.(room.key));this.labelLayer.append(label);this.roomLabels.set(room.key,{node:label,point:new THREE.Vector3(...room.label)});
    }
    const gardenLabel=document.createElement('div');gardenLabel.className='study-garden-label';gardenLabel.textContent='COURTYARD · 정원';this.labelLayer.append(gardenLabel);this.gardenLabel=gardenLabel;
    const entryLabel=document.createElement('div');entryLabel.className='study-entry-label';entryLabel.textContent='출퇴근 출입구';this.labelLayer.append(entryLabel);this.entryLabel=entryLabel;
    this.executive=new SharedExecutiveWing(this.world,this.labelLayer,{batch:batchStatic,onSelect:()=>this.onRoom?.('executive'),onOwnerSelect:()=>this.onOwner?.(),preferences});
    this.actorLabels=new SharedOfficeLabels(this.labelLayer);
    this.actorLabels.add(this.executive.ownerLabel,{model:()=>this.executive.owner,working:()=>this.executive.patrol.active||this.executive.patrol.commandUntil>performance.now(),selected:()=>this.selectedOwner,summary:()=> '… 대기'});
    this.actorLabels.add(this.executive.secretaryLabel,{model:()=>this.executive.assisting?this.executive.companion:this.executive.secretary,working:()=>true});
    this.visitor=new OfficeVisitor(this.world,this.labelLayer,createCharacter,{shared:true});
    this.actorLabels.add(this.visitor.label,{model:()=>this.visitor.model,working:()=>false,summary:()=>this.visitor.routine?.summary||'남편 기다림'});
    // Use the existing office camera gestures and keyboard controls.
    canvas.addEventListener('pointerdown',()=>{this.transition=null;});
    OfficeScene.prototype.bindControls.call(this);
    this.setLocation(preferences.latitude,preferences.longitude);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);this.resize();this.lastTime=performance.now();this.frame=this.frame.bind(this);this.frameHandle=requestAnimationFrame(this.frame);
  }
  removeActor(actor){this.actorLabels.remove(actor.label);actor.model.root.removeFromParent();disposeCharacter(actor.model);actor.label.remove();actor.marker.geometry.dispose();actor.marker.material.dispose();actor.marker.removeFromParent();}
  rebuildLayout(layout){
    if(this.layoutGroup){
      this.groundDesign?.dispose();this.layoutGroup.removeFromParent();for(const geometry of this.ownedGeometries||[])geometry.dispose();for(const material of this.ownedMaterials||[])material.dispose();
      for(const light of this.lights)light.mesh.material.dispose();
    }
    this.lights=[];this.ambientFixtures=[];this.layout=layout;this.navigator=new OfficeNavigator(this.layout);
    this.layoutGroup=new THREE.Group();this.world.add(this.layoutGroup);this.buildSpace();
    this.executive.place(layout.executive,this.navigator);
    this.visitor.update(this.navigator,0,performance.now(),this.motion,true,this.executive.spouseTargets());
    for(const actor of this.actors){actor.walker.navigator=this.navigator;actor.walker.route=[];actor.walker.pending=null;actor.walker.destination={x:Infinity,z:Infinity};}
    this.renderer.shadowMap.needsUpdate=true;this.resize();
  }
  setLocation(latitude,longitude){
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){this.location=null;this.solarEvents=null;this.lightingMinute=-1;return;}
    this.location={latitude,longitude};this.solarEvents=sunriseSunset(new Date(),latitude,longitude);this.lightingMinute=-1;
  }
  updateLighting(date){
    const minute=date.getHours()*60+date.getMinutes();if(minute===this.lightingMinute)return;
    this.lightingMinute=minute;if(this.location)this.solarEvents=sunriseSunset(date,this.location.latitude,this.location.longitude);
    const daylight=daylightAt(date,this.solarEvents||{sunrise:390,sunset:1140}),darkness=1-daylight;
    this.sky.intensity=.9+daylight;this.sun.intensity=.45+1.65*daylight;
    this.scene.background.copy(NIGHT_BACKGROUND).lerp(DAY_BACKGROUND,daylight);
    for(const fixture of this.ambientFixtures)fixture.light.intensity=fixture.maxIntensity*darkness;
    if(this.lampGlowMaterial)this.lampGlowMaterial.emissiveIntensity=.04+darkness*.72;
    this.groundDesign?.updateLighting(darkness);
  }
  setScenario(scenario){
    this.live=false;this.geometrySignature='';this.stopWalk();for(const actor of this.actors)this.removeActor(actor);this.actors=[];this.selectedId=null;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');
    this.rebuildLayout(createSharedLayout(scenario));
    for(const assignment of createPreviewAssignments(this.layout,scenario))this.addActor(assignment);
    for(const room of SHARED_ROOMS){const count=this.actors.filter(a=>a.seat.room===room.key).length;this.roomLabels.get(room.key).node.querySelector('span').textContent=`${count}명 · ${this.layout.pods.filter(p=>p.room===room.key).length} 포드`;}
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
          startPoint=this.navigator.point(this.navigator.nearest({x:this.layout.bounds.maxX+1.8,z:0}));
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
  buildSpace(){
    const root=this.layoutGroup;
    const {minX,maxX,minZ,maxZ}=this.layout.bounds,width=maxX-minX,depth=maxZ-minZ,centerZ=(minZ+maxZ)/2;
    box(root,0xc3cab9,0,-.37,centerZ,width+.4,.6,depth+.4);const base=tile(root,roundedShape(minX,maxX,minZ,maxZ,.8),'#edf0e5',-.055);base.userData.base=true;
    this.groundDesign=buildSharedGround(root,this.layout);
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
    // A cutaway perimeter gives the office depth without hiding the front rooms.
    box(root,0xe9e5d8,0,1.35,minZ+.1,width,.15+2.5,.18);box(root,0xd0c5ae,0,.14,minZ+.23,width,.18,.09);
    for(let x=minX+2;x<=maxX-2;x+=4){box(root,0xcfdfd7,x,1.65,minZ+.23,3.4,1.55,.04);for(const dx of [-1.75,0,1.75])box(root,0xfffbec,x+dx,1.65,minZ+.28,.065,1.65,.07);box(root,0xfffbec,x,2.45,minZ+.28,3.55,.07,.07);}
    box(root,0xe8e6db,minX+.1,.45,centerZ,.16,.9,depth-.2);
    const entryZ=0,entryHalf=1.55,entryX=maxX-.1;
    box(root,0xe8e6db,entryX,.45,(minZ+entryZ-entryHalf)/2,.16,.9,entryZ-entryHalf-minZ);
    box(root,0xe8e6db,entryX,.45,(maxZ+entryZ+entryHalf)/2,.16,.9,maxZ-entryZ-entryHalf);
    box(root,0xe8e6db,0,.16,maxZ-.1,width,.32,.16);
    // A glazed automatic entrance opens onto a small exterior landing.
    box(root,0xd9d4c4,maxX+1.2,-.015,entryZ,2.4,.12,3.3).castShadow=false;
    box(root,0xb9c9b3,maxX+1.8,.045,entryZ,1.2,.025,2.45).castShadow=false;
    for(const z of [-entryHalf,entryHalf])box(root,0x788d79,entryX,.1+1.3,z,.16,2.6,.16);
    box(root,0x788d79,entryX,2.7,entryZ,.16,.16,entryHalf*2+.12);
    const entryGlass=new THREE.MeshStandardMaterial({color:0x91b7bd,transparent:true,opacity:.42,roughness:.22,metalness:.08,side:THREE.DoubleSide});
    for(const z of [-1.08,1.08]){
      box(root,0xaab9ae,maxX-.28,1.08,z,.045,2.05,.055);
      const pane=new THREE.Mesh(cube,entryGlass);pane.position.set(maxX-.28,1.72,z);pane.scale.set(.035,1.22,.88);pane.castShadow=false;root.add(pane);
      box(root,0xe8ddc8,maxX-.24,.26,z,.05,.055,.88);
    }
    box(root,0xd1bd91,maxX-.17,.055,entryZ,.42,.035,2.9);
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
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.y=-.69;ground.receiveShadow=true;root.add(ground);
    const knownGeometry=new Set([cube,sphere,cylinder]),knownMaterial=new Set(materialCache.values());
    // Track owned resources before batching; shared office primitives stay alive.
    this.ownedGeometries=new Set();this.ownedMaterials=new Set();
    root.traverse(o=>{if(!o.isMesh||o.userData.landscape)return;if(!knownGeometry.has(o.geometry)&&['ShapeGeometry','ExtrudeGeometry','TorusGeometry','PlaneGeometry','TubeGeometry'].includes(o.geometry.type))this.ownedGeometries.add(o.geometry);if(!knownMaterial.has(o.material)&&o.geometry.type==='ShapeGeometry')this.ownedMaterials.add(o.material);});
    this.ownedMaterials.add(boundaryGlass);this.ownedMaterials.add(entryGlass);this.ownedMaterials.add(this.lampGlowMaterial);this.ownedMaterials.add(ground.material);batchStatic(root);this.lightingMinute=-1;
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
    const label=document.createElement('button');label.className='study-agent-label';label.style.setProperty('--project',project.color);const nameLine=document.createElement('strong'),nameText=document.createElement('span'),rankLine=document.createElement('small'),projectLine=document.createElement('small'),actionLine=document.createElement('span');nameLine.append(nameText,rankLine);rankLine.className='study-agent-rank';projectLine.className='study-agent-project';actionLine.className='study-agent-action';label.append(nameLine,projectLine,actionLine);label.addEventListener('click',()=>this.onActor?.(id));this.labelLayer.append(label);
    const walker=new OfficeWalker(this.navigator,spawn);if(startPoint)walker.setDestination(point,seat.room);
    const actor={id,model,label,marker,seat,project,index,session,walker,name};
    this.actorLabels.add(label,{
      model:()=>actor.model,selected:()=>actor.id===this.selectedId,
      working:()=>!actor.departing&&(!actor.session||actor.session.active||actor.session.error||(actor.commandUntil||0)>performance.now()),
      summary:()=>actor.departing?'↗ 퇴근':actor.session?.finished?'✓ 완료':actor.session&&!actor.session.active?'◷ 응답 대기':({nap:'☾ 낮잠',game:'◇ 게임',read:'▤ 독서',relax:'☕ 휴식',stretch:'↟ 스트레칭'}[actor.session?.identity?.idle]||'… 대기'),
    });
    for(const [key,prop]of Object.entries(model.props))prop.visible=key===seat.mode;
    this.actors.push(actor);
    this.updateActorLabel(actor);
  }
  departActor(actor){
    actor.departing=true;actor.session=null;actor.label.dataset.state='departing';actor.label.querySelector('.study-agent-action').textContent='출입구로 이동 중';
    actor.walker.setDestination({x:this.layout.bounds.maxX+1.8,z:0},null);
  }
  updateActorLabel(actor){const room=SHARED_ROOMS.find(r=>r.key===actor.seat.room).name,receiving=(actor.commandUntil||0)>performance.now(),activity=receiving?'☎ CEO의 지시를 확인하는 중':actor.session?(actor.session.active?(actor.session.codexNote||actor.session.label||`${room}에서 작업 중`):actor.session.finished?'작업 완료 · 휴식 중':'응답 대기 중'): `${room}에서 함께 일하는 중`,rank=actor.session?.hasParent?'서브에이전트':'메인 세션',nameText=actor.label.querySelector('strong > span'),rankLine=actor.label.querySelector('.study-agent-rank'),projectLine=actor.label.querySelector('.study-agent-project'),actionLine=actor.label.querySelector('.study-agent-action');nameText.textContent=actor.name;rankLine.textContent=rank;projectLine.textContent=actor.project.name||actor.project.code;actionLine.textContent=activity;actor.label.title=`${actor.name} · ${rank} · ${actor.project.name} · ${activity}`;actor.label.setAttribute('aria-label',`${actor.name} · ${rank} · ${actor.project.name} 프로젝트 · ${activity} · ${room}`);actor.label.dataset.error=String(Boolean(actor.session?.error));}
  setProject(key){
    this.project=key;for(const actor of this.actors){const visible=!key||actor.project.key===key;actor.model.root.visible=visible;actor.marker.visible=visible;actor.label.hidden=!visible;}
    if(this.selectedId&&!this.actors.find(a=>a.id===this.selectedId)?.model.root.visible)this.selectedId=null;
    for(const actor of this.actors){actor.model.selection.visible=actor.id===this.selectedId;actor.label.classList.toggle('selected',actor.id===this.selectedId);}
    for(const room of SHARED_ROOMS){const total=this.actors.filter(a=>a.seat.room===room.key).length,visible=this.actors.filter(a=>a.seat.room===room.key&&a.model.root.visible).length,pods=this.layout.pods.filter(p=>p.room===room.key).length;this.roomLabels.get(room.key).node.querySelector('span').textContent=`${key?`${visible}/${total}`:total}명 · ${pods} 포드`;}
    if(this.routeLine)this.routeLine.visible=this.walkActor?.model.root.visible;this.updateLabels();
  }
  selectActor(id){this.selectedId=id;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');this.selectedRoom=null;for(const m of [...this.roomMeshes.values(),...this.executive.floors.values()])m.material.emissive.set(0);for(const a of this.actors){a.model.selection.visible=a.id===id;a.label.classList.toggle('selected',a.id===id);}const actor=this.actors.find(a=>a.id===id);if(actor)this.focus(actor.walker.position.x,actor.walker.position.z,2.8);}
  selectOwner(){this.selectedOwner=!this.selectedOwner;this.selectedId=null;this.selectedRoom=null;this.executive.owner.selection.visible=this.selectedOwner;this.executive.ownerLabel.classList.toggle('selected',this.selectedOwner);this.executive.ownerLabel.setAttribute('aria-pressed',String(this.selectedOwner));for(const a of this.actors){a.model.selection.visible=false;a.label.classList.remove('selected');}for(const m of [...this.roomMeshes.values(),...this.executive.floors.values()])m.material.emissive.set(0);if(this.selectedOwner)this.focus(this.executive.owner.root.position.x,this.executive.owner.root.position.z,2.8);}
  selectRoom(key){this.selectedRoom=key;this.selectedId=null;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');for(const a of this.actors){a.model.selection.visible=false;a.label.classList.remove('selected');}for(const [k,m]of this.roomMeshes)m.material.emissive.set(k===key?'#213921':'#000000');for(const m of this.executive.floors.values())m.material.emissive.set(key==='executive'?'#172315':'#000000');const room=key==='executive'?this.layout.executive:this.layout.rooms.find(r=>r.key===key);if(room){const [x0,x1,z0,z1]=room.bounds;this.focus((x0+x1)/2,(z0+z1)/2,2.05);}}
  focus(x,z,zoom){this.transition={from:this.viewTarget.clone(),to:new THREE.Vector3(x,0,z),zoomFrom:this.zoom,zoomTo:zoom,start:performance.now()};}
  resetView(){this.transition=null;this.angle=.48;this.elevation=.72;this.zoom=1;this.selectedRoom=null;this.selectedId=null;this.selectedOwner=false;this.executive.owner.selection.visible=false;this.executive.ownerLabel.classList.remove('selected');this.executive.ownerLabel.setAttribute('aria-pressed','false');this.viewTarget.set(0,0,0);for(const m of [...(this.roomMeshes?.values()||[]),...this.executive.floors.values()])m.material.emissive.set(0);for(const a of this.actors){a.model.selection.visible=false;a.label.classList.remove('selected');}this.resize();}
  setElevation(degrees){this.transition=null;this.elevation=THREE.MathUtils.clamp(Number(degrees),12,89)*Math.PI/180;this.resize();}
  setZoom(value){this.transition=null;this.zoom=THREE.MathUtils.clamp(value,.65,4.5);this.resize();}
  resize(){
    const width=this.element.clientWidth,height=this.element.clientHeight;if(!width||!height)return;this.width=width;this.height=height;this.renderer.setSize(width,height,false);
    const floorBounds=this.layout?.bounds||{minX:-20,maxX:20,minZ:-12,maxZ:12},diagonal=Math.hypot(floorBounds.maxX-floorBounds.minX,floorBounds.maxZ-floorBounds.minZ),radius=Math.max(65,diagonal*1.2);this.camera.far=radius+diagonal+20;this.camera.position.set(this.viewTarget.x+Math.sin(this.angle)*Math.cos(this.elevation)*radius,this.viewTarget.y+Math.sin(this.elevation)*radius,this.viewTarget.z+Math.cos(this.angle)*Math.cos(this.elevation)*radius);this.camera.lookAt(this.viewTarget);this.camera.updateMatrixWorld();
    // Overview extents are computed once around the floor origin; zoom then centers on the selected target.
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1),points=[];
    const bounds=this.layout?.navigationBounds||this.layout?.bounds||{minX:-20,maxX:20,minZ:-12,maxZ:12};
    for(const x of [bounds.minX-.7,bounds.maxX+.7])for(const z of [bounds.minZ-.7,bounds.maxZ+.7])for(const y of [-.7,3.4])points.push(new THREE.Vector3(x,y,z));
    const xs=points.map(p=>p.dot(right)),ys=points.map(p=>p.dot(up));const halfH=Math.max((Math.max(...ys)-Math.min(...ys))/2,(Math.max(...xs)-Math.min(...xs))/(width/height)/2)*1.07/this.zoom;
    const midY=this.zoom===1?(Math.max(...ys)+Math.min(...ys))/2:0,midX=this.zoom===1?(Math.max(...xs)+Math.min(...xs))/2:0;this.camera.left=midX-halfH*width/height;this.camera.right=midX+halfH*width/height;this.camera.top=midY+halfH;this.camera.bottom=midY-halfH;this.camera.updateProjectionMatrix();this.updateLabels();this.onView?.({zoom:this.zoom,elevation:Math.round(this.elevation*180/Math.PI)});
  }
  pick(event){
    const b=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2),this.camera);
    const roots=this.actors.filter(a=>a.model.root.visible).map(a=>a.model.root);if(this.executive.owner.root.visible)roots.push(this.executive.owner.root);const hits=ray.intersectObjects([...roots,...this.roomMeshes.values(),...this.executive.floors.values()],true);
    for(const hit of hits){let o=hit.object;while(o){if(o.userData.owner){this.onOwner?.();return;}if(o.userData.sessionId){this.onActor?.(o.userData.sessionId);return;}if(o.userData.room){this.onRoom?.(o.userData.room);return;}o=o.parent;}}
  }
  projectPoint(node,point){const p=point.clone().project(this.camera);node.hidden=p.x<-.97||p.x>.97||p.y<-.95||p.y>.95;node.style.left=`${(p.x+1)*this.width/2}px`;node.style.top=`${(1-p.y)*this.height/2}px`;return {x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2};}
  updateLabels(){
    if(!this.width||!this.layout)return;
    for(const {node,point}of this.roomLabels.values())this.projectPoint(node,point);
    this.projectPoint(this.entryLabel,new THREE.Vector3(this.layout.bounds.maxX+1.2,2.9,0));
    const garden=this.layout.park.label;this.projectPoint(this.gardenLabel,new THREE.Vector3(garden.x,.35,garden.z));
    if(this.executive.layout)this.executive.updateLabels((node,point)=>this.projectPoint(node,point),this.zoom);
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
    actor.walker.tick(dt,1.9);const {model,walker,seat}=actor,walking=walker.walking;
    if(actor.departing&&!walking){this.removeActor(actor);actor.departed=true;if(this.selectedId===actor.id)this.selectedId=null;return;}
    const point=walking?walker.position:restingPoint(seat);
    model.root.position.set(point.x,!walking&&seat.room==='desk'?SOFA_LIFT:0,point.z);actor.marker.position.set(point.x,.038,point.z);
    const heading=walking?walker.heading:seat.heading,difference=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));model.root.rotation.y+=difference*Math.min(1,dt*10);
    const cycle=walker.distanceWalked*12,beat=time*.009+actor.index;
    model.body.position.y=this.motion?(walking?Math.abs(Math.sin(cycle))*.04:Math.sin(time*.002+actor.index)*.008):0;
    const seated=!walking&&seat.room!=='library';if(seated)model.body.position.y+=.29;
    model.legL.rotation.x=walking?(this.motion?Math.sin(cycle)*.5:0):seated?-1.05:0;model.legR.rotation.x=walking?-model.legL.rotation.x:model.legL.rotation.x;
    model.armL.rotation.x=walking?(this.motion?-Math.sin(cycle)*.4:0):seat.room==='studio'||seat.room==='server'?-1.1+(this.motion?Math.sin(beat)*.08:0):-.55;
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
    if(this.transition){const t=Math.min(1,(time-this.transition.start)/650),smooth=t*t*(3-2*t);this.viewTarget.lerpVectors(this.transition.from,this.transition.to,smooth);this.zoom=THREE.MathUtils.lerp(this.transition.zoomFrom,this.transition.zoomTo,smooth);this.resize();if(t===1)this.transition=null;}
    for(const actor of this.actors)this.updateActor(actor,dt,time);this.actors=this.actors.filter(actor=>!actor.departed);
    this.executive.update(dt,time,this.motion,this.actors);
    this.visitor.update(this.navigator,dt,time,this.motion,true,this.executive.spouseTargets());
    if(this.live){const actor=this.showPaths!==false&&(this.actors.find(a=>a.id===this.selectedId&&a.walker.walking)||this.actors.find(a=>a.model.root.visible&&a.walker.walking)),signature=actor?`${actor.id}:${actor.walker.route.length}:${actor.walker.destination.x}:${actor.walker.destination.z}`:'';if(signature!==this.routeSignature){this.routeSignature=signature;if(actor)this.drawRoute(actor);else this.clearRoute();}}
    this.updateLabels();this.renderer.render(this.scene,this.camera);
  }
  destroy(){cancelAnimationFrame(this.frameHandle);this.resizeObserver.disconnect();this.actorLabels.destroy();this.visitor.destroy(disposeCharacter);for(const actor of this.actors)disposeCharacter(actor.model);this.executive.destroy();this.groundDesign?.dispose();this.renderer.dispose();this.element.replaceChildren();}
}

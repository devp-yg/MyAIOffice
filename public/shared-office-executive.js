import * as THREE from './vendor/three/three.module.js';
import {buildExecutiveSuite} from './office-executive-scene.js';
import {EXECUTIVE_ROOM_LAYOUT} from './office-executive.js';
import {createCharacter,disposeCharacter,secretaryLookForDate} from './office-scene.js';
import {OfficeNavigator,OfficeWalker} from './office-navigation.js';
import {SecretaryRoutine} from './office-secretary.js';
import {CeoRoutine,CEO_ACTION_TEXT} from './ceo-routine.js';

const EXECUTIVE_ROOM_NAMES={library:'서재 · 기록실',studio:'비서실',server:'금고 · 기밀문서실',research:'프라이빗 라운지',meeting:'이사회실',desk:'CEO 집무실',reception:'접견실'};

// The tower interior and secretary routine run in their original coordinates.
// A single parent transform places the entire suite in the shared office.
export class SharedExecutiveWing {
  constructor(world,labelLayer,{batch,onSelect,preferences={}}={}){
    this.world=world;this.labelLayer=labelLayer;this.root=new THREE.Group();world.add(this.root);this.floors=new Map();
    buildExecutiveSuite(this.root,this.floors);
    for(const floor of this.floors.values())floor.userData.room='executive';
    this.geometries=new Set();this.materials=new Set();this.textures=new Set();
    this.root.traverse(node=>{
      if(!node.geometry)return;
      // Box/sphere/cylinder primitives and the walnut/brass materials are cached
      // by the tower renderer; only this interior's allocated resources belong here.
      if(!['BoxGeometry','SphereGeometry','CylinderGeometry'].includes(node.geometry.type))this.geometries.add(node.geometry);
      if(node.material.map){this.materials.add(node.material);this.textures.add(node.material.map);}
      if(node.isLineSegments)this.materials.add(node.material);
    });
    for(const floor of this.floors.values())this.materials.add(floor.material);
    batch(this.root);
    this.navigator=new OfficeNavigator();this.navigator.setExecutive(true);
    this.owner=createCharacter(world,'server',{owner:true});
    this.ownerWalker=null;this.sharedNavigator=null;this.patrol=new CeoRoutine();
    this.secretaryLook=secretaryLookForDate();
    this.secretary=createCharacter(this.root,'studio',{index:2,accessory:'glasses',secretary:true,secretaryOutfit:this.secretaryLook.look});this.secretary.root.scale.setScalar(1.08);
    for(const model of [this.owner,this.secretary])model.root.traverse(node=>{if(node.isMesh)node.castShadow=false;});
    this.routine=new SecretaryRoutine(this.navigator);
    this.label=document.createElement('button');this.label.className='study-room-label study-executive-label';
    const title=document.createElement('strong'),subtitle=document.createElement('span');
    title.textContent=String(preferences.executiveSuiteName||'').trim()||'CEO 집무실';subtitle.textContent='비서실 · 접견실 · 서재';this.label.append(title,subtitle);
    this.label.setAttribute('aria-label','CEO 집무실 확대');this.label.addEventListener('click',onSelect);labelLayer.append(this.label);
    this.roomLabels=EXECUTIVE_ROOM_LAYOUT.map(room=>{const node=document.createElement('div');node.className='study-room-label study-executive-room-label';const name=document.createElement('strong');name.textContent=EXECUTIVE_ROOM_NAMES[room.key]||room.key;node.append(name);node.setAttribute('aria-label',name.textContent);labelLayer.append(node);return{node,point:room.label};});
    this.ownerName=String(preferences.ownerName||'').trim()||'회장님';this.secretaryName=String(preferences.secretaryName||'').trim()||'지니';
    this.ownerLabel=this.personLabel(this.ownerName,'CEO',this.patrol.text,'owner');
    this.secretaryLabel=this.personLabel(this.secretaryName,'비서',this.routine.text,'secretary');
  }
  personLabel(name,role,activity,kind){
    const label=document.createElement('div');label.className=`study-agent-label study-executive-person ${kind}`;
    const nameLine=document.createElement('strong'),nameText=document.createElement('span'),roleLine=document.createElement('small'),actionLine=document.createElement('span');
    nameText.textContent=name;roleLine.textContent=role;roleLine.className='study-agent-rank';nameLine.append(nameText,roleLine);actionLine.textContent=activity;actionLine.className='study-agent-action';label.append(nameLine,actionLine);label.setAttribute('aria-label',`${name} · ${role} · ${activity}`);this.labelLayer.append(label);return label;
  }
  place(layout,navigator){
    this.layout=layout;this.root.position.set(layout.x,0,layout.z);this.root.rotation.y=layout.rotation;this.root.updateMatrixWorld(true);
    const home=this.navigator.station('desk',0),worldHome=this.root.localToWorld(new THREE.Vector3(home.x,0,home.z));
    if(!this.ownerWalker){this.ownerWalker=new OfficeWalker(navigator,{x:worldHome.x,z:worldHome.z});this.owner.root.position.copy(worldHome);this.owner.root.rotation.y=layout.rotation-Math.PI/2;}
    else if(navigator!==this.sharedNavigator){this.ownerWalker.navigator=navigator;this.ownerWalker.route=[];this.ownerWalker.pending=null;this.ownerWalker.position={x:this.owner.root.position.x,z:this.owner.root.position.z};this.ownerWalker.walking=false;}
    this.sharedNavigator=navigator;
  }
  point(x,y,z){return this.root.localToWorld(new THREE.Vector3(x,y,z));}
  update(dt,time,motion,actors=[]){
    const today=secretaryLookForDate();
    if(today.day!==this.secretaryLook.day){this.secretary.root.removeFromParent();disposeCharacter(this.secretary);this.secretary=createCharacter(this.root,'studio',{index:2,accessory:'glasses',secretary:true,secretaryOutfit:today.look});this.secretary.root.scale.setScalar(1.08);this.secretary.root.traverse(node=>{if(node.isMesh)node.castShadow=false;});this.secretaryLook=today;}
    const routine=this.routine,model=this.secretary;
    this.root.updateMatrixWorld(true);const ownerLocal=this.root.worldToLocal(this.owner.root.position.clone());
    const home=this.navigator.station('desk',0),ceoReady=!this.ownerWalker?.walking&&Math.hypot(ownerLocal.x-home.x,ownerLocal.z-home.z)<.9;
    routine.tick(dt,{ceoPresent:ceoReady,ceoReady,ceoPhase:ceoReady?'idle':'away',ceoRoom:ceoReady?'desk':null});
    const walking=routine.walker.walking&&!routine.greeting,carrying=routine.prop.endsWith('Tray'),cycle=routine.walker.distanceWalked*11;
    model.root.position.set(routine.walker.position.x,0,routine.walker.position.z);
    const face=routine.greeting?ownerLocal:routine.facing,heading=walking?routine.walker.heading:Math.atan2(face.x-model.root.position.x,face.z-model.root.position.z);
    const delta=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));model.root.rotation.y+=delta*Math.min(1,dt*8);
    model.body.position.y=motion?(walking?Math.abs(Math.sin(cycle))*.025:Math.sin(time*.002)*.008):0;
    model.legL.rotation.x=motion&&walking?Math.sin(cycle)*.4:0;model.legR.rotation.x=-model.legL.rotation.x;
    model.armL.rotation.x=carrying?-1.1:walking&&motion?-Math.sin(cycle)*.3:-.15;model.armR.rotation.x=carrying?-1.1:routine.prop==='clipboard'?-.35:walking&&motion?Math.sin(cycle)*.3:-.15;
    model.head.rotation.x=routine.step?.action==='tidy'?.12:0;
    if(motion&&routine.step?.action==='tidy')model.armR.rotation.x=-1.15+Math.sin(time*.005)*.12;
    for(const [key,prop]of Object.entries(model.props))prop.visible=key===routine.prop;
    model.eyes.scale.y=motion&&time%5400>5250?.1:1;
    this.updateOwner(dt,time,motion,actors);
    const action=this.secretaryLabel.querySelector('.study-agent-action');if(action.textContent!==routine.text)action.textContent=routine.text;
    this.secretaryLabel.setAttribute('aria-label',`${this.secretaryName} · 비서 · ${routine.text}`);
    const ownerAction=this.ownerLabel.querySelector('.study-agent-action');if(ownerAction.textContent!==this.patrol.text)ownerAction.textContent=this.patrol.text;
    this.ownerLabel.setAttribute('aria-label',`${this.ownerName} · CEO · ${this.patrol.text}`);
  }
  updateOwner(dt,time,motion,actors){
    const walker=this.ownerWalker,patrol=this.patrol,model=this.owner;if(!walker)return;
    const commanding=patrol.observeRequests(actors,time);
    if(commanding)patrol.text=CEO_ACTION_TEXT.command;
    else if(patrol.text===CEO_ACTION_TEXT.command)patrol.text=patrol.active?CEO_ACTION_TEXT[patrol.kind]:CEO_ACTION_TEXT.idle;
    if(patrol.active){if(!walker.walking&&time>=patrol.dwellUntil)patrol.finish(time);}
    else if(!commanding&&patrol.due(time)&&!walker.walking){
      const available=actors.filter(actor=>actor.model.root.visible&&actor.walker);
      const active=available.filter(actor=>actor.session?.active);
      const pool=active.length?active:available;
      let destination;
      if(pool.length){
        const target=pool[patrol.visit%pool.length],origin=target.walker.position;patrol.face={x:origin.x,z:origin.z};
        const options=[[1.05,0],[-1.05,0],[0,1.05],[0,-1.05],[.85,.85],[-.85,-.85]]
          .map(([dx,dz])=>({x:origin.x+dx,z:origin.z+dz}))
          .map(point=>({point,index:this.sharedNavigator.nearest(point)}))
          .filter(item=>item.index>=0)
          .map(item=>({point:this.sharedNavigator.point(item.index),distance:Math.hypot(this.sharedNavigator.point(item.index).x-walker.position.x,this.sharedNavigator.point(item.index).z-walker.position.z)}))
          .sort((a,b)=>a.distance-b.distance);
        destination=options[0]?.point;
      }
      if(!destination&&available.length){const seat=available[patrol.visit%available.length].seat;if(seat){const index=this.sharedNavigator.nearest({x:seat.x+1,z:seat.z});if(index>=0)destination=this.sharedNavigator.point(index);}}
      if(destination){
        patrol.begin(time,active.length);
        walker.setDestination(destination,null);
      }
    }
    walker.tick(dt,1.9);
    const position=walker.position,walking=walker.walking,cycle=walker.distanceWalked*12;
    model.root.position.set(position.x,0,position.z);
    const heading=walking?walker.heading:patrol.active&&patrol.kind==='encourage'&&patrol.face?Math.atan2(patrol.face.x-position.x,patrol.face.z-position.z):Math.PI;
    const delta=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));model.root.rotation.y+=delta*Math.min(1,dt*9);
    model.body.position.y=motion?(walking?Math.abs(Math.sin(cycle))*.04:Math.sin(time*.002)*.01):0;
    model.legL.rotation.x=motion&&walking?Math.sin(cycle)*.46:0;model.legR.rotation.x=-model.legL.rotation.x;
    model.armL.rotation.x=walking&&motion?-Math.sin(cycle)*.38:-.2;
    model.armR.rotation.x=commanding?-1.7:walking&&motion?Math.sin(cycle)*.38:patrol.active&&patrol.kind==='encourage'&&time<patrol.dwellUntil?-.95:-.2;
    model.armR.rotation.z=motion&&patrol.active&&patrol.kind==='encourage'&&time<patrol.dwellUntil?Math.sin(time*.012)*.22:0;
    for(const [key,prop]of Object.entries(model.props))prop.visible=key==='phone'&&commanding;
    model.eyes.scale.y=motion&&time%5400>5250?.1:1;
  }
  updateLabels(projectPoint,zoom){
    projectPoint(this.label,this.point(-2.1,1.1,6.9));
    for(const room of this.roomLabels)projectPoint(room.node,this.point(...room.point));
    projectPoint(this.ownerLabel,new THREE.Vector3(this.owner.root.position.x,2.25,this.owner.root.position.z));
    projectPoint(this.secretaryLabel,this.point(this.secretary.root.position.x,2.25,this.secretary.root.position.z));
  }
  destroy(){
    for(const model of [this.owner,this.secretary]){disposeCharacter(model);model.root.removeFromParent();}
    for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose();for(const texture of this.textures)texture.dispose();
    this.root.removeFromParent();this.label.remove();for(const room of this.roomLabels)room.node.remove();this.ownerLabel.remove();this.secretaryLabel.remove();
  }
}

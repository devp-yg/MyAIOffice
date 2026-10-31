import * as THREE from './vendor/three/three.module.js';
import { OfficeWalker } from './office-navigation.js';
import { OwnerJourney, OWNER_HOME, ELEVATOR_LOBBY, ELEVATOR_CABIN } from './office-building.js';
import {CeoRoutine,CEO_REST_ACTIONS,applyCeoRestPose} from './ceo-routine.js';

const PHASE_NAMES={idle:'팀 상황을 살피는 중',commanding:'각 층 직원에게 원격 지시 중','to-lift':'엘리베이터로 걸어가는 중','opening-origin':'엘리베이터 문 열리는 중',boarding:'엘리베이터에 타는 중','closing-origin':'엘리베이터 문 닫히는 중',riding:'엘리베이터로 층 이동 중','opening-destination':'목적 층에 도착했어요',exiting:'사무실로 걸어가는 중'};
const PATROL_SPACES=['reception','meeting','studio','library','research','server'];
export class OfficeOwner {
  constructor(office,createCharacter){
    this.office=office;this.journey=new OwnerJourney();this.floors=[];this.executiveFloorKey=null;this.doors=0;this.lastSignature='';this.lastPhase='';
    this.model=createCharacter(office.world,'server',{owner:true});this.model.root.userData.owner=true;
    this.walker=new OfficeWalker(office.navigator,this.homePoint());
    this.patrol=new CeoRoutine();
    this.label=document.createElement('button');this.label.className='world-agent-label owner-label show-task';this.label.innerHTML='<strong><span class="owner-label-name"></span><small class="agent-rank owner-label-rank"></small></strong><span class="owner-label-action">사무실을 살펴보는 중</span>';this.setOwnerIdentity({name:'CEO',title:'CEO',rank:'1'});
    this.label.addEventListener('click',()=>office.onOwnerSelect?.());office.labelLayer.append(this.label);
    this.buildLift();
  }
  setOwnerIdentity({name='CEO',title='CEO',rank='1'}={}){
    const displayName=String(name).trim()||'CEO',displayTitle=String(title).trim()||'CEO',displayRank=String(rank||'').trim().replace(/^#/,'');
    this.label.setAttribute('aria-label',`${displayName} · ${displayTitle}${displayRank?` · 조직 서열 ${displayRank}`:''}`);
    this.label.querySelector('.owner-label-name').textContent=displayName;
    this.label.querySelector('.owner-label-rank').textContent=`${displayTitle}${displayRank?` · #${displayRank}`:''}`;
  }
  homePoint(){const nav=this.office.navigator;return nav.executive?nav.station('desk',0):nav.point(nav.nearest(OWNER_HOME,'desk'));}
  buildLift(){
    const office=this.office,mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.55});
    const box=(color,x,y,z,w,h,d)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;office.world.add(mesh);return mesh;};
    box(0x9aaea5,-13.3,-.16,0,2.8,.3,2.65);box(0xd0b75e,-13.3,.025,0,2.5,.035,2.35);
    box(0x69877d,-14.57,1.15,0,.08,2.3,2.4);
    for(const z of [-1.22,1.22])box(0xc6cfc3,-13.3,.45,z,2.55,.9,.08);
    for(const z of [-1.23,1.23])box(0xb5a278,-11.96,1.2,z,.18,2.4,.12);
    box(0xb5a278,-11.96,2.42,0,.18,.15,2.55);
    this.doorPanels=[-1,1].map(side=>({side,mesh:box(0xb2c2b6,-11.99,1.15,side*.58,.10,2.28,1.14)}));
    box(0x436454,-11.85,2.7,0,.12,.35,1.5);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;this.displayCanvas=canvas;this.displayTexture=new THREE.CanvasTexture(canvas);this.displayTexture.colorSpace=THREE.SRGBColorSpace;
    const display=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.30),new THREE.MeshBasicMaterial({map:this.displayTexture,side:THREE.DoubleSide}));display.rotation.y=Math.PI/2;display.position.set(-11.77,2.7,0);office.world.add(display);
  }
  setDirectory(floors,initial){
    this.floors=floors;const known=key=>floors.some(f=>f.key===key),now=performance.now();
    const executiveFloor=floors.reduce((top,item)=>!top||item.number>top.number?item:top,null)?.key||initial||null;
    // The executive office is on the highest numbered project floor.
    if(!known(this.journey.floor)){this.journey.initialize(executiveFloor,now);this.walker.setDestination(this.homePoint(),'desk');}
    else if(executiveFloor&&executiveFloor!==this.executiveFloorKey)this.journey.request(executiveFloor,now);
    this.executiveFloorKey=executiveFloor;
    if(this.journey.target&&!known(this.journey.target)){this.journey.target=this.journey.floor;this.journey.pending=null;this.journey.phase='exiting';this.journey.phaseAt=now;}
    if(this.journey.pending&&!known(this.journey.pending))this.journey.pending=null;
  }
  command(floor){
    const now=performance.now(),wasPatrolling=this.patrol.active;this.stopPatrol(now);
    // Keep the owner's position, but clear an idle patrol route so the new
    // elevator destination starts from wherever the CEO currently is.
    if(wasPatrolling){this.walker.route=[];this.walker.pending=null;this.walker.walking=false;}
    this.journey.request(floor,now);
  }
  goTo(point,room=null){const nav=this.office.navigator;this.walker.setDestination(nav.point(nav.nearest(point)),room);}
  stopPatrol(time){this.patrol.cancel(time);}
  updatePatrol(time){
    const j=this.journey,p=this.patrol,office=this.office;
    const canPatrol=j.phase==='idle'&&!j.pending&&j.floor===this.executiveFloorKey&&j.floor===office.context&&office.navigator.executive&&!office.archiveMode;
    if(!canPatrol){if(p.active){this.stopPatrol(time);this.walker.route=[];this.walker.pending=null;this.walker.walking=false;}return;}
    if(p.active)return;
    if(!p.due(time)||this.walker.walking)return;
    const team=[...office.actors.values()].filter(actor=>actor.session.projectKey===j.floor&&actor.session.active&&!actor.leaving);
    const rest=CEO_REST_ACTIONS[p.nextKind(team.length)];
    if(rest){p.begin(time,team.length);this.goTo(office.navigator.station(rest.room,rest.slot),rest.room);return;}
    const counts=new Map();for(const actor of team){const room=actor.desired?.room;if(PATROL_SPACES.includes(room))counts.set(room,(counts.get(room)||0)+1);}
    const ranked=PATROL_SPACES.filter(room=>room!==this.walker.room).sort((a,b)=>(counts.get(b)||0)-(counts.get(a)||0));
    const activeRooms=ranked.filter(room=>counts.has(room));
    const candidates=activeRooms.length?activeRooms:ranked;
    const room=candidates[p.visit%Math.min(candidates.length,3)]||PATROL_SPACES[p.visit%PATROL_SPACES.length];
    const nearby=counts.get(room)||0;
    p.begin(time,team.length,nearby);
    this.goTo(office.navigator.station(room,0),room);
  }
  update(dt,time){
    const j=this.journey,p=this.patrol;j.tick(time);
    this.updatePatrol(time);
    if(j.phase!==this.lastPhase){
      this.lastPhase=j.phase;
      if(j.phase==='to-lift')this.goTo(ELEVATOR_LOBBY);
      if(j.phase==='boarding')this.goTo(ELEVATOR_CABIN);
      if(j.phase==='exiting')this.goTo(this.homePoint(),'desk');
    }
    this.walker.tick(dt,2.25);
    p.tick(time,{walking:this.walker.walking,blocked:this.walker.blocked});
    const elapsed=time-j.phaseAt;
    const wantsOpen=['opening-origin','boarding','opening-destination','exiting'].includes(j.phase);
    this.doors=THREE.MathUtils.clamp(this.doors+(wantsOpen?1:-1)*dt*1.5,0,1);
    const visible=j.floor===this.office.context||j.phase==='riding'&&j.from===this.office.context;
    for(const {mesh,side}of this.doorPanels)mesh.position.z=side*(.58+(visible?this.doors:0)*1.10);
    if(!this.walker.walking&&!this.walker.blocked){
      if(j.phase==='to-lift')j.advance('at-lobby',time);
      else if(j.phase==='boarding')j.advance('in-cabin',time);
      else if(j.phase==='exiting')j.advance('at-home',time);
    }
    if(j.phase.startsWith('opening-')&&this.doors>=.999)j.advance('doors-open',time);
    if(j.phase==='closing-origin'&&this.doors<=.001)j.advance('doors-closed',time);
    const floor=key=>this.floors.find(f=>f.key===key);
    const from=floor(j.from),target=floor(j.target),duration=Math.min(4800,2200+Math.abs((target?.number||1)-(from?.number||1))*180);
    const progress=j.phase==='riding'?Math.min(1,elapsed/duration):0;
    if(j.phase==='riding'&&elapsed>=duration){j.advance('ride-complete',time);this.office.onFloorArrival?.(j.floor);}
    const model=this.model,walking=this.walker.walking,cycle=this.walker.distanceWalked*12;
    model.root.visible=Boolean(j.floor)&&visible;this.label.hidden=!model.root.visible;
    model.root.position.set(this.walker.position.x,j.phase==='riding'?Math.sin(progress*Math.PI)*.12:0,this.walker.position.z);
    const resting=j.phase==='idle'&&!walking&&p.rest;
    const heading=walking?this.walker.heading:j.phase==='commanding'?.6:resting?resting.heading:-Math.PI/2;
    let delta=heading-model.root.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));model.root.rotation.y+=delta*Math.min(1,dt*10);
    model.body.position.y=this.office.motion?(walking?Math.abs(Math.sin(cycle))*.04:Math.sin(time*.002)*.01):0;
    model.legL.rotation.x=walking&&this.office.motion?Math.sin(cycle)*.48:0;model.legR.rotation.x=-model.legL.rotation.x;
    model.armL.rotation.x=walking&&this.office.motion?-Math.sin(cycle)*.4:-.2;
    model.armR.rotation.x=j.phase==='commanding'?-1.7:walking&&this.office.motion?Math.sin(cycle)*.4:p.active&&p.kind==='encourage'&&time<p.dwellUntil?-.95:-.2;
    model.armR.rotation.z=p.active&&p.kind==='encourage'&&time<p.dwellUntil&&this.office.motion?Math.sin(time*.012)*.22:0;
    applyCeoRestPose(model,resting?p.kind:null,time,this.office.motion);
    for(const [key,prop]of Object.entries(model.props))prop.visible=j.phase==='commanding'?key==='phone':Boolean(resting?.prop&&key===resting.prop);
    model.eyes.scale.y=this.office.motion&&time%5400>5250?.1:1;
    const statusText=j.phase==='idle'?p.text:PHASE_NAMES[j.phase];
    const phase=p.active&&j.phase==='idle'?(resting?'resting':'patrolling'):j.phase;
    this.label.querySelector('strong').nextElementSibling.textContent=statusText;this.label.dataset.phase=phase;this.label.dataset.floor=j.floor||'';
    if(model.root.visible)this.office.placeLabel(this.label,new THREE.Vector3(this.walker.position.x,2.65,this.walker.position.z));
    const current=floor(j.floor);const display=`${current?.number||'—'}F ${j.phase==='riding'?' → '+(target?.number||'—')+'F':''}`;
    if(this.lastDisplay!==display){const ctx=this.displayCanvas.getContext('2d');ctx.fillStyle='#304d40';ctx.fillRect(0,0,256,64);ctx.fillStyle='#ecdf9c';ctx.font='bold 36px monospace';ctx.textAlign='center';ctx.fillText(display,128,46);this.displayTexture.needsUpdate=true;this.lastDisplay=display;}
    const status={phase,text:statusText,floor:j.floor,target:j.target,pending:j.pending,from:j.from,progress,number:current?.number,targetNumber:target?.number};
    const signature=JSON.stringify({...status,progress:Math.round(progress*20)});
    if(signature!==this.lastSignature){this.lastSignature=signature;this.office.onOwnerStatus?.(status);}
  }
}

import * as THREE from './vendor/three/three.module.js';
import {OfficeNavigator,OfficeWalker} from './office-navigation.js';

export const VISITOR_PROFILE=Object.freeze({name:'봄이',dueDate:'2027-02-28',baby:'아들',role:'CEO 배우자'});

// Compare calendar days, so DST and the time of day cannot shift the week.
// A due date is 40 weeks exactly; passing it does not imply an actual birth.
export function pregnancyProgress(date=new Date(),dueDate=VISITOR_PROFILE.dueDate){
  const [year,month,day]=dueDate.split('-').map(Number);
  const today=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
  const daysUntilDue=Math.round((Date.UTC(year,month-1,day)-today)/86400000);
  const elapsedDays=Math.max(0,280-daysUntilDue),weeks=Math.floor(elapsedDays/7),days=elapsedDays%7;
  return {weeks,days,daysUntilDue,label:`임신 ${weeks}주 ${days}일`};
}

// Stylized growth, interpolated daily. Keep the silhouette inside the shared
// navigation radius even at term, so the same doors and paths remain safe.
export function maternityShape(weeks,days=0){
  const stages=[
    [0,.205,.17,.10,.04,.62],[12,.21,.18,.11,.055,.61],
    [20,.23,.22,.17,.115,.59],[28,.25,.25,.215,.14,.57],
    [36,.27,.28,.25,.16,.56],[40,.28,.29,.26,.16,.55],
  ];
  const age=Math.max(0,Math.min(40,weeks+days/7));
  const end=stages.findIndex(stage=>stage[0]>=age),a=stages[Math.max(0,end-1)],b=stages[end];
  const t=a[0]===b[0]?0:(age-a[0])/(b[0]-a[0]);
  const [x,y,z,centerZ,centerY]=a.slice(1).map((value,index)=>value+(b[index+1]-value)*t);
  return {x,y,z,centerZ,centerY};
}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const SPOUSE_DISTANCE=Object.freeze({minimum:2.2,watching:5.5,preferred:7,maximum:10});
export const SPOUSE_TRIGGER_DISTANCE=3;
export const OFFICE_KEEP_OUT=2;

export function visitorNavigator(source){
  // The shared office treats the entire private wing as the CEO office.
  // In the tower, only the actual CEO room and its surrounding buffer apply.
  const bounds=source.customLayout?.executive?.bounds||(source.executive?source.roomLayout.find(room=>room.key==='desk')?.bounds:null);
  const exclusion=bounds?[bounds[0]-OFFICE_KEEP_OUT,bounds[1]+OFFICE_KEEP_OUT,bounds[2]-OFFICE_KEEP_OUT,bounds[3]+OFFICE_KEEP_OUT]:null;
  const inRoom=(point,margin)=>source.roomLayout.some(({bounds:[x0,x1,z0,z1]})=>point.x>=x0-margin&&point.x<=x1+margin&&point.z>=z0-margin&&point.z<=z1+margin);
  const nav=new OfficeNavigator({bounds:source.bounds,rooms:source.roomLayout,workSpots:source.workSpots,blockers:source.blockers,regionAt:source.customLayout?.regionAt,
    isWalkable:(point,margin)=>source.isWalkable(point)&&!inRoom(point,margin)&&(!exclusion||point.x<exclusion[0]-margin||point.x>exclusion[1]+margin||point.z<exclusion[2]-margin||point.z>exclusion[3]+margin),
  });
  nav.exclusion=exclusion;return nav;
}

// A spouse is an ambient character, never a session, employee or task owner.
export class SpouseWatch {
  constructor(navigator){this.bind(navigator);}
  bind(navigator,{preserve=false}={}){
    const previous=preserve?this.walker?.position:null;
    this.sourceNavigator=navigator;this.executive=navigator.executive;this.navigator=visitorNavigator(navigator);
    const layout=navigator.customLayout,start=layout?.circulation.gardenVisit||(navigator.executive?{x:-10.2,z:3}:{x:-2,z:0}),nav=this.navigator;
    this.walker=new OfficeWalker(nav,previous&&nav.isWalkable(previous)?previous:nav.point(nav.nearest(previous||start)));
    this.state='waiting';this.facing=null;this.replanIn=0;this.lastPair=null;this.lastSecretary=null;this.anchor=null;
    this.watchTime=0;this.camouflageHeading=null;
    // Keep viewpoints near the edge of a passage or beside existing scenery.
    // Low garden furniture conceals the stance without blocking a brief glance.
    const cover=nav.blockers.filter(item=>['garden-bed','garden-bench'].includes(item.type));
    this.coverScores=Array.from(nav.free,(free,index)=>{
      if(!free)return 0;
      const point=nav.point(index),edge=nav.neighbors(index).some(next=>!nav.free[next]);
      const besideCover=cover.some(item=>Math.hypot(Math.max(0,Math.abs(point.x-item.x)-item.w/2),Math.max(0,Math.abs(point.z-item.z)-item.d/2))<1.5);
      return (edge?1.2:0)+(besideCover?1.2:0);
    });
    const stops=[layout?.circulation.hub,{x:-16,z:0},{x:16,z:0},...(layout?.circulation.paths||[]).filter(path=>['main-concourse','central-promenade','courtyard-forecourt','garden-north','garden-east','garden-south'].includes(path.id)).map(({bounds:[x0,x1,z0,z1]})=>({x:(x0+x1)/2,z:(z0+z1)/2})),
      layout?.circulation.gardenVisit,layout?{x:17.2,z:layout.park.bounds[2]+1.1}:null,layout?{x:17.2,z:layout.park.bounds[3]-1}:null].filter(Boolean);
    this.roamStops=[...new Set(stops.map(point=>nav.nearest(point)).filter(index=>index>=0))].map(index=>nav.point(index));this.roamIndex=0;this.pause=0;
    this.restStops=(layout?.circulation.restStops||[]).filter(stop=>nav.isWalkable(stop));
    this.restTarget=null;this.restingSeat=null;this.walkingTime=0;this.lastRestId=null;this.resumeStop=null;
  }
  stroll(dt){
    this.facing=null;this.lastPair=null;this.lastSecretary=null;this.anchor=null;this.replanIn=0;this.watchTime=0;this.camouflageHeading=null;
    const w=this.walker;
    if(this.state!=='strolling'&&this.state!=='resting'){this.stop();this.pause=0;}
    if(w.walking){
      this.walkingTime+=dt;
      if(!this.restTarget&&this.walkingTime>=10){
        const stops=this.restStops.filter(stop=>stop.id!==this.lastRestId).sort((a,b)=>distance(w.position,a)-distance(w.position,b));
        for(const stop of stops){
          if(!this.navigator.findPath(w.position,stop).length)continue;
          this.resumeStop={...w.destination};this.restTarget=stop;w.setDestination(stop,null);break;
        }
      }
      w.tick(dt,1.35);this.state=w.walking?'strolling':'resting';
      if(!w.walking){
        this.restingSeat=this.restTarget&&distance(w.position,this.restTarget)<.7?this.restTarget:null;
        this.pause=this.restingSeat?12:3;
        if(this.restingSeat){this.lastRestId=this.restingSeat.id;this.walkingTime=0;}
      }
      return;
    }
    this.pause-=dt;if(this.pause>0){this.state='resting';return;}
    this.restingSeat=null;this.restTarget=null;
    if(this.resumeStop){
      const target=this.resumeStop;this.resumeStop=null;
      if(distance(w.position,target)>1){w.setDestination(target,null);if(w.walking){this.state='strolling';return;}}
    }
    for(let attempt=0;attempt<this.roamStops.length;attempt++){
      const point=this.roamStops[this.roamIndex++%this.roamStops.length];
      if(distance(w.position,point)<1)continue;
      w.setDestination(point,null);if(w.walking){this.state='strolling';return;}
    }
    this.pause=3;this.state='resting';
  }
  stop(){const w=this.walker;w.route=[];w.pending=null;w.walking=false;w.blocked=false;w.destination={...w.position};}
  canSee(from,to){
    return !this.navigator.blockers.some(item=>{
      if((item.displayHeight??item.h??0)<1.4||item.finish==='glass')return false;
      const angle=item.rotation||0,c=Math.cos(angle),s=Math.sin(angle);
      const x=from.x-item.x,z=from.z-item.z,dx=to.x-from.x,dz=to.z-from.z;
      let low=0,high=1;
      for(const [origin,delta,half]of [[c*x-s*z,c*dx-s*dz,item.w/2],[s*x+c*z,s*dx+c*dz,item.d/2]]){
        if(Math.abs(delta)<1e-8){if(Math.abs(origin)>half)return false;continue;}
        const a=(-half-origin)/delta,b=(half-origin)/delta;
        low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return false;
      }
      return high>.001&&low<.999;
    });
  }
  goal(pair){
    const traveling=pair.ownerWalking??pair.walking,heading=(traveling?pair.secretaryHeading:pair.heading)??pair.heading??0;
    // Trail behind and slightly to one side, rather than confronting the pair
    // in front of the secretary. Navigation still clips this to allowed roads.
    return {
      x:pair.secretary.x-Math.sin(heading)*SPOUSE_DISTANCE.preferred+Math.cos(heading)*1.2,
      z:pair.secretary.z-Math.cos(heading)*SPOUSE_DISTANCE.preferred-Math.sin(heading)*1.2,
    };
  }
  plan(pair){
    const {owner,secretary}=pair,w=this.walker,nav=this.navigator,candidates=[];
    const goal=this.goal(pair),traveling=pair.ownerWalking??pair.walking;
    const heading=(traveling?pair.secretaryHeading:pair.heading)??pair.heading??0;
    const ownerLimit=Math.max(SPOUSE_DISTANCE.maximum,distance(owner,secretary)+SPOUSE_DISTANCE.preferred);
    const center={x:(owner.x+secretary.x)/2,z:(owner.z+secretary.z)/2};
    const startClearance=Math.min(distance(w.position,owner),distance(w.position,secretary));
    const clearance=Math.max(.9,Math.min(SPOUSE_DISTANCE.minimum+.05,startClearance-.05)),start=w.walking?w.route[0]:w.position;
    const first=nav.nearest(start),reachable=new Set([first]),queue=[first];
    // A road may be too narrow to pass the pair. Choose a viewpoint on her
    // reachable side instead of repeatedly aiming for the opposite side.
    for(let i=0;i<queue.length;i++)for(const next of nav.neighbors(queue[i])){
      if(!nav.free[next]||reachable.has(next))continue;
      const p=nav.point(next);if(distance(p,owner)<clearance||distance(p,secretary)<clearance)continue;
      reachable.add(next);queue.push(next);
    }
    // Inspect actual walkable cells so even a narrow doorway can provide a
    // distant view; a ring of sampled angles can miss such openings entirely.
    for(const index of reachable){
      if(index<0)continue;
      const point=nav.point(index),near=Math.min(distance(point,owner),distance(point,secretary));
      if(near<SPOUSE_DISTANCE.watching)continue;
      const forward=(point.x-center.x)*Math.sin(heading)+(point.z-center.z)*Math.cos(heading);
      const outsideRange=distance(point,secretary)>SPOUSE_DISTANCE.maximum||distance(point,owner)>ownerLimit;
      const inFront=(person,facing)=>{
        const gap=distance(point,person);
        return ((point.x-person.x)*Math.sin(facing)+(point.z-person.z)*Math.cos(facing))/gap>.45;
      };
      const exposed=inFront(owner,pair.ownerFacing??pair.heading??heading)||inFront(secretary,pair.secretaryFacing??pair.secretaryHeading??heading);
      candidates.push({point,visible:this.canSee(point,secretary),score:distance(point,goal)*1.2+distance(point,w.position)*.15+Math.abs(near-SPOUSE_DISTANCE.preferred)*.6+Math.max(0,forward)+(exposed?8:0)+(outsideRange?20:0)-this.coverScores[index]});
    }
    candidates.sort((a,b)=>a.score-b.score);
    // When a corner hides the pair, approach a safe nearby passage first,
    // then look for a clear view again instead of staying across the map.
    for(const visible of [true,false])for(const {point}of candidates.filter(candidate=>candidate.visible===visible).slice(0,16)){
      // Finish the current grid segment before turning. Replanning from a
      // nearest cell behind her used to produce aimless-looking backtracking.
      const route=nav.findPath(start,point,{avoid:[owner,secretary],clearance});if(!route.length)continue;
      // Never take a shortcut between the couple. If they approach her,
      // allow an escape route only while its clearance increases.
      let safeClearance=Math.min(SPOUSE_DISTANCE.minimum,startClearance),safe=true;
      for(const step of route){
        const next=Math.min(distance(step,owner),distance(step,secretary));
        if(next<safeClearance-.05){safe=false;break;}
        safeClearance=Math.min(SPOUSE_DISTANCE.minimum,next);
      }
      if(!safe)continue;
      if(w.walking&&distance(w.destination,point)<.7)return;
      if(distance(w.position,route[0])<.01)route.shift();
      w.route=route;w.pending=null;w.destination={...point};w.targetRoom=null;w.walking=route.length>0;w.blocked=false;
      this.anchor={...point};this.camouflageHeading=null;return;
    }
  }
  tick(dt,pair=null){
    const w=this.walker;
    // Only their proximity triggers jealousy. When they separate, immediately
    // release the stare and resume her own road-only stroll.
    if(pair?.insideOffice||!pair?.active||distance(pair.owner,pair.secretary)>SPOUSE_TRIGGER_DISTANCE){this.stroll(dt);return;}
    if(this.state==='strolling'||this.state==='resting'){this.stop();this.pause=0;this.replanIn=0;this.restTarget=null;this.restingSeat=null;this.walkingTime=0;this.resumeStop=null;}
    this.facing={...pair.secretary};this.replanIn-=dt;this.watchTime+=dt;
    const near=Math.min(distance(w.position,pair.owner),distance(w.position,pair.secretary));
    const far=Math.max(distance(w.position,pair.owner),distance(w.position,pair.secretary));
    const traveling=pair.ownerWalking??pair.walking;
    const ownerLimit=Math.max(SPOUSE_DISTANCE.maximum,distance(pair.owner,pair.secretary)+SPOUSE_DISTANCE.preferred);
    const settled=near>=SPOUSE_DISTANCE.watching&&distance(w.position,pair.owner)<=ownerLimit&&distance(w.position,pair.secretary)<=SPOUSE_DISTANCE.maximum&&this.canSee(w.position,pair.secretary);
    const atVantage=Boolean(this.anchor&&!w.walking&&distance(w.position,this.anchor)<.15&&this.lastPair&&distance(this.lastPair,pair.owner)<.8&&distance(this.lastSecretary,pair.secretary)<1.3);
    if(!traveling&&settled&&atVantage){this.stop();this.anchor={...w.position};this.state='watching';this.setCamouflageHeading();return;}
    const shifted=!this.lastPair||distance(this.lastPair,pair.owner)>.8||distance(this.lastSecretary,pair.secretary)>.8||this.wasTraveling!==traveling;
    const needsCatchup=traveling&&!w.walking&&far>SPOUSE_DISTANCE.maximum;
    if((this.replanIn<=0||needsCatchup)&&(shifted||!w.walking||near<SPOUSE_DISTANCE.watching)){
      this.plan(pair);this.lastPair={...pair.owner};this.lastSecretary={...pair.secretary};this.wasTraveling=traveling;this.replanIn=.65;
    }
    if(w.walking){
      const speed=far>SPOUSE_DISTANCE.maximum?2.65:2.1;
      const next=w.route[0],step=Math.min(distance(w.position,next),dt*speed);
      const length=distance(w.position,next)||1,point={x:w.position.x+(next.x-w.position.x)*step/length,z:w.position.z+(next.z-w.position.z)*step/length};
      const nextNear=Math.min(distance(point,pair.owner),distance(point,pair.secretary));
      if(nextNear<SPOUSE_DISTANCE.minimum&&nextNear<near-.001){this.stop();this.replanIn=0;}
      else w.tick(dt,speed);
    }
    this.state=w.walking?'following':!traveling&&settled?'watching':'observing';
    if(!w.walking)this.setCamouflageHeading();
  }
  setCamouflageHeading(){
    if(this.camouflageHeading===null&&this.facing)this.camouflageHeading=Math.atan2(this.facing.x-this.walker.position.x,this.facing.z-this.walker.position.z)+1.05;
  }
  get peeking(){return Boolean(this.facing)&&distance(this.walker.position,this.facing)>=SPOUSE_DISTANCE.watching&&this.watchTime%6.5<1.1&&this.canSee(this.walker.position,this.facing);}
  get text(){if(this.restingSeat)return '벤치에 앉아 느긋하게 쉬는 중';return {waiting:'가볍게 산책 나갈 준비 중',strolling:'여유롭게 오피스를 한 바퀴 둘러보는 중',resting:'잠깐 멈춰 쉬어 가는 중',following:'주변을 구경하며 천천히 걷는 중',watching:'잠깐 멈춰 주변을 둘러보는 중',observing:'오피스 풍경을 구경하는 중'}[this.state];}
  get summary(){if(this.restingSeat)return '벤치에서 휴식';return {waiting:'산책 준비',strolling:'느긋한 산책',resting:'잠깐 쉬는 중',following:'천천히 걷는 중',watching:'주변 구경',observing:'오피스 구경'}[this.state];}
}

export class OfficeVisitor {
  constructor(world,labelLayer,createCharacter,{shared=false}={}){
    this.model=createCharacter(world,'meeting',{index:7,pregnant:true,accessory:'none'});
    this.label=document.createElement('div');
    this.label.className=shared?'study-agent-label visitor-label':'world-agent-label visitor-label show-task';
    this.label.style.setProperty('--project','#b77f96');this.label.style.pointerEvents='none';
    this.title=document.createElement('strong');
    const role=document.createElement('small');role.className='study-agent-project';role.textContent=`${VISITOR_PROFILE.role} · ${VISITOR_PROFILE.baby}`;
    this.action=document.createElement('span');this.action.className='study-agent-action';
    this.label.append(this.title,role,this.action);labelLayer.append(this.label);
    this.refreshPregnancy();this.nextPregnancyCheck=0;
    for(const prop of Object.values(this.model.props))prop.visible=false;
    this.model.root.visible=false;this.label.hidden=true;
  }
  update(navigator,dt,time,motion=true,visible=true,pair=null){
    if(time>=this.nextPregnancyCheck){this.refreshPregnancy();this.nextPregnancyCheck=time+1000;}
    this.model.root.visible=visible;if(!visible){this.label.hidden=true;return;}
    if(!this.routine)this.routine=new SpouseWatch(navigator);
    else if(this.routine.sourceNavigator!==navigator||this.routine.executive!==navigator.executive||this.context!==pair?.context)this.routine.bind(navigator,{preserve:this.context===pair?.context&&this.routine.executive===navigator.executive});
    this.context=pair?.context;this.routine.tick(dt,pair);
    const {walker}=this.routine,{model}=this,walking=walker.walking;
    const seated=this.routine.restingSeat,bench=seated?.bench;
    model.root.position.set(bench?bench.x+Math.sin(seated.heading)*.12:walker.position.x,0,bench?bench.z+Math.cos(seated.heading)*.12:walker.position.z);
    const face=this.routine.facing,direction=face?Math.atan2(face.x-walker.position.x,face.z-walker.position.z):model.root.rotation.y;
    const heading=walking?walker.heading:seated?seated.heading:this.routine.camouflageHeading??model.root.rotation.y;
    const turn=Math.atan2(Math.sin(heading-model.root.rotation.y),Math.cos(heading-model.root.rotation.y));
    model.root.rotation.y+=turn*Math.min(1,dt*7);
    const headTurn=Math.atan2(Math.sin(direction-model.root.rotation.y),Math.cos(direction-model.root.rotation.y));
    const watching=this.routine.peeking&&Math.abs(headTurn)<=1.3;
    const glance=watching?THREE.MathUtils.clamp(headTurn,-1.3,1.3):0;
    model.head.rotation.y=face?THREE.MathUtils.lerp(model.head.rotation.y,glance,Math.min(1,dt*9)):0;model.head.rotation.x=watching?.02:0;
    if(model.glare)model.glare.visible=watching;
    if(model.smile)model.smile.visible=!watching;
    const stride=motion&&walking?Math.sin(walker.distanceWalked*10):0;
    model.body.position.y=motion?(walking?Math.abs(stride)*.018:Math.sin(time*.0018)*.006):0;
    if(seated)model.body.position.y+=.22;
    model.legL.rotation.x=seated?-1.1:stride*.28;model.legR.rotation.x=seated?-1.1:-stride*.28;
    model.armL.rotation.set(-stride*.18,0,-.06);
    model.armR.rotation.set(-.65,0,-.35);
    model.eyes.scale.y=motion&&time%5600>5460?.12:watching?.75:1;
    if(this.action.textContent!==this.routine.text){
      this.action.textContent=this.routine.text;
      this.updateAccessibleLabel();
    }
    this.label.dataset.state=this.routine.state;
    this.label.dataset.peeking=String(watching);
    if(pair?.active){this.label.dataset.ownerDistance=distance(walker.position,pair.owner).toFixed(1);this.label.dataset.secretaryDistance=distance(walker.position,pair.secretary).toFixed(1);}
  }
  refreshPregnancy(date=new Date()){
    const progress=pregnancyProgress(date);if(this.progress?.label===progress.label)return;
    this.progress=progress;this.title.textContent=`${VISITOR_PROFILE.name} · ${progress.label}`;
    const shape=maternityShape(progress.weeks,progress.days);
    if(this.model.belly){this.model.belly.scale.set(shape.x,shape.y,shape.z);this.model.belly.position.set(0,shape.centerY,shape.centerZ);}
    this.label.title=`${this.title.textContent} · ${VISITOR_PROFILE.baby} · 출산 예정일 ${VISITOR_PROFILE.dueDate}`;
    this.updateAccessibleLabel();
  }
  updateAccessibleLabel(){this.label.setAttribute('aria-label',`${VISITOR_PROFILE.name} · ${this.progress.label} · ${VISITOR_PROFILE.baby} · ${VISITOR_PROFILE.role} · ${this.action.textContent} · 출산 예정일 ${VISITOR_PROFILE.dueDate}`);}
  get labelPoint(){return new THREE.Vector3(this.model.root.position.x,2.2,this.model.root.position.z);}
  destroy(disposeCharacter){this.model.root.removeFromParent();disposeCharacter(this.model);this.label._leader?.remove();this.label.remove();}
}

export const CEO_ACTION_TEXT={
  review:'팀의 진행 상황을 점검하는 중',
  encourage:'직원들을 격려하는 중',
  coordinate:'업무 흐름과 우선순위를 조율하는 중',
  command:'새 요청을 담당 직원에게 전달하는 중',
  tea:'라운지에서 차를 마시며 쉬는 중',
  read:'서재에서 책을 읽으며 쉬는 중',
  stretch:'집무실에서 기지개를 켜며 쉬는 중',
  idle:'팀 현황을 살피는 중',
};

export const CEO_REST_ACTIONS={
  tea:{room:'research',slot:1,duration:12000,prop:'cup',heading:Math.PI/2,walkingText:'차를 마시러 라운지로 이동 중'},
  read:{room:'library',slot:0,duration:15000,prop:'book',heading:Math.PI,walkingText:'책을 읽으러 서재로 이동 중'},
  stretch:{room:'desk',slot:1,duration:8000,prop:null,heading:-Math.PI/2,walkingText:'잠깐 쉬러 집무실로 이동 중'},
};
const REST_KINDS=Object.keys(CEO_REST_ACTIONS);

// The same leadership rhythm drives both office renderings. Each scene only
// supplies its own staff positions and navigation points.
export class CeoRoutine {
  constructor({firstDelay=8500}={}){
    this.nextAt=performance.now()+firstDelay;this.dwellUntil=0;this.visit=0;
    this.active=false;this.kind='review';this.text=CEO_ACTION_TEXT.idle;
    this.workSinceRest=0;this.restCount=0;this.duration=0;
    this.requestTokens=new Map();this.commandUntil=0;this.requestBaseline=Date.now();
  }
  due(time){return !this.active&&time>=this.nextAt;}
  get rest(){return this.active?CEO_REST_ACTIONS[this.kind]||null:null;}
  nextKind(activeWorkers=0,nearbyWorkers=activeWorkers){
    if(!activeWorkers||this.workSinceRest>=3)return REST_KINDS[this.restCount%REST_KINDS.length];
    return this.visit%3===2?'coordinate':nearbyWorkers?'encourage':'review';
  }
  begin(time,activeWorkers=0,nearbyWorkers=activeWorkers){
    this.kind=this.nextKind(activeWorkers,nearbyWorkers);
    this.text=CEO_ACTION_TEXT[this.kind];this.active=true;this.dwellUntil=0;
    if(this.rest)this.duration=this.rest.duration;
    else{this.visit++;this.duration=5200+(this.visit%3)*1100;}
  }
  tick(time,{walking=false,blocked=false}={}){
    if(!this.active)return;
    if(blocked){this.cancel(time);return;}
    if(walking){if(this.rest)this.text=this.rest.walkingText;return;}
    this.text=CEO_ACTION_TEXT[this.kind];
    // Time spent reaching a room does not consume the action's duration.
    if(!this.dwellUntil)this.dwellUntil=time+this.duration;
    if(time>=this.dwellUntil)this.finish(time);
  }
  finish(time){
    if(this.rest){this.restCount++;this.workSinceRest=0;}else this.workSinceRest++;
    this.active=false;this.text=CEO_ACTION_TEXT.idle;this.nextAt=time+15500+(this.visit%4)*4200;
  }
  cancel(time=performance.now()){this.active=false;this.dwellUntil=0;this.text=CEO_ACTION_TEXT.idle;this.nextAt=time+15500;}
  observeRequests(actors,time){
    for(const actor of actors){
      const session=actor.session,token=session?.requestId;if(!token)continue;
      const previous=this.requestTokens.get(actor.id);
      const fresh=previous===undefined
        ? Number(session.lastRequestAt||0)>=this.requestBaseline-2000
        : previous!==token;
      this.requestTokens.set(actor.id,token);
      if(fresh){actor.commandUntil=time+2600;this.commandUntil=Math.max(this.commandUntil,time+2600);}
    }
    return this.commandUntil>time;
  }
}

// Both renderers use the same props and reset the pose when a request interrupts.
export function applyCeoRestPose(model,kind,time,motion){
  model.head.rotation.x=kind==='read'?.16:0;
  model.armL.rotation.z=0;
  const cup=model.props.cup;
  cup.position.set(0,.64,.30);cup.rotation.x=0;
  if(kind==='tea'){
    const sip=motion?Math.max(0,Math.sin(time*.0018)):0;
    model.armL.rotation.x=-.8;model.armR.rotation.x=-.8-sip*.25;
    cup.position.y=.78+sip*.18;cup.rotation.x=-sip*.2;
  }else if(kind==='read'){
    model.armL.rotation.x=-.85;model.armR.rotation.x=-.85;
    if(motion)model.head.rotation.x+=Math.sin(time*.002)*.025;
  }else if(kind==='stretch'){
    const reach=motion?Math.sin(time*.002)*.1:0;
    model.armL.rotation.x=-.15;model.armR.rotation.x=-.15;
    model.armL.rotation.z=-2.5-reach;model.armR.rotation.z=2.5+reach;
    model.head.rotation.x=-.1;
  }
}

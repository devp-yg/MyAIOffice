import { OfficeWalker } from './office-navigation.js';
import { SECRETARY_STATION } from './office-executive.js';

export const SECRETARY_STOPS = {
  home:{room:'studio',x:SECRETARY_STATION.x+.18,z:SECRETARY_STATION.z,face:{x:-8.4,z:.4}},
  pantry:{room:'research',x:5.25,z:-2.15,face:{x:6.35,z:-1.4}},
  ceo:{room:'desk',x:-2.5,z:-1.2,face:{x:-.85,z:-1.6}},
  reception:{room:'reception',x:-8.65,z:-3.15,face:{x:-8.65,z:-4.35}},
  office:{room:'desk',x:-2.1,z:-2.15,face:{x:-2,z:-3.2}},
};

const walk=(stop,text,prop='clipboard')=>({stop,text,prop,action:'walk'});
const work=(stop,text,action,duration,prop='clipboard',service=null)=>({stop,text,action,duration,prop,service});

// This clock advances only while the executive floor is being shown.
export class SecretaryRoutine {
  constructor(navigator,{random=Math.random,onService=()=>{}}={}){
    this.navigator=navigator;this.random=random;this.onService=onService;
    this.stops=Object.fromEntries(Object.entries(SECRETARY_STOPS).map(([key,stop])=>[key,{...stop,...navigator.point(navigator.nearest(stop,stop.room))}]));
    this.walker=new OfficeWalker(navigator,this.stops.home);
    this.steps=[];this.index=0;this.stepTime=0;this.idleTime=5;
    this.job=null;this.jobIndex=0;this.greeting=null;this.pendingGreeting=null;this.ownerState=null;
    this.servedGuests=new Set();this.visitorCooldown=0;this.delivered=false;
  }
  get step(){return this.steps[this.index]||null;}
  get text(){return this.greeting?.text||this.step?.text||'일정과 방문객을 확인하는 중';}
  get prop(){return this.step?.prop||'clipboard';}
  get working(){return Boolean(this.step&&this.step.action!=='walk');}
  get facing(){return this.stops[this.step?.stop||'home'].face;}
  greet(text){this.greeting={text,elapsed:0,duration:3.4};}
  start(job){
    this.job=job;this.delivered=false;
    if(job==='tea'||job==='snacks'){
      const tea=job==='tea',prop=tea?'teaTray':'snackTray',target=tea?'ceo':'reception';
      this.steps=[walk('pantry',tea?'차를 준비하러 가는 중':'손님 다과를 준비하러 가는 중'),
        work('pantry',tea?'따뜻한 차를 준비하는 중':'차와 다과를 담는 중','prepare',4.5,prop),
        walk(target,tea?'CEO께 차를 가져가는 중':'접견실로 다과를 가져가는 중',prop),
        work(target,tea?'대표님, 차 준비해 드렸어요':'손님께 차와 다과를 내는 중','serve',4,prop,job),
        walk('pantry','빈 쟁반을 가져가는 중','emptyTray'),work('pantry','쟁반과 찻잔을 정리하는 중','tidy',3,'emptyTray'),
        walk('home','비서 데스크로 돌아가는 중')];
    }else{
      const stop=job==='tidy-office'?'office':job==='tidy-reception'?'reception':'home';
      const room=stop==='office'?'집무실':stop==='reception'?'접견실':'비서 데스크';
      this.steps=[walk(stop,`${room} 정리를 하러 가는 중`),work(stop,`${room}을 가지런히 정리하는 중`,'tidy',6,'cloth'),walk('home','비서 데스크로 돌아가는 중')];
    }
    this.index=0;this.enterStep();
  }
  enterStep(){
    this.stepTime=0;
    if(this.step?.action==='walk'){const stop=this.stops[this.step.stop];this.walker.setDestination(stop,stop.room);}
  }
  next(){
    this.index++;
    if(!this.step){this.steps=[];this.job=null;this.idleTime=18+this.random()*14;}
    else this.enterStep();
  }
  cancelService(){
    const prop=this.prop;
    this.job='return';
    this.steps=[walk('pantry','준비한 다과를 티룸으로 가져가는 중',prop.includes('Tray')?prop:'clipboard'),work('pantry','다음 차 준비를 위해 정리하는 중','tidy',3,'emptyTray'),walk('home','비서 데스크로 돌아가는 중')];
    this.index=0;this.enterStep();
  }
  tick(dt,{ceoPresent=false,ceoReady=false,ceoPhase='idle',ceoRoom=null,guests=[]}={}){
    const ownerState=ceoPresent?ceoPhase:'away';
    const sameRoom=Boolean(ceoPresent&&ceoRoom&&this.walker.room===ceoRoom);
    if(ownerState!==this.ownerState){
      this.pendingGreeting=ceoPresent&&ceoPhase==='to-lift'?'다녀오세요, 대표님!':ceoPresent&&(ceoPhase==='exiting'||this.ownerState===null&&ceoReady&&sameRoom)?'어서 오세요, 대표님!':null;
      this.ownerState=ownerState;
    }
    // Entry/exit greetings can start when their paths meet in a room, but never
    // continue through a doorway or restart after the same encounter.
    if(!sameRoom)this.greeting=null;
    if(sameRoom&&this.pendingGreeting){this.greet(this.pendingGreeting);this.pendingGreeting=null;}
    const presentGuests=new Set(guests);
    for(const id of this.servedGuests)if(!presentGuests.has(id))this.servedGuests.delete(id);
    this.visitorCooldown=Math.max(0,this.visitorCooldown-dt);
    if(!this.delivered&&(this.job==='tea'&&(!ceoPresent||['to-lift','opening-origin','boarding','closing-origin','riding'].includes(ceoPhase))||this.job==='snacks'&&!guests.length))this.cancelService();
    if(this.greeting){this.greeting.elapsed+=dt;if(this.greeting.elapsed<this.greeting.duration)return;this.greeting=null;}
    if(!this.step){
      this.idleTime-=dt;
      const visitors=this.visitorCooldown===0&&guests.some(id=>!this.servedGuests.has(id));
      if(visitors){this.start('snacks');return;}
      if(this.idleTime>0)return;
      const jobs=['tea','tidy-office','tidy-desk','tidy-reception'];
      let job=jobs[this.jobIndex++%jobs.length];
      if(job==='tea'&&!ceoReady)job='tidy-office';
      this.start(job);return;
    }
    if(this.step.action==='walk'){
      this.walker.tick(dt,1.28);
      if(!this.walker.walking&&!this.walker.blocked)this.next();
      return;
    }
    this.stepTime+=dt;
    if(this.stepTime<this.step.duration)return;
    if(this.step.service){
      this.delivered=true;this.onService(this.step.service);
      if(this.step.service==='snacks'){for(const id of guests)this.servedGuests.add(id);this.visitorCooldown=80;}
    }
    this.next();
  }
}

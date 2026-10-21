export const CEO_ACTION_TEXT={
  review:'팀의 진행 상황을 점검하는 중',
  encourage:'직원들을 격려하는 중',
  coordinate:'업무 흐름과 우선순위를 조율하는 중',
  command:'새 요청을 담당 직원에게 전달하는 중',
  idle:'팀 현황을 살피는 중',
};

// The same leadership rhythm drives both office renderings. Each scene only
// supplies its own staff positions and navigation points.
export class CeoRoutine {
  constructor({firstDelay=8500}={}){
    this.nextAt=performance.now()+firstDelay;this.dwellUntil=0;this.visit=0;
    this.active=false;this.kind='review';this.text=CEO_ACTION_TEXT.idle;
    this.requestTokens=new Map();this.commandUntil=0;this.requestBaseline=Date.now();
  }
  due(time){return !this.active&&time>=this.nextAt;}
  begin(time,activeWorkers=0){
    this.kind=activeWorkers?(this.visit%3===2?'coordinate':'encourage'):(this.visit%3===2?'coordinate':'review');
    this.text=CEO_ACTION_TEXT[this.kind];this.active=true;this.visit++;
    this.dwellUntil=time+5200+(this.visit%3)*1100;
  }
  finish(time){this.active=false;this.text=CEO_ACTION_TEXT.idle;this.nextAt=time+15500+(this.visit%4)*4200;}
  cancel(){this.active=false;this.dwellUntil=0;this.text=CEO_ACTION_TEXT.idle;}
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

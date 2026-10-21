// Pure building state: stable floors, independently delivered calls, one owner.
export class BuildingDirectory {
  constructor(registry = {}) {
    this.registry = { ...registry };
    this.floors = [];
    this.seenRequests = new Map();
    this.initialized = false;
    this.bootTime = Date.now();
    this.latestCommand = null;
  }
  reconcile(projects, sessions, now = Date.now()) {
    let next = Math.max(0, ...Object.values(this.registry).map(Number)) + 1;
    for (const project of [...projects].sort((a,b)=>(a.lastActivityAt||0)-(b.lastActivityAt||0)||a.key.localeCompare(b.key))) {
      if (!this.registry[project.key]) this.registry[project.key] = next++;
    }
    this.floors = projects.map(project => ({ ...project, number: this.registry[project.key],
      active: sessions.filter(session=>session.projectKey===project.key&&session.active).length,
      requests: sessions.filter(session=>session.projectKey===project.key).reduce((count,session)=>count+(session.requestCount||0),0),
    })).sort((a,b)=>b.number-a.number);
    const commands=[];
    for(const session of sessions){
      const token=session.requestId;
      if(!token) continue;
      const previous=this.seenRequests.get(session.id);
      if(this.initialized&&token!==previous&&session.lastRequestAt>=this.bootTime-2000&&this.floors.some(floor=>floor.key===session.projectKey)){
        commands.push({id:token,sessionId:session.id,projectKey:session.projectKey,at:session.lastRequestAt,receivedAt:now});
      }
      this.seenRequests.set(session.id,token);
    }
    commands.sort((a,b)=>a.at-b.at||a.sessionId.localeCompare(b.sessionId));
    if(commands.length)this.latestCommand=commands.at(-1);
    this.initialized=true;
    return commands;
  }
  initialFloor(sessions){
    const known=new Set(this.floors.map(floor=>floor.key));
    return [...sessions].filter(session=>known.has(session.projectKey)).sort((a,b)=>(b.lastRequestAt||0)-(a.lastRequestAt||0)||Number(b.active)-Number(a.active)||b.updatedAt-a.updatedAt)[0]?.projectKey||this.floors[0]?.key||null;
  }
  floor(key){return this.floors.find(floor=>floor.key===key)||null;}
}

export const OWNER_HOME={x:-7.85,z:3.4};
export const ELEVATOR_LOBBY={x:-10.6,z:.2};
export const ELEVATOR_CABIN={x:-13.4,z:.2};

// Travel never postpones remote work. New destinations coalesce while riding.
export class OwnerJourney {
  constructor(){this.floor=null;this.target=null;this.pending=null;this.phase='idle';this.phaseAt=0;this.arrivedAt=0;this.from=null;}
  initialize(floor,now=0){this.floor=floor;this.target=floor;this.phase='idle';this.phaseAt=now;}
  request(floor,now){if(!floor)return;if(!this.floor){this.initialize(floor,now);return;}this.pending=floor;if(['idle','commanding'].includes(this.phase)&&now-this.arrivedAt>=3500)this.start(now);}
  start(now){if(!this.pending)return;const destination=this.pending;this.pending=null;if(destination===this.floor){this.phase='commanding';this.phaseAt=now;return;}this.from=this.floor;this.target=destination;this.phase='to-lift';this.phaseAt=now;}
  advance(event,now){
    const transitions={'to-lift':['at-lobby','opening-origin'],'opening-origin':['doors-open','boarding'],'boarding':['in-cabin','closing-origin'],'closing-origin':['doors-closed','riding'],'riding':['ride-complete','opening-destination'],'opening-destination':['doors-open','exiting'],'exiting':['at-home','commanding']};
    const transition=transitions[this.phase];
    if(transition?.[0]!==event)return false;
    if(this.phase==='riding'){this.floor=this.target;this.arrivedAt=now;}
    this.phase=transition[1];this.phaseAt=now;return true;
  }
  tick(now){
    if(this.phase==='commanding'&&now-this.phaseAt>=3000){this.phase='idle';this.phaseAt=now;}
    if(this.phase==='idle'&&this.pending&&now-this.arrivedAt>=5000)this.start(now);
  }
}

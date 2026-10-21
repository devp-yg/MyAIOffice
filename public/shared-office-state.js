import {createSharedLayout,SHARED_ROOMS} from './shared-office-layout.js';
import {projectHue} from './project-colors.js';

export function sharedRoom(session){
  if(!session.active)return 'desk';
  if(session.room==='research')return 'library';
  if(session.room==='elevator')return 'meeting';
  return SHARED_ROOMS.some(r=>r.key===session.room)?session.room:'desk';
}
export function sharedProjects(snapshot,floors={}){
  const projects=new Map((snapshot.projects||[]).map(p=>[p.key,{...p}]));
  for(const session of snapshot.sessions||[])if(!projects.has(session.projectKey))projects.set(session.projectKey,{key:session.projectKey,name:session.project||'내 작업 공간'});
  return [...projects.values()].map(p=>({...p,code:floors[p.key]?`P-${String(floors[p.key]).padStart(2,'0')}`:`P-${p.key.slice(0,4).toUpperCase()}`,color:`hsl(${projectHue(p.key)} 30% 48%)`,active:(snapshot.sessions||[]).filter(s=>s.projectKey===p.key&&s.active).length})).sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name,'ko')||a.key.localeCompare(b.key));
}
export function displayedSessions(sessions,showResting=true){
  const active=sessions.filter(s=>s.active);
  if(!showResting)return active;
  const restingByProject=new Map();
  for(const session of sessions){
    if(session.active)continue;
    const key=session.projectKey||session.id,previous=restingByProject.get(key);
    if(!previous||session.updatedAt>previous.updatedAt||session.updatedAt===previous.updatedAt&&session.id.localeCompare(previous.id)<0)restingByProject.set(key,session);
  }
  return [...active,...restingByProject.values()];
}

// Assign by session id before any view filtering. Existing workers keep their seats.
export class SharedOfficeOccupancy {
  constructor(){this.previous=new Map();this.demand={};}
  update(sessions,projects,showResting=true){
    const population=displayedSessions(sessions,showResting),counts=Object.fromEntries(SHARED_ROOMS.map(r=>[r.key,0])),teams=new Map();
    for(const session of population){const room=sharedRoom(session);counts[room]++;if(room==='meeting')teams.set(session.projectKey,(teams.get(session.projectKey)||0)+1);}
    const demand={...counts,meeting:[...teams.values()].reduce((n,count)=>n+Math.ceil(count/4)*4,0)};
    for(const key of Object.keys(demand))this.demand[key]=Math.max(this.demand[key]||0,demand[key]);
    let layout=createSharedLayout(this.demand);
    // A team may occupy spare seats in a pod already used on an earlier update.
    const allocate=()=>{
      const assigned=new Map(),occupied=new Set(),podTeams=new Map();
      for(const session of population){const old=this.previous.get(session.id),seat=layout.seats.find(s=>s.id===old?.seatId&&s.room===sharedRoom(session));if(!seat||occupied.has(seat.id))continue;if(seat.room==='meeting'&&podTeams.has(seat.pod)&&podTeams.get(seat.pod)!==session.projectKey)continue;assigned.set(session.id,seat);occupied.add(seat.id);if(seat.room==='meeting')podTeams.set(seat.pod,session.projectKey);}
      for(const session of population){
        if(assigned.has(session.id))continue;
        const room=sharedRoom(session),available=layout.seats.filter(s=>s.room===room&&!occupied.has(s.id));
        const seat=room==='meeting'?(available.find(s=>podTeams.get(s.pod)===session.projectKey)||available.find(s=>!podTeams.has(s.pod))):available[0];
        if(!seat)return null;
        assigned.set(session.id,seat);occupied.add(seat.id);if(room==='meeting')podTeams.set(seat.pod,session.projectKey);
      }
      return assigned;
    };
    let allocated=allocate();
    // Fragmented meeting groups need more tables, never a shared seat or a hidden worker.
    while(!allocated){this.demand.meeting=(this.demand.meeting||12)+12;layout=createSharedLayout(this.demand);allocated=allocate();}
    const projectMap=new Map(projects.map(p=>[p.key,p]));
    const assignments=population.map((session,index)=>({id:session.id,session,seat:allocated.get(session.id),project:projectMap.get(session.projectKey),index:session.identity?.index??index}));
    this.previous=new Map(assignments.map(a=>[a.id,{seatId:a.seat.id}]));
    return {layout,assignments,counts,population};
  }
}

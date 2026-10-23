import {EXECUTIVE_WALLS,EXECUTIVE_DOOR_LEAVES,EXECUTIVE_FURNITURE} from './office-executive.js';
import {CELL_SIZE,OFFICE_BOUNDS} from './office-navigation.js';

// Space study: shared process zones and repeatable furniture pods, in metres.
export const SHARED_BOUNDS={minX:-20,maxX:20,minZ:-12,maxZ:12};
export const ROOM_CORNER_RADIUS=1.35;
export const ZONE_BOUNDARY_STYLES={
  library:{color:'#b79a72',height:1.02,finish:'shelf'},
  studio:{color:'#819474',height:.92,finish:'planter'},
  server:{color:'#829ba6',height:1.48,finish:'glass'},
  meeting:{color:'#9e87ae',height:.95,finish:'fabric'},
  desk:{color:'#96a27a',height:.82,finish:'planter'},
};

// Every solid boundary is also a navigation obstacle; openings are actual gaps.
export function createZoneBoundaries(rooms){
  const walls=[],gates=[];
  for(const room of rooms){
    const [x0,x1,z0,z1]=room.bounds,r=ROOM_CORNER_RADIUS,style=ZONE_BOUNDARY_STYLES[room.key];
    const openings={north:[],south:[],west:[],east:[]};
    const gate=(side,center,width)=>{openings[side].push([center-width/2,center+width/2]);gates.push({room:room.key,side,center,width});};
    if(['library','studio','server'].includes(room.key)){
      gate('south',room.key==='studio'?-2.6:room.key==='library'?-13:14,3.2);
      if(room.key!=='server')gate('east',-5.1,2.8);
      if(room.key!=='library')gate('west',-5.1,2.8);
      // Additional side entrances follow expanded wings.
      for(let z=-14;z>z0+r+1;z-=6.4){if(room.key==='library')gate('east',z,2.8);else gate('west',z,2.8);}
    }else if(room.key==='meeting'){
      gate('north',-14.45,2.6);gate('north',-10.15,2.6);gate('east',8.3,3.4);gate('south',-12.3,3.2);
      for(let z=14;z<z1-r-1;z+=5.6)gate('east',z,2.8);
    }else{
      gate('north',10,3.2);gate('west',5.4,2.8);gate('south',13,3.2);
      for(let z=13;z<z1-r-1;z+=4.8)gate('west',z,2.8);
    }
    const wall=(a,b)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.08)return;walls.push({type:'zone-boundary',room:room.key,x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,w:length,d:.4,bodyDepth:.3,h:style.height,rotation:-Math.atan2(b[1]-a[1],b[0]-a[0]),finish:style.finish,color:style.color});};
    const straight=(side,start,end,fixed,horizontal)=>{
      let cursor=start;
      for(const [a,b]of openings[side].sort((a,b)=>a[0]-b[0])){const lo=Math.max(start,a),hi=Math.min(end,b);if(hi<=cursor||lo>=end)continue;if(lo>cursor)wall(horizontal?[cursor,fixed]:[fixed,cursor],horizontal?[lo,fixed]:[fixed,lo]);cursor=Math.max(cursor,hi);}
      if(cursor<end)wall(horizontal?[cursor,fixed]:[fixed,cursor],horizontal?[end,fixed]:[fixed,end]);
    };
    straight('north',x0+r,x1-r,z0,true);straight('south',x0+r,x1-r,z1,true);straight('west',z0+r,z1-r,x0,false);straight('east',z0+r,z1-r,x1,false);
    for(const [cx,cz,start]of [[x0+r,z0+r,Math.PI],[x1-r,z0+r,-Math.PI/2],[x1-r,z1-r,0],[x0+r,z1-r,Math.PI/2]]){
      for(let i=0;i<8;i++){const a=start+i*Math.PI/16,b=start+(i+1)*Math.PI/16;wall([cx+Math.cos(a)*r,cz+Math.sin(a)*r],[cx+Math.cos(b)*r,cz+Math.sin(b)*r]);}
    }
  }
  return {walls,gates};
}
export const SHARED_ROOMS=[
  {key:'library',name:'자료 탐색',english:'READ & DISCOVER',color:'#eee2c9',bounds:[-19.2,-6.7,-11.2,-1.8],label:[-13,2.1,-10.1],note:'읽기와 검색을 함께',base:6},
  {key:'studio',name:'개발 스튜디오',english:'MAKE & BUILD',color:'#dfe8d9',bounds:[-6.2,8,-11.2,-1.8],label:[.9,2.1,-10.1],note:'여러 프로젝트가 나란히',base:12},
  {key:'server',name:'실행 · 서버',english:'RUN & OPERATE',color:'#dde6ec',bounds:[8.6,19.2,-11.2,-1.8],label:[14,2.7,-10.1],note:'독립된 실행 포드',base:6},
  {key:'meeting',name:'검토 · 회의',english:'THINK TOGETHER',color:'#e9e0ef',bounds:[-19.2,-5.7,3,11.2],label:[-13,2.1,10.4],note:'동시에 모이는 세 팀',base:12},
  {key:'desk',name:'요청 접수 · 휴식',english:'PAUSE & CONNECT',color:'#e4eadf',bounds:[6.8,19.2,2.8,11.2],label:[13,2.1,10.4],note:'작은 라운지가 이어지는 공간',base:6},
];
export const PREVIEW_PROJECTS=[
  {key:'office',name:'오피스',code:'P-01',color:'#b97d5b'},
  {key:'web',name:'웹사이트',code:'P-02',color:'#578b9e'},
  {key:'app',name:'앱',code:'P-03',color:'#937aac'},
  {key:'research',name:'리서치',code:'P-04',color:'#9c904b'},
];
export const SCENARIOS={
  calm:{name:'여유롭게',counts:{library:2,studio:4,server:2,meeting:4,desk:0}},
  together:{name:'여러 프로젝트',counts:{library:4,studio:8,server:3,meeting:6,desk:3}},
  full:{name:'기준 배치',counts:{library:6,studio:12,server:6,meeting:12,desk:6}},
  busy:{name:'포드 확장',counts:{library:10,studio:20,server:10,meeting:12,desk:8}},
};

export function createSharedLayout(scenario='full'){
  const demand=typeof scenario==='object'?scenario:{},expanded=scenario==='busy',furniture=[],seats=[],pods=[];
  const bounds={...SHARED_BOUNDS},rooms=SHARED_ROOMS.map(r=>({...r,bounds:[...r.bounds]}));
  const extend=(key,z0,z1)=>{const room=rooms.find(r=>r.key===key);room.bounds[2]=Math.min(room.bounds[2],z0);room.bounds[3]=Math.max(room.bounds[3],z1);bounds.minZ=Math.min(bounds.minZ,Math.floor((z0-.8)/.4)*.4);bounds.maxZ=Math.max(bounds.maxZ,Math.ceil((z1+.8)/.4)*.4);};
  const add=(type,room,x,z,w,d,h=.85,rotation=0)=>{const item={type,room,x,z,w,d,h,rotation};furniture.push(item);return item;};
  const seat=(room,pod,x,z,heading,mode)=>{
    // Chairs are destinations. Their seats may be entered; tables and racks block paths.
    add('chair',room,x,z,.65,.65,.95,heading);
    seats.push({id:`${pod}-${seats.filter(s=>s.pod===pod).length}`,room,pod,x,z,heading,mode});
  };
  const pod=(id,room,x,z,extra=false)=>{pods.push({id,room,x,z,extra});return id;};
  function reading(id,x,z,extra=false){
    pod(id,'library',x,z,extra);add('reading-table','library',x,z,2.6,1.3);
    for(const side of [-1,1])seat('library',id,x,z+side*1.35,side<0?0:Math.PI,'book');
  }
  [-17,-13,-9].forEach((x,i)=>reading(`read-${i}`,x,-7.3));
  if(expanded||demand.library>6)[-15.7,-10.4].forEach((x,i)=>reading(`read-extra-${i}`,x,-3.8,true));
  for(let row=0;row<Math.ceil(((demand.library||0)-10)/6);row++){const z=-14.6-row*4.8;[-17,-13,-9].forEach((x,i)=>reading(`read-wing-${row}-${i}`,x,z,true));extend('library',z-2.1,-11.2);}
  [-17,-13,-9].forEach(x=>add('bookshelf','library',x,-10.6,2.4,.5,1.75));

  function island(id,x,z,extra=false){
    pod(id,'studio',x,z,extra);
    for(const dx of [-.82,.82])for(const side of [-1,1]){
      add('computer-desk','studio',x+dx,z+side*.43,1.48,.78,.85,side<0?Math.PI:0);
      seat('studio',id,x+dx,z+side*1.5,side<0?0:Math.PI,'laptop');
    }
  }
  [-3.8,.7,5.2].forEach((x,i)=>island(`make-${i}`,x,-7.7));
  if(expanded||demand.studio>12)[-1.9,3].forEach((x,i)=>island(`make-extra-${i}`,x,-3.9,true));
  for(let row=0;row<Math.ceil(((demand.studio||0)-20)/12);row++){const z=-14.8-row*4.8;[-3.8,.7,5.2].forEach((x,i)=>island(`make-wing-${row}-${i}`,x,z,true));extend('studio',z-2.2,-11.2);}
  [-4.5,1,6.5].forEach(x=>add('cabinet','studio',x,-10.6,1.8,.45,1.05));

  const consoleXs=expanded||demand.server>6?[10,13.5,17,11.75,15.25]:[10,13.5,17];
  consoleXs.forEach((x,i)=>{
    const id=pod(`run-${i}`,'server',x,-6.1,i>=3);
    for(const z of [-8.2,-4.5]){
      add('computer-desk','server',x,z,1.4,1,.9);
      seat('server',id,x,z+1.25,Math.PI,'laptop');
    }
  });
  [10.8,13.8,16.8].forEach(x=>add('rack','server',x,-10.65,1.5,.75,2.05));
  for(let row=0;row<Math.ceil(((demand.server||0)-10)/6);row++){
    const z=-16.3-row*6.4;
    [10,13.5,17].forEach((x,i)=>{const id=pod(`run-wing-${row}-${i}`,'server',x,z,true);for(const dz of [-1.7,1.7]){add('computer-desk','server',x,z+dz,1.4,1,.9);seat('server',id,x,z+dz+1.25,Math.PI,'laptop');}});extend('server',z-2.5,-11.2);
  }

  function meeting(id,x,z,extra=false){pod(id,'meeting',x,z,extra);add('meeting-table','meeting',x,z,2.75,1.4,.88);for(const dx of [-.75,.75])for(const side of [-1,1])seat('meeting',id,x+dx,z+side*1.35,side<0?0:Math.PI,'clipboard');add('whiteboard','meeting',x,z-3,2.35,.22,2.25);}
  [-16.6,-12.3,-8].forEach((x,i)=>meeting(`meet-${i}`,x,6.7));
  for(let row=0;row<Math.ceil(((demand.meeting||0)-12)/12);row++){const z=13.2+row*5.6;[-16.6,-12.3,-8].forEach((x,i)=>meeting(`meet-wing-${row}-${i}`,x,z,true));extend('meeting',3,z+2.2);}
  for(const x of [-14.45,-10.15])add('partition','meeting',x,6.65,.16,2.3,1.18);

  function lounge(id,x,z,extra=false){
    pod(id,'desk',x,z,extra);add('sofa','desk',x,z,2.8,1.15,.95);
    add('coffee-table','desk',x,z+1.55,1.8,.75,.48);
    // Lounge positions sit between the sofa and low table.
    for(const dx of [-.6,.6])seats.push({id:`${id}-${dx<0?0:1}`,room:'desk',pod:id,x:x+dx,z:z+1.3,heading:0,mode:'cup'});
  }
  [9,13,17].forEach((x,i)=>lounge(`pause-${i}`,x,7.6));
  if(expanded||demand.desk>6)lounge('pause-extra',13,4,true);
  for(let row=0;row<Math.ceil(((demand.desk||0)-8)/6);row++){const z=12.5+row*4.8;[9,13,17].forEach((x,i)=>lounge(`pause-wing-${row}-${i}`,x,z,true));extend('desk',2.8,z+3.1);}
  add('cabinet','desk',18.3,4.1,1.1,.6,1.1);
  for(const [x,z,room]of [[-18.3,-2.8,'library'],[-7.1,-10.2,'library'],[7.3,-10.2,'studio'],[18.5,-2.7,'server'],[-18.3,10.3,'meeting'],[-6.9,9.9,'meeting'],[18.5,10.4,'desk'],[7.7,3.5,'desk']])add('plant',room,x,z,.62,.62,1.4);
  const workSpots=Object.fromEntries(SHARED_ROOMS.map(r=>[r.key,seats.filter(s=>s.room===r.key).map(s=>[s.x,s.z])]));
  const boundaries=createZoneBoundaries(rooms);
  // Reuse the tower's complete interior at its original scale. Its west entrance
  // faces the shared office after a half turn; the elevator stays in the tower.
  // The courtyard faces the CEO entrance and the lounge. Expansion moves the
  // entire courtyard beyond BOTH shared wings, keeping their circulation clear.
  const edgeInset=.8,meetingEnd=rooms.find(r=>r.key==='meeting').bounds[3],loungeEnd=rooms.find(r=>r.key==='desk').bounds[3];
  const courtyardStart=Math.max(meetingEnd,loungeEnd)+3;
  bounds.maxZ=Math.ceil((courtyardStart+14+edgeInset)/.4)*.4;
  // After the half turn, preserve the tower navigator's grid centers in the
  // shared grid. A half-cell offset otherwise strands the secretary behind
  // her desk and disconnects the lounge despite their open passages.
  const alignSuite=(value,localMin,sharedMin)=>{
    const phase=localMin+sharedMin+CELL_SIZE;
    return phase+Math.ceil((value-phase)/CELL_SIZE-1e-8)*CELL_SIZE;
  };
  const executive={x:alignSuite(bounds.minX+edgeInset+7.8,OFFICE_BOUNDS.minX,bounds.minX),z:alignSuite(courtyardStart+7,OFFICE_BOUNDS.minZ,bounds.minZ),rotation:Math.PI};
  executive.bounds=[executive.x-7.8,executive.x+12,executive.z-7,executive.z+7];
  const park={bounds:[4.4,18.4,courtyardStart+.2,courtyardStart+13.4],
    beds:[[5,15,courtyardStart+2.9,courtyardStart+5.7],[5,15,courtyardStart+8.4,courtyardStart+11.1]],
    label:{x:10,z:courtyardStart+7},
    trees:[[6.5,courtyardStart+4.1,.9],[13.2,courtyardStart+4.2,1.05],[7,courtyardStart+9.8,1],[13.2,courtyardStart+9.7,.85]],
    benches:[[9.6,courtyardStart+5.2,Math.PI],[10.4,courtyardStart+8.9,0]]};
  const paths=[],spineX=2.7,promenadeZ=courtyardStart-1.5;
  const path=(id,a,b,width=2.2)=>{
    paths.push({id,bounds:[Math.min(a[0],b[0])-width/2,Math.max(a[0],b[0])+width/2,Math.min(a[1],b[1])-width/2,Math.max(a[1],b[1])+width/2]});
  };
  path('main-concourse',[-17.8,0],[bounds.maxX+1.4,0],2.4);
  path('central-promenade',[spineX,0],[spineX,courtyardStart+12.4]);
  path('courtyard-forecourt',[-12.3,promenadeZ],[17.2,promenadeZ],2.2);
  path('meeting-forecourt',[-12.3,meetingEnd],[-12.3,promenadeZ]);
  path('lounge-forecourt',[13,loungeEnd],[13,promenadeZ]);
  for(const gate of boundaries.gates){
    const room=rooms.find(r=>r.key===gate.room),[x0,x1,z0,z1]=room.bounds;
    if(gate.side==='south'&&['library','studio','server'].includes(gate.room))path(`${gate.room}-entry`,[gate.center,z1],[gate.center,0]);
    if(gate.side==='north'&&['meeting','desk'].includes(gate.room))path(`${gate.room}-entry-${gate.center}`,[gate.center,0],[gate.center,z0],2);
    if(gate.side==='east'&&gate.room==='meeting')path(`meeting-link-${gate.center}`,[x1,gate.center],[spineX,gate.center],2);
    if(gate.side==='west'&&gate.room==='desk')path(`lounge-link-${gate.center}`,[spineX,gate.center],[x0,gate.center],2);
    // Short bridges join adjacent northern doorways without painting a path
    // through either room. These are only used when one is the destination.
    if(gate.side==='east'&&['library','studio'].includes(gate.room))path(`${gate.room}-door-${gate.center}`,[x1-.2,gate.center],[x1+.9,gate.center],1.8);
  }
  path('ceo-entry',[executive.bounds[1]-.3,executive.z],[17.2,executive.z]);
  path('garden-north',[spineX,courtyardStart+1.3],[17.2,courtyardStart+1.3]);
  path('garden-arrival',[13,promenadeZ],[13,courtyardStart+1.3]);
  path('garden-east',[17.2,courtyardStart+1.3],[17.2,courtyardStart+12.4]);
  path('garden-south',[spineX,courtyardStart+12.4],[17.2,courtyardStart+12.4]);
  const circulation={paths,hub:{x:spineX,z:0},gardenVisit:{x:spineX,z:executive.z}};
  const contains=(point,rect,inset=0)=>point.x>=rect[0]+inset&&point.x<=rect[1]-inset&&point.z>=rect[2]+inset&&point.z<=rect[3]-inset;
  const regionAt=point=>rooms.find(room=>contains(point,room.bounds))?.key||(contains(point,executive.bounds)?'executive':null);
  const executiveBlockers=[...EXECUTIVE_WALLS.filter(w=>!w.elevator),...EXECUTIVE_DOOR_LEAVES,...EXECUTIVE_FURNITURE].map(item=>({...item,room:null,x:executive.x-item.x,z:executive.z-item.z,rotation:(item.rotation||0)+Math.PI}));
  const navigationBounds={...bounds,maxX:bounds.maxX+2.4};
  return {bounds,navigationBounds,rooms,workSpots,furniture,seats,pods,boundaries,executive,park,circulation,regionAt,
    blockers:[...furniture.filter(item=>item.type!=='chair'),...boundaries.walls,...executiveBlockers],
    isWalkable:({x,z},margin)=>{
      const point={x,z};
      if(park.beds.some(bed=>contains(point,bed,-margin)))return false;
      return Boolean(regionAt(point))||paths.some(path=>contains(point,path.bounds,margin));
    },
  };
}

export function createPreviewAssignments(layout,scenario='full'){
  const counts=SCENARIOS[scenario].counts,result=[];
  for(const room of SHARED_ROOMS){
    layout.seats.filter(s=>s.room===room.key).slice(0,counts[room.key]).forEach((seat,index)=>{
      // Only collaboration groups share a project per pod; work desks mix projects.
      const project=PREVIEW_PROJECTS[room.key==='meeting'?Math.floor(index/4)%3:index%4];
      result.push({id:`sample-${seat.id}`,seat,project,index:result.length});
    });
  }
  return result;
}

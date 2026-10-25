import {EXECUTIVE_WALLS,EXECUTIVE_DOOR_LEAVES,EXECUTIVE_FURNITURE} from './office-executive.js';
import {CELL_SIZE,OFFICE_BOUNDS} from './office-navigation.js';

// Space study: shared process zones and repeatable furniture pods, in metres.
export const SHARED_BOUNDS={minX:-28,maxX:28,minZ:-18,maxZ:18};
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
const ROOM_OFFSETS={library:[-6.4,-4.8],studio:[0,-4.8],server:[6.4,-4.8],meeting:[-6.4,3.2],desk:[6.4,3.2]};
const LOCAL_ROOMS=[
  {key:'library',name:'자료 탐색',english:'READ & DISCOVER',color:'#eee2c9',bounds:[-19.2,-6.7,-11.2,-1.8],label:[-13,2.1,-10.1],note:'읽기와 검색을 함께',base:6},
  {key:'studio',name:'개발 스튜디오',english:'MAKE & BUILD',color:'#dfe8d9',bounds:[-6.2,8,-11.2,-1.8],label:[.9,2.1,-10.1],note:'여러 프로젝트가 나란히',base:12},
  {key:'server',name:'실행 · 서버',english:'RUN & OPERATE',color:'#dde6ec',bounds:[8.6,19.2,-11.2,-1.8],label:[14,2.7,-10.1],note:'독립된 실행 포드',base:6},
  {key:'meeting',name:'검토 · 회의',english:'THINK TOGETHER',color:'#e9e0ef',bounds:[-19.2,-5.7,3,11.2],label:[-13,2.1,10.4],note:'동시에 모이는 세 팀',base:12},
  {key:'desk',name:'요청 접수 · 휴식',english:'PAUSE & CONNECT',color:'#e4eadf',bounds:[6.8,19.2,2.8,11.2],label:[13,2.1,10.4],note:'작은 라운지가 이어지는 공간',base:6},
];
// Move complete rooms, including their labels and furnishings, to create gardens
// between the original pods without changing their internal working clearances.
export const SHARED_ROOMS=LOCAL_ROOMS.map(room=>{
  const [dx,dz]=ROOM_OFFSETS[room.key];
  return {...room,bounds:room.bounds.map((v,i)=>v+(i<2?dx:dz)),label:[room.label[0]+dx,room.label[1],room.label[2]+dz]};
});
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
  const bounds={...SHARED_BOUNDS},rooms=LOCAL_ROOMS.map(r=>({...r,bounds:[...r.bounds]}));
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
    add('coffee-table','desk',x,z+2.35,1.8,.75,.48);
    // Lounge positions sit between the sofa and low table.
    for(const dx of [-.6,.6])seats.push({id:`${id}-${dx<0?0:1}`,room:'desk',pod:id,x:x+dx,z:z+1.3,heading:0,mode:'cup'});
  }
  [9,13,17].forEach((x,i)=>lounge(`pause-${i}`,x,7.6));
  if(expanded||demand.desk>6)lounge('pause-extra',13,4,true);
  for(let row=0;row<Math.ceil(((demand.desk||0)-8)/6);row++){const z=12.5+row*4.8;[9,13,17].forEach((x,i)=>lounge(`pause-wing-${row}-${i}`,x,z,true));extend('desk',2.8,z+3.1);}
  add('cabinet','desk',18.3,4.1,1.1,.6,1.1);
  for(const [x,z,room]of [[-18.3,-2.8,'library'],[-7.1,-10.2,'library'],[7.3,-10.2,'studio'],[18.5,-2.7,'server'],[-18.3,10.3,'meeting'],[-6.9,9.9,'meeting'],[18.5,10.4,'desk'],[7.7,3.5,'desk']])add('plant',room,x,z,.62,.62,1.4);
  const boundaries=createZoneBoundaries(rooms);
  for(const room of rooms){
    const [dx,dz]=ROOM_OFFSETS[room.key];
    room.bounds=room.bounds.map((v,i)=>v+(i<2?dx:dz));
    room.label=[room.label[0]+dx,room.label[1],room.label[2]+dz];
    for(const item of [...furniture,...seats,...pods,...boundaries.walls].filter(item=>item.room===room.key)){item.x+=dx;item.z+=dz;}
    for(const gate of boundaries.gates.filter(gate=>gate.room===room.key))gate.center+=['north','south'].includes(gate.side)?dx:dz;
    bounds.minZ=Math.min(bounds.minZ,Math.floor((room.bounds[2]-2)/CELL_SIZE)*CELL_SIZE);
  }
  const workSpots=Object.fromEntries(SHARED_ROOMS.map(r=>[r.key,seats.filter(s=>s.room===r.key).map(s=>[s.x,s.z])]));
  // Reuse the tower's complete interior at its original scale. Its west entrance
  // faces the shared office after a half turn; the elevator stays in the tower.
  // The courtyard faces the CEO entrance and the lounge. Expansion moves the
  // entire courtyard beyond BOTH shared wings, keeping their circulation clear.
  const edgeInset=.8,meetingEnd=rooms.find(r=>r.key==='meeting').bounds[3],loungeEnd=rooms.find(r=>r.key==='desk').bounds[3];
  const courtyardStart=Math.max(meetingEnd,loungeEnd)+6.4;
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
  const park={bounds:[6.4,26.4,courtyardStart+.2,courtyardStart+13.4],
    beds:[[7.4,22.2,courtyardStart+2.9,courtyardStart+5.7],[7.4,22.2,courtyardStart+8.4,courtyardStart+11.1]],
    label:{x:16,z:courtyardStart+7},
    trees:[[9,courtyardStart+4.1,.9],[20,courtyardStart+4.2,1.05],[10,courtyardStart+9.8,1],[20,courtyardStart+9.7,.85]],
    benches:[]};
  const landscape={beds:[],trees:[],benches:[]};

  // Keep the public promenade outside the private wing's 2 m buffer, with
  // enough room for a complete character footprint on the navigation grid.
  const paths=[],spineX=4,promenadeZ=courtyardStart-1.5;
  const path=(id,a,b,width=3.2)=>{
    paths.push({id,bounds:[Math.min(a[0],b[0])-width/2,Math.max(a[0],b[0])+width/2,Math.min(a[1],b[1])-width/2,Math.max(a[1],b[1])+width/2]});
  };
  path('main-concourse',[-26,0],[bounds.maxX+1.4,0],4.4);
  path('central-promenade',[spineX,0],[spineX,courtyardStart+12.4]);
  path('courtyard-forecourt',[-23,promenadeZ],[24.4,promenadeZ],3.2);
  path('meeting-forecourt',[-18.7,meetingEnd],[-18.7,promenadeZ]);
  path('lounge-forecourt',[19.4,loungeEnd],[19.4,promenadeZ]);
  for(const gate of boundaries.gates){
    const room=rooms.find(r=>r.key===gate.room),[x0,x1,z0,z1]=room.bounds;
    if(gate.side==='south'&&['library','studio','server'].includes(gate.room))path(`${gate.room}-entry`,[gate.center,z1],[gate.center,0]);
    if(gate.side==='north'&&['meeting','desk'].includes(gate.room))path(`${gate.room}-entry-${gate.center}`,[gate.center,0],[gate.center,z0],3.2);
    if(gate.side==='east'&&gate.room==='meeting')path(`meeting-link-${gate.center}`,[x1,gate.center],[spineX,gate.center],3.2);
    if(gate.side==='west'&&gate.room==='desk')path(`lounge-link-${gate.center}`,[spineX,gate.center],[x0,gate.center],3.2);
    // Both side doors connect to a continuous planted street between rooms.
    if(['library','studio','server'].includes(gate.room)&&['west','east'].includes(gate.side)){
      const lane=gate.room==='library'||gate.room==='studio'&&gate.side==='west'?-9.6:11.6;
      path(`${gate.room}-${gate.side}-${gate.center}`,[gate.side==='west'?x0:x1,gate.center],[lane,gate.center],3.2);
    }
  }
  for(const [id,x,keys]of [['west',-9.6,['library','studio']],['east',11.6,['studio','server']]]){
    const north=Math.min(...rooms.filter(r=>keys.includes(r.key)).map(r=>r.bounds[2]))+2;
    path(`${id}-garden-street`,[x,0],[x,north],3.2);
    for(let z=-5;z>north;z-=7.2){
      if(boundaries.gates.some(gate=>keys.includes(gate.room)&&['east','west'].includes(gate.side)&&Math.abs(gate.center-z)<3.4))continue;
      landscape.beds.push([x+2,x+3.1,z-1.6,z+1.6]);
      landscape.trees.push([x+2.55,z,.72]);
    }
  }
  path('ceo-entry',[executive.bounds[1]-.3,executive.z],[24.4,executive.z]);
  path('garden-north',[spineX,courtyardStart+1.3],[24.4,courtyardStart+1.3]);
  path('garden-arrival',[19.4,promenadeZ],[19.4,courtyardStart+1.3]);
  path('garden-east',[24.4,courtyardStart+1.3],[24.4,courtyardStart+12.4]);
  path('garden-south',[spineX,courtyardStart+12.4],[24.4,courtyardStart+12.4]);
  // Rest bays branch off the clear walking lanes. The approach remains a real
  // walkable destination; the solid seat/backrest are navigation obstacles.
  const rest=(id,x,z,rotation=0)=>{
    const bench={id,type:'garden-bench',x,z,w:2.8,d:.8,h:1.12,rotation};
    const approach={x:x+Math.sin(rotation)*1.25,z:z+Math.cos(rotation)*1.25};
    landscape.benches.push({...bench,approach});
    const horizontal=Math.abs(Math.cos(rotation))>.5;
    paths.push({id:`rest-${id}`,bounds:horizontal?
      [x-1.9,x+1.9,Math.min(z,approach.z+Math.min(0,Math.cos(rotation))*1.3),Math.max(z,approach.z+Math.max(0,Math.cos(rotation))*1.3)]:
      [Math.min(x,approach.x+Math.min(0,Math.sin(rotation))*1.3),Math.max(x,approach.x+Math.max(0,Math.sin(rotation))*1.3),z-1.9,z+1.9]});
  };
  for(const [i,x]of [-24,-9.6,-2.4,19.4,26].entries()){
    rest(`concourse-${i}`,x,3.8,Math.PI);
    path(`rest-link-${i}`,[x,0],[x,2.7],3.6);
    if(i<4){landscape.beds.push([x+1.9,x+3.4,3,5.1]);landscape.trees.push([x+2.65,4.1,.7]);}
  }
  // Repeated rest stops also follow the expanding wings and courtyard route.
  for(let z=7;z<courtyardStart-2;z+=7.2){
    rest(`promenade-${z}`,7.3,z,Math.PI*1.5);
    path(`promenade-rest-${z}`,[spineX,z],[6.1,z],3.6);
    landscape.beds.push([8.4,10.5,z-1.8,z+1.8]);landscape.trees.push([9.4,z,.85]);
    landscape.beds.push([-.8,1.5,z-1.6,z+1.6]);
  }
  rest('garden-north',14,courtyardStart+3.3,Math.PI);
  rest('garden-south',15,courtyardStart+10.5);
  const restStops=landscape.benches.map(bench=>({id:bench.id,...bench.approach,heading:bench.rotation,bench}));
  const landscapeBlockers=[...landscape.benches,...landscape.beds.map(([x0,x1,z0,z1])=>({type:'garden-bed',x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,h:.3}))];
  const circulation={paths,hub:{x:spineX,z:0},gardenVisit:{x:spineX,z:executive.z},restStops};
  const contains=(point,rect,inset=0)=>point.x>=rect[0]+inset&&point.x<=rect[1]-inset&&point.z>=rect[2]+inset&&point.z<=rect[3]-inset;
  const regionAt=point=>rooms.find(room=>contains(point,room.bounds))?.key||(contains(point,executive.bounds)?'executive':null);
  const executiveBlockers=[...EXECUTIVE_WALLS.filter(w=>!w.elevator),...EXECUTIVE_DOOR_LEAVES,...EXECUTIVE_FURNITURE].map(item=>({...item,room:null,x:executive.x-item.x,z:executive.z-item.z,rotation:(item.rotation||0)+Math.PI}));
  const navigationBounds={...bounds,maxX:bounds.maxX+2.4};
  return {bounds,navigationBounds,rooms,workSpots,furniture,seats,pods,boundaries,executive,park,landscape,circulation,regionAt,
    blockers:[...furniture.filter(item=>item.type!=='chair'),...boundaries.walls,...executiveBlockers,...landscapeBlockers],
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

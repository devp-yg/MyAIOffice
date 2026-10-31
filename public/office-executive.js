// One architectural model is used by both the renderer and the route planner.
// West is the visitor entrance; the entire private wing is reached through the CEO office.
export const EXECUTIVE_BOUNDS = { minX:-14.8, maxX:7.8, minZ:-7, maxZ:7 };
// Include every room and the private gallery, but exclude the elevator lobby.
export function isInsideExecutiveSuite({x,z}){return x>=-12&&x<=EXECUTIVE_BOUNDS.maxX&&z>=EXECUTIVE_BOUNDS.minZ&&z<=EXECUTIVE_BOUNDS.maxZ;}
export const EXECUTIVE_ROOM_LAYOUT = [
  {key:'studio',x:-8.9,z:-.1,bounds:[-12,-5.8,-1.8,1.6],color:'#e8e4da',label:[-9.0,1.8,.85]},
  {key:'reception',x:-8.9,z:-4.4,bounds:[-12,-5.8,-7,-1.8],color:'#e4d7c5',label:[-9.25,1.8,-5.8]},
  {key:'meeting',x:-5.2,z:4.3,bounds:[-12,1.6,1.6,7],color:'#d8c4a8',label:[-5.3,1.6,6.35]},
  {key:'desk',x:-2.1,z:-1,bounds:[-5.8,1.6,-3.6,1.6],color:'#d4bfa1',label:[-2.4,1.8,-.9]},
  {key:'library',x:-2.1,z:-5.3,bounds:[-5.8,1.6,-7,-3.6],color:'#cdb79b',label:[-2.4,2.2,-6.35]},
  {key:'research',x:4.7,z:-3.9,bounds:[1.6,7.8,-7,-.8],color:'#dedcce',label:[4.7,1.8,-5.4]},
  {key:'server',x:5.7,z:4.6,bounds:[3.6,7.8,2.2,7],color:'#b6c0b7',label:[5.8,2.1,6.15]},
];
export const EXECUTIVE_GALLERY_REGIONS = [[1.6,7.8,-.8,2.2],[1.6,3.6,2.2,7]];
export const SECRETARY_STATION = {x:-7.4,z:.15,rotation:-Math.PI/2};

// Every opening belongs to an exact wall run. There are no detached door frames.
export const EXECUTIVE_DOORS = [
  {id:'lobby-reception',axis:'x',x:-10.35,z:-1.8,w:1.7,kind:'public'},
  {id:'lobby-boardroom',axis:'x',x:-10.35,z:1.6,w:1.8,kind:'public'},
  {id:'reception-office',axis:'z',x:-5.8,z:-2.7,w:1.55,kind:'office'},
  {id:'boardroom-office',axis:'x',x:-.25,z:1.6,w:1.7,kind:'office'},
  {id:'office-library',axis:'x',x:-3.4,z:-3.6,w:1.6,kind:'private'},
  {id:'office-gallery',axis:'z',x:1.6,z:.6,w:1.6,kind:'private'},
  {id:'library-lounge',axis:'z',x:1.6,z:-5.3,w:1.6,kind:'private'},
  {id:'gallery-lounge',axis:'x',x:3.5,z:-.8,w:1.65,kind:'private'},
  {id:'gallery-vault',axis:'z',x:3.6,z:4.2,w:1.6,kind:'secure'},
];
export const EXECUTIVE_DOOR_LEAVES=EXECUTIVE_DOORS.map(door=>({
  type:'door-leaf',room:null,doorId:door.id,
  x:door.axis==='x'?door.x-door.w/2+.06:door.x+door.w/2,
  z:door.axis==='x'?door.z+door.w/2:door.z-door.w/2+.06,
  w:door.axis==='x'?.09:door.w-.1,d:door.axis==='x'?door.w-.1:.09,h:2.2,
}));
const walls=[];
function run(axis,at,from,to,ids=[],options={}){
  let start=from;
  const openings=ids.map(id=>EXECUTIVE_DOORS.find(door=>door.id===id)).sort((a,b)=>a[axis]-b[axis]);
  const segment=(a,b)=>{
    if(b-a<.01)return;
    walls.push({x:axis==='x'?(a+b)/2:at,z:axis==='z'?(a+b)/2:at,w:axis==='x'?b-a:.18,d:axis==='z'?b-a:.18,h:2.6,axis,...options});
  };
  for(const door of openings){segment(start,door[axis]-door.w/2);start=door[axis]+door.w/2;}
  segment(start,to);
}
run('x',-7,-12,7.8,[],{outer:true,displayHeight:2.6});
run('x',7,-12,7.8,[],{outer:true,displayHeight:.65});
run('z',-12,-7,-1.35,[],{outer:true,displayHeight:2.6});
run('z',-12,1.35,7,[],{outer:true,displayHeight:1.1});
run('z',7.8,-7,7,[],{outer:true,displayHeight:.8});
// This continuous wall is the secretary's backdrop and the public/private boundary.
run('z',-5.8,-7,1.6,['reception-office'],{displayHeight:2.05,feature:true});
run('x',-1.8,-12,-5.8,['lobby-reception'],{displayHeight:1.25});
run('x',1.6,-12,1.6,['lobby-boardroom','boardroom-office'],{displayHeight:1.05});
run('x',-3.6,-5.8,1.6,['office-library'],{displayHeight:1.35});
run('z',1.6,-7,7,['library-lounge','office-gallery'],{displayHeight:1.2});
run('x',-.8,1.6,7.8,['gallery-lounge'],{displayHeight:1.3});
run('x',2.2,3.6,7.8,[],{displayHeight:1.5,secure:true});
run('z',3.6,2.2,7,['gallery-vault'],{displayHeight:1.35,secure:true});
// The elevator cabin is rendered by OfficeOwner, but participates in navigation here.
walls.push({x:-14.7,z:0,w:.15,d:2.8,h:2.4,elevator:true},...[-1.35,1.35].map(z=>({x:-13.35,z,w:2.7,d:.15,h:2.4,elevator:true})));
export const EXECUTIVE_WALLS=walls;

// w/d are LOCAL dimensions; the renderer and collision planner apply rotation once.
export const EXECUTIVE_FURNITURE = [
  // Keep a walkable passage around the north end for the secretary's rounds.
  {type:'executive-desk',room:'studio',x:-8.4,z:.4,w:1.8,d:.95,h:.88,rotation:-Math.PI/2},
  {type:'sideboard',room:'studio',x:-6.45,z:1.1,w:.8,d:.34,h:.9},
  {type:'plant',room:'studio',x:-6.55,z:-.95,w:.58,d:.58,h:1.4},
  {type:'sofa',room:'reception',x:-8.8,z:-5.85,w:3.0,d:.95,h:.95},
  {type:'sofa',room:'reception',x:-10.6,z:-4.65,w:2.25,d:.95,h:.95,rotation:Math.PI/2},
  {type:'coffee-table',room:'reception',x:-8.65,z:-4.35,w:1.7,d:.95,h:.43},
  {type:'armchair',room:'reception',x:-6.9,z:-4.35,w:.85,d:.85,h:1.0,rotation:-Math.PI/2},
  {type:'sideboard',room:'reception',x:-6.9,z:-6.5,w:1.55,d:.38,h:.85},
  {type:'plant',room:'reception',x:-11.15,z:-6.25,w:.58,d:.58,h:1.4},
  {type:'meeting-table',room:'meeting',x:-5.2,z:4.65,w:8.3,d:1.65,h:.82},
  ...[-8.6,-7.25,-5.9,-4.55,-3.2,-1.85].flatMap(x=>[3.42,5.88].map(z=>({type:'chair',room:'meeting',x,z,w:.65,d:.7,h:1.05,rotation:z<4.6?0:Math.PI}))),
  ...[-10.02,-.38].map(x=>({type:'chair',room:'meeting',x,z:4.65,w:.72,d:.72,h:1.12,rotation:x< -5?Math.PI/2:-Math.PI/2})),
  {type:'screen',room:'meeting',x:.98,z:4.65,w:2.5,d:.18,h:2.1,rotation:-Math.PI/2},
  {type:'plant',room:'meeting',x:-11.15,z:6.2,w:.6,d:.6,h:1.45},
  {type:'executive-desk',room:'desk',x:-.85,z:-1.6,w:2.6,d:1.1,h:.87,rotation:-Math.PI/2},
  {type:'chair',room:'desk',x:.55,z:-1.6,w:.8,d:.8,h:1.15,rotation:-Math.PI/2},
  {type:'sofa',room:'desk',x:-3.9,z:1.15,w:2.3,d:.88,h:.95,rotation:Math.PI},
  {type:'coffee-table',room:'desk',x:-3.9,z:-.05,w:1.25,d:.68,h:.4},
  {type:'sideboard',room:'desk',x:-2.0,z:-3.2,w:1.1,d:.36,h:1.0},
  {type:'plant',room:'desk',x:.8,z:-2.9,w:.55,d:.55,h:1.45},
  ...[-4.5,-2.75,-1.0,.65].map(x=>({type:'bookshelf',room:'library',x,z:-6.68,w:1.5,d:.4,h:2.15})),
  {type:'reading-table',room:'library',x:-4.65,z:-5.1,w:1.55,d:.85,h:.76,rotation:Math.PI/2},
  {type:'chair',room:'library',x:-3.55,z:-5.15,w:.65,d:.65,h:1.0,rotation:-Math.PI/2},
  {type:'armchair',room:'library',x:-.65,z:-5.1,w:.9,d:.9,h:1.0,rotation:Math.PI/2},
  {type:'lamp',room:'library',x:.8,z:-6.0,w:.4,d:.4,h:1.9},
  {type:'sofa',room:'research',x:4.8,z:-5.95,w:3.65,d:1.02,h:1.0},
  {type:'sofa',room:'research',x:6.45,z:-4.55,w:2.6,d:1.02,h:1.0,rotation:-Math.PI/2},
  {type:'coffee-table',room:'research',x:4.25,z:-4.5,w:1.8,d:1.0,h:.42},
  {type:'armchair',room:'research',x:3.3,z:-2.7,w:.95,d:.95,h:1.0,rotation:Math.PI},
  {type:'tea-bar',room:'research',x:6.35,z:-1.4,w:1.9,d:.5,h:.91},
  {type:'plant',room:'research',x:2.35,z:-6.55,w:.65,d:.65,h:1.6},
  {type:'vault',room:'server',x:7.15,z:5.15,w:2.35,d:.68,h:1.95,rotation:-Math.PI/2},
  {type:'sideboard',room:'server',x:5.65,z:2.85,w:2.5,d:.55,h:1.25},
  {type:'reading-table',room:'server',x:5.35,z:6.1,w:1.5,d:.7,h:.78},
  {type:'plant',room:null,x:7.05,z:.95,w:.6,d:.6,h:1.55},
  {type:'sideboard',room:null,x:5.65,z:-.44,w:1.75,d:.3,h:.83},
];
export const EXECUTIVE_WORK_SPOTS = {
  studio:[[-9.45,.15]],
  // Visitors leave the centre in front of the coffee table clear for serving.
  reception:[[-7.8,-2.6],[-6.6,-2.6],[-10.6,-2.6],[-9.4,-2.6]],
  meeting:[[-8.6,2.35],[-5.9,2.35],[-3.2,2.35]],
  desk:[[.5,-.35],[-2.5,-1.2],[-4.75,-1.4],[-2.1,1.1]],
  library:[[-2.2,-4.6],[-3.4,-4.2],[.6,-4.7]],
  research:[[2.45,-4.1],[5.45,-2.1],[3.8,-1.65]],
  server:[[4.6,4.0],[6.1,4.0],[5.35,5.25]],
};
export const EXECUTIVE_INTERACTIONS={board:{x:.15,z:4.65},terminal:{x:5.35,z:5.25},search:{x:6.25,z:-2.1}};

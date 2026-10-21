import { EXECUTIVE_BOUNDS, EXECUTIVE_DOOR_LEAVES, EXECUTIVE_ROOM_LAYOUT, EXECUTIVE_WALLS, EXECUTIVE_FURNITURE, EXECUTIVE_WORK_SPOTS } from './office-executive.js';
export { EXECUTIVE_ROOM_LAYOUT, EXECUTIVE_WALLS, EXECUTIVE_FURNITURE, EXECUTIVE_WORK_SPOTS } from './office-executive.js';

// The renderer and navigator share these exact walls and furniture footprints.
// Coordinates are metres on the X/Z floor; a character has a 0.43 m radius including the hood.
export const CHARACTER_RADIUS = 0.43;
export const CELL_SIZE = 0.4;
export const OFFICE_BOUNDS = { minX: -14.8, maxX: 12, minZ: -8, maxZ: 8 };
export const ROOM_LAYOUT = [
  { key: 'library', x: -8, z: -4.75, color: '#eee0c6', label: [-8, 2.65, -7.0], bounds: [-11.8,-4.2,-7.8,-1.6] },
  { key: 'studio', x: 0, z: -4.75, color: '#dfe8d7', label: [0, 2.65, -7.0], bounds: [-3.8,3.8,-7.8,-1.6] },
  { key: 'server', x: 8, z: -4.75, color: '#dce5ed', label: [8, 2.65, -7.0], bounds: [4.2,11.8,-7.8,-1.6] },
  { key: 'desk', x: -8, z: 4.75, color: '#f0e0cd', label: [-9.2, 1.7, 7.0], bounds: [-11.8,-4.2,1.6,7.8] },
  { key: 'meeting', x: 0, z: 4.75, color: '#e8deed', label: [-0.4, 1.7, 7.0], bounds: [-3.8,3.8,1.6,7.8] },
  { key: 'research', x: 8, z: 4.75, color: '#dcebe5', label: [8, 1.7, 7.0], bounds: [4.2,11.8,1.6,7.8] },
];
export const WALLS = [
  { x:0,z:-8,w:24.2,d:.2,h:2.9,outer:true },
  { x:-12,z:-4.7,w:.2,d:6.8,h:2.2,outer:true },
  { x:-12,z:4.7,w:.2,d:6.8,h:2.2,outer:true },
  { x:-14.7,z:0,w:.15,d:2.8,h:2.2,outer:true },
  ...[-1.35,1.35].map(z=>({x:-13.35,z,w:2.7,d:.15,h:2.2,outer:true})),
  { x:12,z:0,w:.2,d:16.2,h:.38,outer:true },
  { x:0,z:8,w:24.2,d:.2,h:.38,outer:true },
];
for (const x of [-4,4]) for (const z of [-4.75,4.75]) WALLS.push({x,z,w:.18,d:6.5,h:1.15});
for (const z of [-1.5,1.5]) for (const center of [-8,0,8]) {
  // Every room has a real 2.2 m opening onto the central corridor.
  for (const side of [-1,1]) WALLS.push({x:center+side*2.55,z,w:2.9,d:.18,h:.95});
}
export const DOORS = [-8,0,8].flatMap(x=>[-1.5,1.5].map(z=>({x,z,w:2.2})));
export const FURNITURE = [
  ...[-10.7,-8,-5.3].map(x=>({type:'bookshelf',room:'library',x,z:-7.35,w:2.05,d:.55,h:2.1})),
  // Turn the reading table toward the archive wall and keep its southeast
  // corner clear; seats face into the room along the long west side.
  {type:'reading-table',room:'library',x:-5.15,z:-3.55,w:3.4,d:1.35,h:.85,rotation:Math.PI/2},
  ...[-4.65,-3.55,-2.45].map(z=>({type:'chair',room:'library',x:-6.45,z,w:.7,d:.7,h:.95,rotation:Math.PI/2})),
  ...[-6.45,-4.05].map(z=>({type:'computer-desk',room:'studio',x:-3.15,z,w:1.2,d:2.4,h:.85,rotation:Math.PI/2})),
  {type:'computer-desk',room:'studio',x:3,z:-6.45,w:1.2,d:2,h:.85,rotation:-Math.PI/2},
  ...[-6.45,-4.05].map(z=>({type:'chair',room:'studio',x:-2.05,z,w:.7,d:.7,h:.95,rotation:-Math.PI/2})),
  {type:'chair',room:'studio',x:1.6,z:-6.45,w:.7,d:.7,h:.95,rotation:Math.PI/2},
  {type:'cabinet',room:'studio',x:3.1,z:-2.7,w:2.2,d:.5,h:1.15,rotation:-Math.PI/2},
  ...[5.4,7.6,9.8].map(x=>({type:'rack',room:'server',x,z:-6.45,w:1.5,d:1.05,h:2.45})),
  {type:'computer-desk',room:'server',x:10.6,z:-3.4,w:.9,d:1.9,h:.9,rotation:-Math.PI/2},
  {type:'sofa',room:'desk',x:-8.8,z:6.6,w:4,d:1.2,h:.95,rotation:Math.PI},
  {type:'sofa',room:'desk',x:-10.75,z:4.2,w:1.2,d:2.8,h:.95},
  {type:'coffee-table',room:'desk',x:-8.1,z:4.5,w:1.9,d:1.05,h:.48},
  {type:'cabinet',room:'desk',x:-5.1,z:6.9,w:1.2,d:.55,h:1.2,rotation:Math.PI},
  {type:'meeting-table',room:'meeting',x:0,z:5.15,w:3.5,d:1.6,h:.88},
  ...[-1.2,0,1.2].flatMap(x=>[3.75,6.65].map(z=>({type:'chair',room:'meeting',x,z,w:.65,d:.65,h:.95,rotation:z<5?0:Math.PI}))),
  {type:'whiteboard',room:'meeting',x:2.5,z:1.85,w:2.35,d:.22,h:2.25},
  ...[5.9,9.4].map(x=>({type:'computer-desk',room:'research',x,z:7.15,w:2.5,d:1.25,h:.85,rotation:Math.PI})),
  ...[5.9,9.4].map(x=>({type:'chair',room:'research',x,z:6.05,w:.7,d:.7,h:.95})),
  {type:'globe',room:'research',x:10.95,z:2.65,w:.85,d:.85,h:1.65},
  ...[[-11.15,-2.8,'library'],[-2.55,-2.2,'studio'],[11,-7,'server'],[-11.1,7.1,'desk'],[3.05,7,'meeting'],[11.1,4.2,'research']].map(([x,z,room])=>({type:'plant',room,x,z,w:.62,d:.62,h:1.4})),
];
export const WORK_SPOTS = {
  library:[[-6.45,-4.65],[-6.45,-3.55],[-6.45,-2.45]],
  studio:[[-1.2,-6.45],[-1.2,-4.05],[1.6,-6.45]],
  server:[[5.4,-5.35],[7.6,-5.35],[9.8,-5.35]],
  research:[[5.9,5.2],[9.4,5.2],[10.8,2.8]],
  meeting:[[-1.2,2.8],[0,2.8],[1.2,2.8]],
  desk:[[-6,4.0],[-6,5.6],[-8,2.6],[-9.8,2.2],[-5.3,2.8],[-9.5,5.25],[-6.3,7.05],[-4.6,3.8],[-4.6,5.8],[-5.1,4.6],[-11,2.15],[-7,2.6]],
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function roomAt(point,layout=ROOM_LAYOUT){return layout.find(({bounds:[x0,x1,z0,z1]})=>point.x>=x0&&point.x<=x1&&point.z>=z0&&point.z<=z1)?.key||null;}
export class OfficeNavigator {
  constructor(layout=null){
    this.customLayout=layout;this.bounds=layout?.navigationBounds||layout?.bounds||OFFICE_BOUNDS;
    this.width=Math.round((this.bounds.maxX-this.bounds.minX)/CELL_SIZE);
    this.height=Math.round((this.bounds.maxZ-this.bounds.minZ)/CELL_SIZE);
    this.executive=false;this.roomLayout=layout?.rooms||ROOM_LAYOUT;this.workSpots=layout?.workSpots||WORK_SPOTS;this.blockers=layout?.blockers||[...WALLS,...FURNITURE];
    this.free=new Uint8Array(this.width*this.height);
    this.rebuild();
  }
  setExecutive(active){
    if(this.executive===active)return;
    this.executive=active;this.roomLayout=active?EXECUTIVE_ROOM_LAYOUT:ROOM_LAYOUT;this.workSpots=active?EXECUTIVE_WORK_SPOTS:WORK_SPOTS;
    this.blockers=active?[...EXECUTIVE_WALLS,...EXECUTIVE_FURNITURE,...EXECUTIVE_DOOR_LEAVES]:[...WALLS,...FURNITURE];this.rebuild();
  }
  rebuild(){
    for(let i=0;i<this.free.length;i++)this.free[i]=Number(this.isWalkable(this.point(i)));
    this.regions=this.customLayout?.regionAt?Array.from({length:this.free.length},(_,i)=>this.customLayout.regionAt(this.point(i))):null;
  }
  point(index){return {x:this.bounds.minX+(index%this.width+.5)*CELL_SIZE,z:this.bounds.minZ+(Math.floor(index/this.width)+.5)*CELL_SIZE};}
  isWalkable(point){
    const margin=CHARACTER_RADIUS+.03;
    const bounds=this.executive?EXECUTIVE_BOUNDS:this.bounds;
    if(point.x<=bounds.minX+margin||point.x>=bounds.maxX-margin||point.z<=bounds.minZ+margin||point.z>=bounds.maxZ-margin)return false;
    if(!this.customLayout&&point.x<-12&&Math.abs(point.z)>1.35-margin)return false;
    if(this.customLayout?.isWalkable&&!this.customLayout.isWalkable(point,margin))return false;
    return !this.blockers.some(item=>{const angle=item.rotation||0,halfX=(Math.abs(Math.cos(angle))*item.w+Math.abs(Math.sin(angle))*item.d)/2+margin,halfZ=(Math.abs(Math.sin(angle))*item.w+Math.abs(Math.cos(angle))*item.d)/2+margin;return Math.abs(point.x-item.x)<halfX&&Math.abs(point.z-item.z)<halfZ;});
  }
  nearest(point,room=null){let best=-1,bestDistance=Infinity;for(let i=0;i<this.free.length;i++){if(!this.free[i])continue;const candidate=this.point(i);if(room&&roomAt(candidate,this.roomLayout)!==room)continue;const d=distance(point,candidate);if(d<bestDistance){best=i;bestDistance=d;}}return best;}
  station(room,index=0){const spots=this.workSpots[room]||this.workSpots.desk;const [x,z]=spots[index%spots.length];return this.point(this.nearest({x,z},room));}
  findPath(start,end){
    const first=this.nearest(start),last=this.nearest(end);
    if(first<0||last<0)return [];
    if(first===last)return [this.point(first)];
    const allowedRegions=this.regions?new Set([this.regions[first],this.regions[last]]):null;
    const open=[first],inOpen=new Set(open),closed=new Set(),previous=new Map();
    const g=new Map([[first,0]]),f=new Map([[first,this.heuristic(first,last)]]);
    while(open.length){
      let best=0;for(let i=1;i<open.length;i++)if(f.get(open[i])<f.get(open[best]))best=i;
      const current=open.splice(best,1)[0];inOpen.delete(current);
      if(current===last){const indices=[last];let node=last;while(previous.has(node)){node=previous.get(node);indices.push(node);}return indices.reverse().map(index=>this.point(index));}
      closed.add(current);
      for(const next of this.neighbors(current)){
        if(!this.free[next]||closed.has(next))continue;
        if(this.regions?.[next]&&!allowedRegions.has(this.regions[next]))continue;
        const score=g.get(current)+1;
        if(score>=(g.get(next)??Infinity))continue;
        previous.set(next,current);g.set(next,score);f.set(next,score+this.heuristic(next,last));
        if(!inOpen.has(next)){open.push(next);inOpen.add(next);}
      }
    }
    return [];
  }
  heuristic(a,b){return Math.abs(a%this.width-b%this.width)+Math.abs(Math.floor(a/this.width)-Math.floor(b/this.width));}
  neighbors(index){const x=index%this.width,z=Math.floor(index/this.width),result=[];if(x>0)result.push(index-1);if(x<this.width-1)result.push(index+1);if(z>0)result.push(index-this.width);if(z<this.height-1)result.push(index+this.width);return result;}
  simplify(points){return points.filter((point,index)=>{if(index===0||index===points.length-1)return true;const a=points[index-1],b=points[index+1];return Math.abs((point.x-a.x)*(b.z-point.z)-(point.z-a.z)*(b.x-point.x))>.0001;});}
  segmentIsSafe(a,b){const steps=Math.max(1,Math.ceil(distance(a,b)/.05));for(let i=0;i<=steps;i++){const fraction=i/steps;if(!this.isWalkable({x:a.x+(b.x-a.x)*fraction,z:a.z+(b.z-a.z)*fraction}))return false;}return true;}
}
export class OfficeWalker {
  constructor(navigator,start){this.navigator=navigator;this.position={...start};this.route=[];this.pending=null;this.destination={...start};this.targetRoom='desk';this.room=roomAt(start,navigator.roomLayout);this.walking=false;this.blocked=false;this.heading=.35;this.distanceWalked=0;}
  setDestination(point,room){
    const desired=this.pending?.point||this.destination;
    if(distance(desired,point)<.01&&this.targetRoom===room)return;
    this.targetRoom=room;this.pending={point:{...point},room};
    if(!this.route.length)this.plan();
  }
  plan(){
    if(!this.pending)return;
    const {point,room}=this.pending;this.pending=null;this.targetRoom=room;this.destination=point;
    const route=this.navigator.findPath(this.position,point);
    // The first point is the current grid node. No coordinate snapping is used.
    if(route.length&&distance(this.position,route[0])<.01)route.shift();
    this.route=route;this.blocked=!route.length&&distance(this.position,point)>.05;this.walking=route.length>0;
  }
  tick(dt,speed=1.65){
    let budget=dt*speed;
    while(budget>0&&this.route.length){
      const next=this.route[0],d=distance(this.position,next);
      if(d<.0001){this.route.shift();if(this.pending)this.plan();continue;}
      const step=Math.min(d,budget),dx=(next.x-this.position.x)/d,dz=(next.z-this.position.z)/d;
      this.position.x+=dx*step;this.position.z+=dz*step;this.heading=Math.atan2(dx,dz);this.distanceWalked+=step;budget-=step;
      if(step>=d-.0001){this.route.shift();if(this.pending)this.plan();}
    }
    if(!this.route.length&&this.pending)this.plan();
    this.walking=this.route.length>0;
    this.room=roomAt(this.position,this.navigator.roomLayout);
    return this.position;
  }
}

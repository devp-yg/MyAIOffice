import {OfficeNavigator} from './office-navigation.js';

const contains = ({x,z}, [minX,maxX,minZ,maxZ], inset=0) =>
  x >= minX+inset && x <= maxX-inset && z >= minZ+inset && z <= maxZ-inset;

export function createCatHabitat(layout) {
  const {minX,maxX,minZ,maxZ}=layout.bounds;
  const lawn=[minX,maxX,minZ,maxZ];
  const paving=layout.circulation.paths.map(path=>path.bounds);
  const rooms=[...layout.rooms.map(room=>room.bounds),layout.executive.bounds];
  const navigator=new OfficeNavigator({
    ...layout,
    isWalkable(point,margin){
      // Keep the whole cat outside, even when it turns beside an open gate.
      if(rooms.some(room=>contains(point,room,-.85)))return false;
      if(layout.park.beds.some(bed=>contains(point,bed,-margin-.12)))return false;
      return contains(point,lawn,margin)||paving.some(path=>contains(point,path,margin));
    },
  });

  // Select destinations only in the outdoor area reachable from the promenade.
  const hub=navigator.nearest(layout.circulation.hub);
  const reachable=new Set([hub]), queue=[hub];
  for(let cursor=0;cursor<queue.length;cursor++){
    for(const next of navigator.neighbors(queue[cursor])){
      if(navigator.free[next]&&!reachable.has(next)){
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const destinations=queue.filter((_,index)=>index%5===0).map(index=>navigator.point(index));
  const starts=[
    {x:layout.park.label.x,z:layout.park.label.z},
    {x:-16,z:layout.park.bounds[2]-1.5},
    {x:11.6,z:-7},
  ].map(point=>destinations.reduce((best,spot)=>
    Math.hypot(spot.x-point.x,spot.z-point.z)<Math.hypot(best.x-point.x,best.z-point.z)?spot:best));

  return {
    navigator,destinations,starts,
    floorHeight(point){
      if(paving.some(rect=>contains(point,rect)))return .026;
      return contains(point,layout.park.bounds)?-.007:-.055;
    },
  };
}

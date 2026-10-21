import test from 'node:test';
import assert from 'node:assert/strict';
import {OfficeNavigator,roomAt} from '../public/office-navigation.js';
import {createSharedLayout,createPreviewAssignments,SCENARIOS} from '../public/shared-office-layout.js';

test('all shared office seats remain distinct and reachable around the garden and furniture',()=>{
  for(const scenario of ['full','busy']){
    const layout=createSharedLayout(scenario),nav=new OfficeNavigator(layout);
    const hub=nav.point(nav.nearest({x:0,z:7.4})),positions=[];
    for(const room of layout.rooms){
      layout.workSpots[room.key].forEach((_,index)=>{
        const point=nav.station(room.key,index);
        assert.equal(roomAt(point,layout.rooms),room.key);
        assert.ok(nav.isWalkable(point));
        assert.ok(positions.every(other=>Math.hypot(point.x-other.x,point.z-other.z)>.85),`${scenario}: ${room.key} ${index} overlaps another seat`);
        positions.push(point);
        const path=nav.findPath(hub,point);
        assert.ok(path.length,`${scenario}: no route to ${room.key} ${index}`);
        for(let i=1;i<path.length;i++)assert.ok(nav.segmentIsSafe(path[i-1],path[i]));
      });
    }
    assert.equal(positions.length,scenario==='busy'?60:42);
    for(const [x0,x1,z0,z1]of layout.park.beds)assert.equal(nav.isWalkable({x:(x0+x1)/2,z:(z0+z1)/2}),false);
  }
});

test('work pods mix projects while three meeting teams can collaborate concurrently',()=>{
  for(const scenario of Object.keys(SCENARIOS)){
    const layout=createSharedLayout(scenario),assignments=createPreviewAssignments(layout,scenario);
    assert.equal(assignments.length,Object.values(SCENARIOS[scenario].counts).reduce((a,b)=>a+b,0));
    assert.equal(new Set(assignments.map(a=>a.seat.id)).size,assignments.length);
  }
  const layout=createSharedLayout('full'),assignments=createPreviewAssignments(layout,'full');
  for(const room of ['library','studio','server','desk']){
    assert.ok(new Set(assignments.filter(a=>a.seat.room===room).map(a=>a.project.key)).size>1);
  }
  const meetings=assignments.filter(a=>a.seat.room==='meeting');
  assert.equal(new Set(meetings.map(a=>a.project.key)).size,3);
  for(const pod of layout.pods.filter(p=>p.room==='meeting'))assert.equal(new Set(meetings.filter(a=>a.seat.pod===pod.id).map(a=>a.project.key)).size,1);
});

test('expansion keeps existing furniture pods and seat coordinates stable',()=>{
  const base=createSharedLayout('full'),expanded=createSharedLayout('busy');
  for(const seat of base.seats)assert.deepEqual(expanded.seats.find(s=>s.id===seat.id),seat);
  for(const pod of base.pods)assert.deepEqual(expanded.pods.find(p=>p.id===pod.id),pod);
  const baseNav=new OfficeNavigator(base),expandedNav=new OfficeNavigator(expanded);
  for(const room of base.rooms)base.workSpots[room.key].forEach((_,index)=>assert.deepEqual(expandedNav.station(room.key,index),baseNav.station(room.key,index)));
});

test('each zone has solid boundaries and multiple genuine entrances in normal and expanded layouts',()=>{
  for(const mode of ['full','busy',{library:35,studio:35,server:35,meeting:36,desk:35}]){
    const layout=createSharedLayout(mode),nav=new OfficeNavigator(layout);
    const inside=(point,wall)=>{const c=Math.cos(wall.rotation),s=Math.sin(wall.rotation),dx=point.x-wall.x,dz=point.z-wall.z;return Math.abs(dx*c-dz*s)<wall.w/2&&Math.abs(dx*s+dz*c)<wall.d/2;};
    for(const room of layout.rooms){
      const walls=layout.boundaries.walls.filter(w=>w.room===room.key),gates=layout.boundaries.gates.filter(g=>g.room===room.key);
      assert.ok(walls.length>=32);assert.ok(gates.length>=2);
      for(const wall of walls){assert.ok(layout.blockers.includes(wall));assert.equal(nav.isWalkable({x:wall.x,z:wall.z}),false);assert.ok(wall.h>=.8);}
      for(const gate of gates){
        const [x0,x1,z0,z1]=room.bounds,horizontal=['north','south'].includes(gate.side),point={x:horizontal?gate.center:gate.side==='west'?x0:x1,z:horizontal?(gate.side==='north'?z0:z1):gate.center};
        assert.ok(!walls.some(w=>inside(point,w)),`${room.key}: blocked ${gate.side} entrance`);
      }
    }
  }
});

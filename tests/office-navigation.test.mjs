import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficeNavigator, OfficeWalker, WORK_SPOTS, roomAt } from '../public/office-navigation.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('every work station and waiting position is reachable without touching walls or furniture',()=>{
  const nav=new OfficeNavigator();
  let checked=0;
  for(let home=0;home<WORK_SPOTS.desk.length;home++){
    const start=nav.station('desk',home);
    assert.equal(roomAt(start),'desk');
    assert.ok(nav.isWalkable(start));
    for(const [room,spots]of Object.entries(WORK_SPOTS)){
      for(let slot=0;slot<spots.length;slot++){
        const target=nav.station(room,slot);
        assert.equal(roomAt(target),room);
        const route=nav.findPath(start,target);
        assert.ok(route.length,`no route from lounge ${home} to ${room} ${slot}`);
        assert.ok(distance(route[0],start)<.001);
        assert.ok(distance(route.at(-1),target)<.001);
        for(let i=1;i<route.length;i++){
          assert.ok(nav.segmentIsSafe(route[i-1],route[i]),`${room}: an entire character must fit on each segment`);
          const dx=Math.abs(route[i].x-route[i-1].x),dz=Math.abs(route[i].z-route[i-1].z);
          assert.ok(dx<.001||dz<.001,'routes may not cut diagonally across wall corners');
        }
        checked++;
      }
    }
  }
  assert.ok(checked>300);
});

test('walking crosses room boundaries only through actual door openings',()=>{
  const nav=new OfficeNavigator();
  for(const room of ['library','studio','server','research','meeting']){
    const route=nav.findPath(nav.station('desk'),nav.station(room));
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i];
      for(const wallZ of [-1.5,1.5]){
        if((a.z-wallZ)*(b.z-wallZ)>=0)continue;
        const fraction=(wallZ-a.z)/(b.z-a.z);
        const crossingX=a.x+(b.x-a.x)*fraction;
        assert.ok([-8,0,8].some(x=>Math.abs(crossingX-x)<=.75),`crossed a closed wall at ${crossingX}, ${wallZ}`);
      }
    }
  }
});

test('an interrupted trip reroutes continuously, reaches work, then walks back to the lounge',()=>{
  const nav=new OfficeNavigator();
  const home=nav.station('desk',1);
  const walker=new OfficeWalker(nav,home);
  const dt=1/60,speed=1.7;
  walker.setDestination(nav.station('library',1),'library');
  function step(){
    const before={...walker.position};
    walker.tick(dt,speed);
    assert.ok(distance(before,walker.position)<=speed*dt+.00001,'a frame must never teleport');
    assert.ok(nav.segmentIsSafe(before,walker.position),'an interrupted route crossed an obstacle');
  }
  for(let frame=0;frame<210;frame++)step();
  const beforeRetarget={...walker.position};
  walker.setDestination(nav.station('server',2),'server');
  assert.deepEqual(walker.position,beforeRetarget,'changing work cannot change the current position');
  for(let frame=0;frame<2400&&walker.walking;frame++)step();
  assert.ok(distance(walker.position,nav.station('server',2))<.001);
  assert.equal(walker.room,'server');
  walker.setDestination(home,'desk');
  assert.ok(walker.walking);
  for(let frame=0;frame<2400&&walker.walking;frame++)step();
  assert.ok(distance(walker.position,home)<.001);
  assert.equal(walker.room,'desk');
  assert.ok(walker.distanceWalked>20);
});

test('waiting positions have room for the full hood, so new friends do not spawn on top of each other',()=>{
  const nav=new OfficeNavigator();
  const spots=WORK_SPOTS.desk.map((_,index)=>nav.station('desk',index));
  for(let a=0;a<spots.length;a++)for(let b=a+1;b<spots.length;b++)assert.ok(distance(spots[a],spots[b])>=.86-.0001,`lounge places ${a} and ${b} overlap`);
});

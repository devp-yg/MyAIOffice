import test from 'node:test';
import assert from 'node:assert/strict';
import {OfficeNavigator,roomAt} from '../public/office-navigation.js';
import {SecretaryRoutine} from '../public/office-secretary.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function secretary(options){const nav=new OfficeNavigator();nav.setExecutive(true);return new SecretaryRoutine(nav,{random:()=>0,...options});}
const owner={ceoPresent:true,ceoReady:true,ceoPhase:'idle'};

test('secretary can leave her desk and reach every service stop through safe passages',()=>{
  const routine=secretary(),nav=routine.navigator;
  for(let slot=0;slot<4;slot++)assert.ok(distance(routine.stops.reception,nav.station('reception',slot))>=.86,'serving position overlaps a visitor');
  for(const start of Object.values(routine.stops))for(const target of Object.values(routine.stops)){
    assert.equal(roomAt(target,nav.roomLayout),target.room);
    const route=nav.findPath(start,target);
    assert.ok(route.length,`no passage from ${start.room} to ${target.room}`);
    for(let i=1;i<route.length;i++)assert.ok(nav.segmentIsSafe(route[i-1],route[i]),`unsafe route to ${target.room}`);
  }
});

test('rounds serve visitors once, bring CEO tea, tidy rooms and return without teleporting',()=>{
  const services=[],routine=secretary({onService:kind=>services.push(kind)}),jobs=new Set();
  let returned=false,away=false;
  const dt=1/20;
  for(let elapsed=0;elapsed<450;elapsed+=dt){
    const before={...routine.walker.position};
    routine.tick(dt,{...owner,guests:['visitor-one']});
    if(routine.job)jobs.add(routine.job);
    assert.ok(distance(before,routine.walker.position)<=1.28*dt+.00001,'a round teleported');
    assert.ok(routine.navigator.segmentIsSafe(before,routine.walker.position),'a round crossed a wall or furniture');
    if(distance(routine.walker.position,routine.stops.home)>1)away=true;
    if(away&&!routine.job&&distance(routine.walker.position,routine.stops.home)<.01)returned=true;
  }
  assert.equal(services[0],'snacks','arriving guests should be served first');
  assert.equal(services.filter(kind=>kind==='snacks').length,1,'same visitors were repeatedly served');
  assert.ok(services.includes('tea'));
  for(const job of ['tidy-office','tidy-desk','tidy-reception'])assert.ok(jobs.has(job),`missing ${job}`);
  assert.ok(returned,'secretary never returned to her desk');
});

test('CEO arrival and departure interrupt a trip with one greeting, then movement resumes',()=>{
  const routine=secretary();routine.tick(.05,{ceoPresent:false});routine.start('tidy-office');
  for(let i=0;i<20;i++)routine.tick(.05,{ceoPresent:false});
  const before={...routine.walker.position};
  const nearbyOwner={...owner,ceoRoom:routine.walker.room};
  routine.tick(.05,{...nearbyOwner,ceoPhase:'exiting'});
  assert.match(routine.text,/어서 오세요/);
  for(let i=0;i<50;i++)routine.tick(.05,{...nearbyOwner,ceoPhase:'exiting'});
  assert.deepEqual(routine.walker.position,before,'greeting should pause the current trip');
  for(let i=0;i<40;i++)routine.tick(.05,nearbyOwner);
  assert.equal(routine.greeting,null);
  assert.ok(distance(before,routine.walker.position)>.1,'trip did not resume');
  routine.tick(.05,{...nearbyOwner,ceoPhase:'to-lift'});
  assert.match(routine.text,/다녀오세요/);
  for(let i=0;i<80;i++)routine.tick(.05,{...nearbyOwner,ceoPhase:'to-lift'});
  assert.equal(routine.greeting,null,'departure greeting repeated every frame');
});

test('greetings wait for the same room, stop on separation and never repeat the encounter',()=>{
  const routine=secretary();
  routine.tick(.05,{...owner,ceoRoom:'desk'});
  assert.equal(routine.greeting,null,'initial CEO presence in another room triggered a greeting');
  routine.tick(.05,{...owner,ceoPhase:'to-lift',ceoRoom:'desk'});
  assert.equal(routine.greeting,null,'departure triggered a greeting across rooms');
  routine.tick(.05,{...owner,ceoPhase:'to-lift',ceoRoom:'studio'});
  assert.match(routine.text,/다녀오세요/,'passing through the secretary room should trigger one greeting');
  routine.tick(.05,{...owner,ceoPhase:'to-lift',ceoRoom:'reception'});
  assert.equal(routine.greeting,null,'greeting continued after CEO left the room');
  routine.tick(.05,{...owner,ceoPhase:'to-lift',ceoRoom:'studio'});
  assert.equal(routine.greeting,null,'same departure was greeted twice');
  routine.tick(.05,{ceoPresent:false,ceoRoom:'studio'});
  routine.tick(.05,{...owner,ceoPhase:'exiting',ceoRoom:null});
  assert.equal(routine.greeting,null,'arrival in the elevator triggered a greeting');
  routine.tick(.05,{...owner,ceoPhase:'exiting',ceoRoom:'studio'});
  assert.match(routine.text,/어서 오세요/);
  routine.tick(.05,{ceoPresent:false,ceoRoom:'studio'});
  assert.equal(routine.greeting,null,'greeting persisted on a different floor');
});

test('unknown room locations are not considered a shared room',()=>{
  const routine=secretary();routine.walker.room=null;
  routine.tick(.05,{...owner,ceoPhase:'exiting',ceoRoom:null});
  assert.equal(routine.greeting,null);
});

test('service is cancelled when CEO or guests leave, and absent CEO receives no tea',()=>{
  const services=[],routine=secretary({onService:kind=>services.push(kind)});
  routine.start('tea');routine.tick(.05,{...owner,ceoPhase:'to-lift'});
  assert.equal(routine.job,'return');
  routine.start('snacks');routine.tick(.05,{ceoPresent:false,guests:[]});
  assert.equal(routine.job,'return');
  for(let i=0;i<4500;i++)routine.tick(.05,{ceoPresent:false,guests:[]});
  assert.equal(services.length,0);
});

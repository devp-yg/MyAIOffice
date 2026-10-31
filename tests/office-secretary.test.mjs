import test from 'node:test';
import assert from 'node:assert/strict';
import {OfficeNavigator,OfficeWalker,roomAt} from '../public/office-navigation.js';
import {SecretaryRoutine} from '../public/office-secretary.js';
import {createSharedLayout,SCENARIOS} from '../public/shared-office-layout.js';
import * as THREE from '../public/vendor/three/three.module.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function secretary(options){const nav=new OfficeNavigator();nav.setExecutive(true);return new SecretaryRoutine(nav,options);}
const owner={ceoPresent:true,ceoReady:true,ceoPhase:'idle'};

test('secretary can exit the shared executive suite from every duty stop and return safely',()=>{
  const routine=secretary();
  for(const scenario of Object.keys(SCENARIOS)){
    const layout=createSharedLayout(scenario),nav=new OfficeNavigator(layout),suite=layout.executive;
    const outside=nav.point(nav.nearest(layout.circulation.gardenVisit));
    for(const [name,stop] of Object.entries(routine.stops)){
      const inside={x:suite.x-stop.x,z:suite.z-stop.z};
      for(const [from,to] of [[inside,outside],[outside,inside]]){
        const path=nav.findPath(from,to);
        assert.ok(path.length,`${scenario}: no route for ${name}`);
        const walker=new OfficeWalker(nav,from);walker.setDestination(to,null);
        for(let tick=0;tick<2400&&walker.walking;tick++){
          const before={...walker.position};walker.tick(.05,1.72);
          assert.ok(distance(before,walker.position)<=.086001,'escort teleported');
          assert.ok(nav.segmentIsSafe(before,walker.position),`${scenario}: unsafe passage for ${name}`);
        }
        assert.ok(!walker.blocked&&distance(walker.position,to)<.01,`${scenario}: escort stopped before ${name}`);
      }
    }
  }
});

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

test('guest service and explicit duties finish once and return to the desk without teleporting',()=>{
  const services=[],routine=secretary({onService:kind=>services.push(kind)}),jobs=new Set();
  const requested=['tea','tidy-office','tidy-desk','tidy-reception'];
  let returned=false,away=false;
  const dt=1/20;
  for(let elapsed=0;elapsed<450;elapsed+=dt){
    const before={...routine.walker.position};
    routine.tick(dt,{...owner,guests:['visitor-one']});
    if(!routine.job&&services.includes('snacks')&&requested.length)routine.start(requested.shift());
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

test('without guests or a duty the secretary stays at her desk through CEO movements',()=>{
  const routine=secretary(),home={...routine.walker.position};
  for(const ceoRoom of ['desk','studio','reception','meeting','library',null,'server','research','desk']){
    for(let tick=0;tick<1200;tick++)routine.tick(.05,{...owner,ceoRoom});
    assert.deepEqual(routine.walker.position,home);
    assert.equal(routine.job,null);
    assert.equal(routine.walking,false);
    assert.equal(routine.greeting,null);
  }
  assert.ok(!['server','research'].includes(routine.stops.pantry.room),'preparing tea must not enter the private rooms');
});

test('vault and private lounge visits suspend duties and never trigger greetings or service',()=>{
  for(const ceoRoom of ['server','research']){
    const services=[],routine=secretary({onService:kind=>services.push(kind)});
    routine.start('tea');
    for(let tick=0;tick<2000&&!routine.step?.service;tick++)routine.tick(.05,{...owner,ceoRoom:'desk'});
    assert.equal(routine.step?.service,'tea');
    routine.greet('어서 오세요, 대표님!');routine.pendingGreeting='다녀오세요, 대표님!';
    const before={position:{...routine.walker.position},index:routine.index,stepTime:routine.stepTime};
    for(let tick=0;tick<1200;tick++)routine.tick(.05,{...owner,ceoRoom,ceoPhase:'exiting',guests:['visitor']});
    assert.deepEqual(routine.walker.position,before.position);
    assert.equal(routine.index,before.index);assert.equal(routine.stepTime,before.stepTime);
    assert.equal(routine.greeting,null);assert.equal(routine.pendingGreeting,null);
    assert.equal(routine.walking,false);assert.equal(routine.working,false);
    assert.equal(routine.prop,'clipboard');assert.deepEqual(services,[]);
    assert.doesNotMatch(routine.text,/대표님|CEO|금고|라운지/);
    for(let tick=0;tick<100;tick++)routine.tick(.05,{...owner,ceoRoom:'desk'});
    assert.deepEqual(services,['tea'],'requested duty should resume after the private visit');
  }
});

test('guests arriving during a private visit wait until it ends',()=>{
  const routine=secretary();
  for(const ceoRoom of ['server','research']){
    routine.tick(60,{...owner,ceoRoom,guests:['visitor']});
    assert.equal(routine.job,null);assert.equal(routine.greeting,null);
  }
  routine.tick(.05,{...owner,ceoRoom:'desk',guests:['visitor']});
  assert.equal(routine.job,'snacks');
});

test('both renderers keep the secretary at her desk in all suite rooms and the private gallery',async()=>{
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  let SharedExecutiveWing,OfficeScene,secretaryLookForDate;
  try{
    ({SharedExecutiveWing}=await import('../public/shared-office-executive.js'));
    ({OfficeScene,secretaryLookForDate}=await import('../public/office-scene.js'));
  }finally{delete globalThis.document;}
  const character=()=>Object.fromEntries(['root','body','head','eyes','armL','armR','legL','legR'].map(key=>[key,new THREE.Group()])
    .concat([['props',Object.fromEntries(['clipboard','cloth','teaTray','snackTray','emptyTray'].map(key=>[key,new THREE.Group()]))]]));
  const label=()=>({querySelector:()=>({textContent:''}),setAttribute(){},classList:{toggle(){}},dataset:{}});
  const shared=Object.create(SharedExecutiveWing.prototype),tower=Object.create(OfficeScene.prototype);
  const routine=secretary(),nav=routine.navigator;
  shared.root=new THREE.Group();shared.root.position.set(30,0,20);shared.root.rotation.y=Math.PI;
  shared.secretary=character();shared.owner=character();shared.routine=routine;
  shared.secretaryLook=secretaryLookForDate();shared.secretaryLabel=label();shared.ownerLabel=label();
  shared.ownerWalker={walking:false};shared.patrol={text:'팀 현황을 살피는 중'};shared.updateOwner=()=>{};
  tower.navigator=nav;tower.context='top';tower.secretaryModel=character();tower.secretaryRoutine=secretary();
  tower.secretaryRoutineExecutive=true;tower.secretaryLabel=label();tower.actors=new Map();
  tower.owner={journey:{floor:'top',phase:'idle'},walker:new OfficeWalker(nav,nav.station('desk')),model:character()};
  tower.refreshSecretaryLook=()=>{};tower.updateSecretaryServices=()=>{};
  const positions=nav.roomLayout.map(room=>({room:room.key,point:nav.station(room.key)}));
  positions.push({room:null,point:{x:2.6,z:1}});
  for(const {room,point} of positions){
    shared.owner.root.position.copy(shared.point(point.x,0,point.z));
    tower.owner.walker.position={...point};tower.owner.walker.room=room;
    for(let tick=0;tick<200;tick++){
      shared.update(.05,tick*50,false);tower.updateSecretary(.05,tick*50);
    }
    assert.ok(!shared.assisting,`shared renderer escorted CEO in ${room}`);
    assert.ok(!tower.secretaryEscorting,`tower renderer escorted CEO in ${room}`);
    for(const current of [shared.routine,tower.secretaryRoutine]){
      assert.equal(distance(current.walker.position,current.stops.home),0);
      assert.equal(current.paused,['server','research'].includes(room));
      assert.equal(current.greeting,null);assert.equal(current.job,null);
    }
  }
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

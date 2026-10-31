import test from 'node:test';
import assert from 'node:assert/strict';
import {CeoRoutine,CEO_ACTION_TEXT,CEO_REST_ACTIONS} from '../public/ceo-routine.js';
import {OfficeNavigator,OfficeWalker,roomAt} from '../public/office-navigation.js';
import {OfficeOwner} from '../public/office-owner.js';
import {OwnerJourney} from '../public/office-building.js';
import {createSharedLayout} from '../public/shared-office-layout.js';
import * as THREE from '../public/vendor/three/three.module.js';

function complete(routine,time){routine.tick(time);routine.tick(time+routine.duration);}

test('three completed work rounds trigger a break, keeping review, encouragement and coordination conditions',()=>{
  const routine=new CeoRoutine();
  routine.begin(0,2,0);assert.equal(routine.kind,'review');complete(routine,0);
  routine.begin(10000,2,1);assert.equal(routine.kind,'encourage');complete(routine,10000);
  routine.begin(20000,2,1);assert.equal(routine.kind,'coordinate');complete(routine,20000);
  routine.begin(30000,2,1);assert.equal(routine.kind,'tea');complete(routine,30000);
  assert.equal(routine.workSinceRest,0);
  routine.begin(50000,2,1);assert.equal(routine.kind,'encourage');
});

test('an idle team rotates through all breaks and gets the full duration after arrival',()=>{
  const routine=new CeoRoutine();let time=10000;
  for(const kind of ['tea','read','stretch','tea']){
    routine.begin(time,0);assert.equal(routine.kind,kind);
    routine.tick(time+20000,{walking:true});
    assert.equal(routine.active,true);assert.equal(routine.dwellUntil,0);
    assert.equal(routine.text,CEO_REST_ACTIONS[kind].walkingText);
    const arrival=time+21000;routine.tick(arrival);
    assert.equal(routine.text,CEO_ACTION_TEXT[kind]);
    routine.tick(arrival+routine.duration-1);assert.equal(routine.active,true);
    routine.tick(arrival+routine.duration);assert.equal(routine.active,false);
    assert.equal(routine.due(routine.nextAt-1),false);
    assert.equal(routine.due(routine.nextAt),true);time=routine.nextAt;
  }
});

test('interruptions and blocked paths do not count as completed work or completed rest',()=>{
  const routine=new CeoRoutine();
  routine.begin(0,1);routine.cancel(1000);assert.equal(routine.workSinceRest,0);
  routine.begin(2000,0);routine.tick(3000,{blocked:true});
  assert.equal(routine.active,false);assert.equal(routine.restCount,0);
  assert.equal(routine.nextKind(0),'tea');assert.equal(routine.due(3001),false);
});

test('every break is reachable without crossing walls in the tower and shared layouts',()=>{
  const suite=new OfficeNavigator();suite.setExecutive(true);
  const layouts=[null,createSharedLayout('full'),createSharedLayout('busy')];
  for(const layout of layouts){
    const nav=layout?new OfficeNavigator(layout):suite;
    const transform=point=>layout?{x:layout.executive.x-point.x,z:layout.executive.z-point.z}:point;
    let start=transform(suite.station('desk'));
    for(const [kind,rest]of Object.entries(CEO_REST_ACTIONS)){
      const local=suite.station(rest.room,rest.slot);
      assert.equal(roomAt(local,suite.roomLayout),rest.room);
      const target=nav.point(nav.nearest(transform(local))),walker=new OfficeWalker(nav,start);
      walker.setDestination(target,layout?null:rest.room);
      for(let tick=0;tick<2400&&walker.walking;tick++){
        const before={...walker.position};walker.tick(.05,1.9);
        assert.ok(nav.segmentIsSafe(before,walker.position),`unsafe path to ${kind}`);
        assert.ok(Math.hypot(before.x-walker.position.x,before.z-walker.position.z)<=.095001);
      }
      assert.equal(walker.blocked,false);assert.equal(walker.walking,false);
      assert.ok(Math.hypot(walker.position.x-target.x,walker.position.z-target.z)<.01);
      start=target;
    }
  }
});

function model(){
  return Object.fromEntries(['root','body','head','eyes','armL','armR','legL','legR'].map(key=>[key,new THREE.Group()])
    .concat([['props',Object.fromEntries(['cup','book','phone'].map(key=>[key,new THREE.Group()]))]]));
}

test('shared CEO rests even in an empty office and new requests clear each rest pose and prop',async()=>{
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  let SharedExecutiveWing;
  try{({SharedExecutiveWing}=await import('../public/shared-office-executive.js'));}
  finally{delete globalThis.document;}
  const layout=createSharedLayout('full'),nav=new OfficeNavigator(layout),suite=new OfficeNavigator();suite.setExecutive(true);
  for(const [index,kind]of ['tea','read','stretch'].entries()){
    const wing=Object.create(SharedExecutiveWing.prototype);
    wing.root=new THREE.Group();wing.root.position.set(layout.executive.x,0,layout.executive.z);wing.root.rotation.y=layout.executive.rotation;
    wing.layout=layout.executive;wing.navigator=suite;wing.sharedNavigator=nav;
    const home=wing.point(...[suite.station('desk').x,0,suite.station('desk').z]);
    wing.ownerWalker=new OfficeWalker(nav,{x:home.x,z:home.z});wing.owner=model();wing.patrol=new CeoRoutine();wing.patrol.restCount=index;wing.patrol.nextAt=0;
    let time=10000;
    for(let tick=0;tick<2000&&!wing.patrol.dwellUntil;tick++,time+=50)wing.updateOwner(.05,time,true,[]);
    assert.equal(wing.patrol.kind,kind);assert.ok(wing.patrol.dwellUntil>time);
    assert.equal(wing.owner.props.cup.visible,kind==='tea');assert.equal(wing.owner.props.book.visible,kind==='read');
    if(kind==='stretch')assert.ok(wing.owner.armL.rotation.z< -2);
    if(kind==='read')assert.ok(wing.owner.head.rotation.x>0);
    const position={...wing.ownerWalker.position},actor={id:'worker',session:{requestId:'new',lastRequestAt:Date.now()}};
    wing.updateOwner(.05,time,true,[actor]);
    assert.equal(wing.patrol.active,false);assert.equal(wing.patrol.text,CEO_ACTION_TEXT.command);
    assert.deepEqual(wing.ownerWalker.position,position);
    assert.equal(wing.owner.props.phone.visible,true);assert.equal(wing.owner.props.cup.visible,false);assert.equal(wing.owner.props.book.visible,false);
    assert.equal(wing.owner.armL.rotation.z,0);assert.equal(wing.owner.armR.rotation.z,0);assert.equal(wing.owner.head.rotation.x,0);
    wing.updateOwner(.05,time+2700,true,[actor]);
    assert.equal(wing.patrol.text,CEO_ACTION_TEXT.idle);assert.equal(wing.owner.props.phone.visible,false);
  }
});

test('tower requests interrupt a rest route from the current position and keep the destination request',()=>{
  const nav=new OfficeNavigator();nav.setExecutive(true);
  const owner=Object.create(OfficeOwner.prototype);
  owner.office={navigator:nav};owner.walker=new OfficeWalker(nav,nav.station('desk'));owner.journey=new OwnerJourney();owner.journey.initialize('top');
  owner.patrol=new CeoRoutine();owner.patrol.begin(0,0);
  owner.walker.setDestination(nav.station('research',1),'research');owner.walker.tick(.1);
  const position={...owner.walker.position};owner.command('other');
  assert.equal(owner.patrol.active,false);assert.equal(owner.walker.walking,false);assert.equal(owner.walker.route.length,0);
  assert.deepEqual(owner.walker.position,position);
  assert.ok(owner.journey.pending==='other'||owner.journey.target==='other');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/three.module.js';
import {OfficeNavigator,CHARACTER_RADIUS,roomAt} from '../public/office-navigation.js';
import {createSharedLayout,SCENARIOS} from '../public/shared-office-layout.js';
import {OfficeVisitor,SpouseWatch,SPOUSE_DISTANCE,SPOUSE_TRIGGER_DISTANCE,VISITOR_PROFILE,pregnancyProgress,maternityShape} from '../public/office-visitor.js';

const fixturePreferences={visitorEnabled:true,visitorName:'테스트 방문객',visitorRole:'방문객',visitorBaby:'테스트 아기',visitorDueDate:'2031-03-15'};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function layouts(){
  const standard=new OfficeNavigator(),executive=new OfficeNavigator();executive.setExecutive(true);
  return [standard,executive,...Object.keys(SCENARIOS).map(key=>new OfficeNavigator(createSharedLayout(key)))];
}

function assertRoadOnly(routine,source){
  const p=routine.walker.position,nav=routine.navigator;
  assert.ok(nav.isWalkable(p),'wife left an allowed road');
  assert.equal(roomAt(p,source.roomLayout),null,'wife entered a shared room');
  if(nav.exclusion){const [x0,x1,z0,z1]=nav.exclusion,margin=CHARACTER_RADIUS+.03;
    assert.ok(p.x<x0-margin||p.x>x1+margin||p.z<z0-margin||p.z>z1+margin,'wife entered the office buffer');
  }
}

test('the wife navigation excludes every room and the entire office buffer without changing employee paths',()=>{
  for(const source of layouts()){
    const before=source.free.slice(),routine=new SpouseWatch(source),nav=routine.navigator;
    assertRoadOnly(routine,source);
    for(let index=0;index<nav.free.length;index++)if(nav.free[index]){
      routine.walker.position=nav.point(index);assertRoadOnly(routine,source);
    }
    assert.equal(source.free.every((value,index)=>value===before[index]),true,'wife restrictions changed employee navigation');
  }
});

test('while CEO is inside, the wife tours the shared roads and immediately switches to watching outside',()=>{
  for(const scenario of ['full','busy']){
    const source=new OfficeNavigator(createSharedLayout(scenario)),routine=new SpouseWatch(source),visited=[];
    for(let tick=0;tick<6000;tick++){
      const before={...routine.walker.position};routine.tick(.1,{insideOffice:true,active:false});
      assertRoadOnly(routine,source);
      assert.ok(routine.navigator.segmentIsSafe(before,routine.walker.position),'stroll crossed a forbidden room');
      visited.push({...routine.walker.position});
    }
    assert.ok(Math.min(...visited.map(p=>p.x))<-12,'stroll skipped the western shared road');
    assert.ok(Math.max(...visited.map(p=>p.x))>12,'stroll skipped the eastern shared road');
    assert.ok(Math.max(...visited.map(p=>p.z))>source.customLayout.park.bounds[2],'stroll skipped the garden roads');
    const pair={insideOffice:false,active:true,owner:{x:10,z:0},secretary:{x:9,z:0},walking:false};
    for(let tick=0;tick<1000;tick++){routine.tick(.05,pair);assertRoadOnly(routine,source);}
    assert.equal(routine.state,'watching');assert.deepEqual(routine.facing,pair.secretary);
  }
});

test('a CEO working inside a forbidden room never draws the wife across a doorway',()=>{
  const source=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(source);
  const owner=source.station('studio',0),secretary={x:owner.x+.8,z:owner.z};
  const pair={active:true,insideOffice:false,owner,secretary,walking:false};
  for(let tick=0;tick<1000;tick++){routine.tick(.05,pair);assertRoadOnly(routine,source);}
  assert.deepEqual(routine.facing,pair.secretary);
  assert.equal(roomAt(routine.walker.position,source.roomLayout),null);
});

test('spouse enjoys her own road-only stroll without the pair and resumes it when they leave',()=>{
  for(const nav of layouts()){
    const routine=new SpouseWatch(nav);
    for(let i=0;i<200;i++){routine.tick(.05);assertRoadOnly(routine,nav);}
    assert.ok(['strolling','resting'].includes(routine.state));assert.equal(routine.facing,null);
    const pair={active:true,owner:{x:8,z:0},secretary:{x:7,z:0},heading:Math.PI/2,walking:true};
    routine.tick(.05,pair);routine.tick(.05,{...pair,active:false});
    for(let i=0;i<100;i++){routine.tick(.05,{...pair,active:false});assertRoadOnly(routine,nav);}
    assert.ok(['strolling','resting'].includes(routine.state));assert.equal(routine.facing,null);
  }
});

test('spouse reaches a distant stakeout through safe passages and stays put',()=>{
  for(const nav of layouts().filter(nav=>!nav.executive)){
    const routine=new SpouseWatch(nav);
    const owner=nav.point(nav.nearest(nav.executive?{x:3,z:.6}:{x:10,z:0}));
    const secretary=nav.point(nav.nearest({x:owner.x-1,z:owner.z}));
    const pair={active:true,owner,secretary,heading:Math.PI/2,walking:false};
    for(let i=0;i<2000;i++){
      const before={...routine.walker.position};routine.tick(.05,pair);
      const after=routine.walker.position;
      assert.ok(distance(before,after)<=.132501,'spouse teleported');
      assert.ok(nav.segmentIsSafe(before,after),'spouse crossed furniture or a wall');
    }
    assert.equal(routine.state,'watching');assert.deepEqual(routine.facing,secretary);
    const clearance=Math.min(distance(routine.walker.position,owner),distance(routine.walker.position,secretary));
    assert.ok(clearance>=SPOUSE_DISTANCE.watching&&clearance<=SPOUSE_DISTANCE.maximum,`bad watching distance: ${clearance}`);
    assert.ok(Math.max(distance(routine.walker.position,owner),distance(routine.walker.position,secretary))<=SPOUSE_DISTANCE.maximum);
    assert.ok(routine.canSee(routine.walker.position,secretary),'watching through an opaque wall');
    const anchor={...routine.walker.position};
    for(let i=0;i<100;i++)routine.tick(.05,pair);
    assert.deepEqual(routine.walker.position,anchor,'watching should be still');
  }
});

test('spouse follows a moving pair at a distance then watches when both stop',()=>{
  for(const key of Object.keys(SCENARIOS)){
    const nav=new OfficeNavigator(createSharedLayout(key)),routine=new SpouseWatch(nav);
    routine.walker.position=nav.point(nav.nearest(nav.customLayout.circulation.hub));
    const start={...routine.walker.position};
    const pair={active:true,owner:{x:8,z:0},secretary:{x:6.9,z:0},heading:Math.PI/2,walking:true};
    for(let i=0;i<120;i++){
      pair.owner.x+=.06;pair.secretary.x+=.06;
      const before={...routine.walker.position};routine.tick(.05,pair);
      assert.ok(nav.segmentIsSafe(before,routine.walker.position));
      assert.ok(Math.min(distance(routine.walker.position,pair.owner),distance(routine.walker.position,pair.secretary))>=SPOUSE_DISTANCE.minimum);
    }
    assert.ok(distance(start,routine.walker.position)>1,'spouse did not follow');
    pair.walking=false;
    for(let i=0;i<1000;i++)routine.tick(.05,pair);
    assert.equal(routine.state,'watching');assert.deepEqual(routine.facing,pair.secretary);
  }
});

test('spouse keeps up with the CEO at tower walking speed without stepping backwards on replans',()=>{
  const nav=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(nav);
  routine.walker.position=nav.point(nav.nearest({x:-10,z:0}));
  const pair={active:true,owner:{x:0,z:0},secretary:{x:-1.1,z:0},heading:Math.PI/2,walking:true,ownerWalking:true};
  for(let tick=0;tick<125;tick++){
    pair.owner.x+=2.25*.05;pair.secretary.x+=2.25*.05;
    const before={...routine.walker.position};routine.tick(.05,pair);
    assert.ok(nav.segmentIsSafe(before,routine.walker.position));
    assert.ok(routine.walker.position.x>=before.x-.00001,'replanning sent her back toward an old grid center');
  }
  assert.ok(distance(routine.walker.position,pair.owner)<SPOUSE_DISTANCE.maximum+1,'wife fell behind the couple');
  pair.walking=false;pair.ownerWalking=false;
  for(let tick=0;tick<600;tick++)routine.tick(.05,pair);
  assert.equal(routine.state,'watching');
  assert.ok(distance(routine.walker.position,pair.secretary)>=5.5,'wife stood right beside the secretary');
  assert.ok(distance(routine.walker.position,pair.owner)<=SPOUSE_DISTANCE.maximum);
  assert.equal(routine.summary,'주변 구경');
});

test('secretary repositioning does not make the wife wander around a stationary CEO',()=>{
  const nav=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(nav);
  const pair={active:true,owner:{x:10,z:0},secretary:{x:9,z:0},heading:Math.PI/2,walking:true,ownerWalking:false};
  for(let tick=0;tick<1000;tick++)routine.tick(.05,pair);
  assert.equal(routine.state,'watching');
  const start={...routine.walker.position};
  for(let tick=0;tick<200;tick++){
    pair.secretary.z=Math.sin(tick*.03)*.08;routine.tick(.05,pair);
    assert.equal(routine.state,'watching');assert.deepEqual(routine.facing,pair.secretary);
  }
  assert.deepEqual(routine.walker.position,start,'wife paced instead of staying in her stakeout');
});

test('a separated CEO and secretary leave the wife strolling until they come together again',()=>{
  const nav=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(nav);
  routine.walker.position=nav.point(nav.nearest({x:0,z:0}));
  const pair={active:true,owner:{x:14,z:0},secretary:{x:7,z:0},heading:Math.PI/2,walking:false,ownerWalking:false};
  for(let tick=0;tick<400;tick++)routine.tick(.05,pair);
  assert.ok(['strolling','resting'].includes(routine.state));assert.equal(routine.facing,null);assertRoadOnly(routine,nav);
  pair.secretary.x=13;
  for(let tick=0;tick<1000;tick++){routine.tick(.05,pair);assertRoadOnly(routine,nav);}
  assert.equal(routine.state,'watching');
  assert.ok(distance(routine.walker.position,pair.owner)<=SPOUSE_DISTANCE.maximum);
  assert.ok(distance(routine.walker.position,pair.secretary)>=SPOUSE_DISTANCE.watching);
});

test('the 3 m trigger switches immediately in both directions without changing road restrictions',()=>{
  const nav=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(nav);
  assert.equal(SPOUSE_TRIGGER_DISTANCE,3);
  const pair={active:true,insideOffice:false,owner:{x:10,z:0},secretary:{x:10-SPOUSE_TRIGGER_DISTANCE-.001,z:0},walking:false};
  routine.tick(.05,pair);
  assert.ok(['strolling','resting'].includes(routine.state));assert.equal(routine.facing,null);
  pair.secretary.x=10-SPOUSE_TRIGGER_DISTANCE;
  routine.tick(.05,pair);
  assert.ok(!['strolling','resting'].includes(routine.state));assert.deepEqual(routine.facing,pair.secretary);
  pair.secretary.x=10-SPOUSE_TRIGGER_DISTANCE-.001;
  routine.tick(.05,pair);
  assert.ok(['strolling','resting'].includes(routine.state));assert.equal(routine.facing,null);
  assert.equal(routine.anchor,null);assertRoadOnly(routine,nav);
  pair.secretary.x=9;pair.insideOffice=true;
  routine.tick(.05,pair);
  assert.ok(['strolling','resting'].includes(routine.state));assert.equal(routine.facing,null);
});

test('after a turn the wife follows the secretary path instead of the CEO heading in another corridor',()=>{
  const routine=new SpouseWatch(new OfficeNavigator());
  const pair={active:true,owner:{x:0,z:0},secretary:{x:3,z:5},heading:-Math.PI/2,secretaryHeading:Math.PI,walking:true,ownerWalking:true};
  const goal=routine.goal(pair);
  assert.ok(goal.z>=pair.secretary.z+7,'wife left the secretary route at a corner');
  assert.ok(Math.abs(goal.x-pair.secretary.x)<=1.21,'wife wandered too far to the side while the secretary walked north');
});

test('a stakeout stays behind the pair near the passage edge and glances only briefly',()=>{
  const nav=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(nav);
  const pair={active:true,owner:{x:10,z:0},secretary:{x:9,z:0},heading:Math.PI/2,ownerFacing:Math.PI/2,secretaryFacing:Math.PI/2,walking:false};
  for(let tick=0;tick<1000;tick++)routine.tick(.05,pair);
  const position={...routine.walker.position};
  assert.equal(routine.state,'watching');
  assert.ok(position.x<pair.secretary.x-5,'wife stood in front of the couple');
  assert.ok(Math.abs(position.z)>.5,'wife stood conspicuously in the middle of the passage');
  assert.ok(distance(position,pair.secretary)>=5.5);
  assert.ok(distance(position,pair.secretary)<=10);
  let glimpses=0;
  for(let tick=0;tick<260;tick++){
    routine.tick(.05,pair);if(routine.peeking)glimpses++;
    assertRoadOnly(routine,nav);assert.deepEqual(routine.walker.position,position);
  }
  assert.ok(glimpses>=40&&glimpses<=46,'she should glance for about 1.1 s every 6.5 s');
  routine.walker.position={x:pair.secretary.x-3,z:pair.secretary.z};routine.watchTime=0;
  assert.equal(routine.peeking,false,'wife stared conspicuously when the couple came too close');
  routine.tick(.05,{...pair,secretary:{x:5,z:0}});
  assert.equal(routine.peeking,false,'wife kept peeking after the pair separated');
});

test('watch routine rebinds safely after a floor change or shared office expansion',()=>{
  const navigator=new OfficeNavigator(),routine=new SpouseWatch(navigator);
  navigator.setExecutive(true);routine.bind(navigator);
  assert.equal(routine.executive,true);assert.ok(navigator.isWalkable(routine.walker.position));
  const expanded=new OfficeNavigator(createSharedLayout('busy'));routine.bind(expanded);
  assert.equal(routine.sourceNavigator===expanded,true);assert.ok(expanded.isWalkable(routine.walker.position));
  assert.equal(routine.walker.pending,null);assert.deepEqual(routine.walker.route,[]);
  routine.walker.position={x:5,z:0};const position={...routine.walker.position};
  routine.bind(new OfficeNavigator(createSharedLayout('full')),{preserve:true});
  assert.deepEqual(routine.walker.position,position,'layout rebuild teleported the spouse');
});

test('a wall blocks the stare while glass and low furniture allow a view',()=>{
  const nav=new OfficeNavigator(),routine=new SpouseWatch(nav),from={x:-2,z:0},to={x:2,z:0};
  routine.navigator.blockers=[{x:0,z:0,w:.2,d:4,h:2.6}];assert.equal(routine.canSee(from,to),false);
  routine.navigator.blockers[0].finish='glass';assert.equal(routine.canSee(from,to),true);
  routine.navigator.blockers[0].finish='wood';routine.navigator.blockers[0].h=.85;assert.equal(routine.canSee(from,to),true);
});

test('public visitor defaults contain no personal information or job assignment',()=>{
  assert.deepEqual(VISITOR_PROFILE,{name:'',dueDate:'',baby:'',role:''});
  assert.equal(pregnancyProgress(),null);
  assert.equal(pregnancyProgress(new Date(),'2031-02-30'),null);
  assert.equal(VISITOR_PROFILE.project,undefined);
});

test('pregnancy progresses by local calendar days through week and year boundaries',()=>{
  for(const [year,month,day,weeks,days]of [
    [2030,11,9,22,0],[2030,11,10,22,1],[2030,11,15,22,6],[2030,11,16,23,0],
    [2030,12,31,29,3],[2031,1,1,29,4],[2031,3,14,39,6],[2031,3,15,40,0],[2031,3,16,40,1],
  ]){
    for(const hour of [0,12,23]){
      const progress=pregnancyProgress(new Date(year,month-1,day,hour,59),fixturePreferences.visitorDueDate);
      assert.equal(progress.weeks,weeks);assert.equal(progress.days,days);
      assert.equal(progress.label,`임신 ${weeks}주 ${days}일`);
    }
  }
  assert.equal(pregnancyProgress(new Date(2031,2,15),fixturePreferences.visitorDueDate).daysUntilDue,0);
  assert.equal(pregnancyProgress(new Date(2031,2,16),fixturePreferences.visitorDueDate).daysUntilDue,-1);
  assert.equal(pregnancyProgress(new Date(2028,1,28),'2028-02-29').label,'임신 39주 6일');
});

test('an existing visitor refreshes its title and accessible label when the day changes',()=>{
  const previousDocument=globalThis.document;
  const element=()=>({textContent:'',dataset:{},style:{setProperty(){}},append(){},setAttribute(key,value){this[key]=value;}});
  globalThis.document={createElement:element};
  try{
    const belly={scale:{set(...values){this.values=values;}},position:{set(...values){this.values=values;}}};
    const visitor=new OfficeVisitor(null,element(),()=>({root:{visible:true},props:{},belly}),{preferences:fixturePreferences});
    visitor.refreshPregnancy(new Date(2030,10,15,23,59));
    assert.equal(visitor.title.textContent,'테스트 방문객 · 임신 22주 6일');
    const before=[...belly.scale.values];
    visitor.refreshPregnancy(new Date(2030,10,16,0,0));
    assert.equal(visitor.title.textContent,'테스트 방문객 · 임신 23주 0일');
    assert.match(visitor.label['aria-label'],/임신 23주 0일/);
    assert.match(visitor.label['aria-label'],/테스트 아기/);
    assert.match(visitor.label.title,/2031-03-15/);
    assert.ok(belly.scale.values.every((value,index)=>value>before[index]),'midnight did not grow the belly');
    const expected=maternityShape(23);
    assert.deepEqual(belly.scale.values,[expected.x,expected.y,expected.z]);
    assert.deepEqual(belly.position.values,[0,expected.centerY,expected.centerZ]);
    visitor.setProfile({...fixturePreferences,visitorEnabled:false});
    visitor.update(new OfficeNavigator(),0,0,false,true);
    assert.equal(visitor.model.root.visible,false);assert.equal(visitor.label.hidden,true);
    visitor.setProfile({...fixturePreferences,visitorName:'Updated Visitor',visitorDueDate:'',visitorBaby:''});
    assert.equal(visitor.title.textContent,'Updated Visitor · 임산부');
    assert.doesNotMatch(visitor.label.title,/출산 예정일|NaN|테스트 아기/);
    assert.equal(visitor.role.textContent,'방문객');

  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('belly grows smoothly each day while fitting through existing paths at term',()=>{
  let previous=maternityShape(0);
  for(let day=1;day<=280;day++){
    const shape=maternityShape(Math.floor(day/7),day%7);
    for(const key of ['x','y','z']){
      assert.ok(shape[key]>=previous[key],'belly shrank');
      assert.ok(shape[key]-previous[key]<.002,'belly jumped at a week boundary');
    }
    assert.ok(shape.x<CHARACTER_RADIUS);
    assert.ok(shape.centerZ+shape.z<CHARACTER_RADIUS,'belly exceeds navigation clearance');
    previous=shape;
  }
  assert.ok(maternityShape(22).z>maternityShape(20).z);
  assert.deepEqual(maternityShape(42),maternityShape(40));
});

test('the real spouse disguises her stance, briefly glances, and relaxes when the pair separate',async()=>{
  const previousDocument=globalThis.document;
  const element=()=>({textContent:'',dataset:{},style:{setProperty(){}},append(){},setAttribute(key,value){this[key]=value;}});
  globalThis.document={createElement:tag=>tag==='canvas'?{getContext:()=>({fillRect(){},fillText(){}})}:element()};
  try{
    const {createCharacter,disposeCharacter}=await import('../public/office-scene.js');
    const visitor=new OfficeVisitor(new THREE.Group(),element(),createCharacter,{preferences:fixturePreferences}),nav=new OfficeNavigator();
    const pair={active:true,owner:{x:3,z:0},secretary:{x:3,z:1},walking:false};
    for(let tick=0;tick<200;tick++)visitor.update(nav,.05,tick*50,false,true,pair);
    assert.equal(visitor.routine.state,'watching');
    const position={...visitor.routine.walker.position},bodyHeading=visitor.model.root.rotation.y;
    const direction=Math.atan2(pair.secretary.x-position.x,pair.secretary.z-position.z);
    const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));
    assert.ok(Math.abs(angle(bodyHeading-direction))>.9,'body faced the secretary head-on');
    let glances=0,relaxed=0,accurateGlances=0;
    for(let tick=200;tick<460;tick++){
      visitor.update(nav,.05,tick*50,false,true,pair);
      assert.deepEqual(visitor.routine.walker.position,position);
      assert.ok(Math.abs(angle(visitor.model.root.rotation.y-bodyHeading))<.01,'body followed every glance');
      if(visitor.model.glare.visible){
        glances++;assert.equal(visitor.model.smile.visible,false);assert.equal(visitor.model.eyes.scale.y,.75);
        if(Math.abs(angle(visitor.model.root.rotation.y+visitor.model.head.rotation.y-direction))<.03)accurateGlances++;
      }else{relaxed++;assert.equal(visitor.model.smile.visible,true);assert.equal(visitor.model.eyes.scale.y,1);}
      assert.equal(visitor.model.armL.rotation.z,-.06,'wife used a conspicuous confrontational pose');
    }
    assert.ok(glances>=40&&glances<=46);assert.ok(relaxed>200);assert.ok(accurateGlances>20,'brief glances missed the secretary');
    assert.ok(Object.values(visitor.model.props).every(prop=>!prop.visible),'spouse picked up a work prop');
    visitor.update(nav,.05,23000,false,true,{...pair,secretary:{x:7,z:1}});
    assert.ok(['strolling','resting'].includes(visitor.routine.state));
    assert.equal(visitor.model.glare.visible,false);assert.equal(visitor.model.smile.visible,true);
    assert.equal(visitor.model.head.rotation.y,0,'wife kept staring after the pair separated');
    visitor.update(nav,.05,23050,false,true,pair);
    assert.deepEqual(visitor.routine.facing,pair.secretary);
    visitor.update(nav,.05,23100,false,true,{...pair,active:false});
    assert.ok(['strolling','resting'].includes(visitor.routine.state));
    assert.equal(visitor.model.glare.visible,false);assert.equal(visitor.model.smile.visible,true);
    assert.equal(visitor.model.head.rotation.y,0);
    disposeCharacter(visitor.model);
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

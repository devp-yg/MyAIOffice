import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedLayout} from '../public/shared-office-layout.js';
import {OfficeNavigator,roomAt} from '../public/office-navigation.js';
import {OfficeVisitor,SpouseWatch} from '../public/office-visitor.js';
import * as THREE from '../public/vendor/three/three.module.js';

const expanded={library:35,studio:35,server:35,meeting:36,desk:35};

test('wide shared streets connect every rest bay without crossing benches or planting',()=>{
  for(const scenario of ['full','busy',expanded]){
    const layout=createSharedLayout(scenario),nav=new OfficeNavigator(layout);
    assert.equal(layout.bounds.maxX-layout.bounds.minX,56);
    const main=layout.circulation.paths.find(path=>path.id==='main-concourse').bounds;
    assert.equal(main[3]-main[2],4.4);
    const library=layout.rooms.find(room=>room.key==='library'),studio=layout.rooms.find(room=>room.key==='studio');
    assert.ok(studio.bounds[0]-library.bounds[1]>6);
    assert.ok(layout.landscape.benches.length>=9);
    for(const stop of layout.circulation.restStops){
      assert.equal(roomAt(stop,layout.rooms),null);
      assert.ok(nav.isWalkable(stop),`${stop.id}: approach blocked`);
      const route=nav.findPath(layout.circulation.hub,stop);
      assert.ok(route.length,`${stop.id}: disconnected rest bay`);
      for(let i=1;i<route.length;i++)assert.ok(nav.segmentIsSafe(route[i-1],route[i]));
      assert.equal(nav.isWalkable(stop.bench),false,'solid bench must block through traffic');
    }
    for(const [x0,x1,z0,z1]of layout.landscape.beds)assert.equal(nav.isWalkable({x:(x0+x1)/2,z:(z0+z1)/2}),false);
  }
});

test('pregnant visitor takes seated breaks and resumes her interrupted stroll',()=>{
  const nav=new OfficeNavigator(createSharedLayout('full')),routine=new SpouseWatch(nav);
  let rests=0,previous=null,sittingTicks=0;
  const visited=[];
  for(let tick=0;tick<6000;tick++){
    routine.tick(.1,{insideOffice:true,active:false});
    assert.ok(routine.navigator.isWalkable(routine.walker.position));
    visited.push({...routine.walker.position});
    if(routine.restingSeat){
      sittingTicks++;
      assert.equal(routine.walker.walking,false);
      assert.equal(routine.summary,'벤치에서 휴식');
      if(!previous){rests++;assert.ok(routine.pause>=11.9);}
    }
    previous=routine.restingSeat;
  }
  assert.ok(rests>=3,'stroll never stopped at the benches');
  assert.ok(sittingTicks>=350,'seated breaks ended too quickly');
  assert.ok(Math.min(...visited.map(p=>p.x))<-12,'breaks prevented the western stroll');
  assert.ok(Math.max(...visited.map(p=>p.x))>12,'breaks prevented the eastern stroll');
  assert.ok(Math.max(...visited.map(p=>p.z))>nav.customLayout.park.bounds[2]);
});


test('visitor renders a seated pose on the timber bench while retaining a safe road position',async()=>{
  const previousDocument=globalThis.document;
  const element=()=>({textContent:'',dataset:{},style:{setProperty(){}},append(){},setAttribute(key,value){this[key]=value;}});
  globalThis.document={createElement:tag=>tag==='canvas'?{getContext:()=>({fillRect(){},fillText(){}})}:element()};
  try{
    const {createCharacter,disposeCharacter}=await import('../public/office-scene.js');
    const visitor=new OfficeVisitor(new THREE.Group(),element(),createCharacter,{shared:true,preferences:{visitorEnabled:true}});
    const nav=new OfficeNavigator(createSharedLayout('full'));
    for(let tick=0;tick<2000&&!visitor.routine?.restingSeat;tick++)visitor.update(nav,.1,tick*100,false,true,{context:'shared',insideOffice:true,active:false});
    const stop=visitor.routine.restingSeat;
    assert.ok(stop,'visitor never sat down');
    assert.ok(visitor.routine.navigator.isWalkable(visitor.routine.walker.position));
    assert.ok(Math.abs(visitor.model.root.position.x-stop.bench.x)<=.13);
    assert.ok(Math.abs(visitor.model.root.position.z-stop.bench.z)<=.13);
    assert.equal(visitor.model.legL.rotation.x,-1.1);
    assert.equal(visitor.model.legR.rotation.x,-1.1);
    assert.equal(visitor.model.body.position.y,.22);
    assert.match(visitor.action.textContent,/벤치에 앉아/);
    disposeCharacter(visitor.model);
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

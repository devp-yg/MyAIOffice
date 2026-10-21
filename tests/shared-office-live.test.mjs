import test from 'node:test';
import assert from 'node:assert/strict';
import {SharedOfficeOccupancy,sharedProjects,displayedSessions,sharedRoom} from '../public/shared-office-state.js';
import {OfficeNavigator,OfficeWalker} from '../public/office-navigation.js';
import {OfficeLiveFeed} from '../public/office-live-feed.js';
import {StaffIdentities} from '../public/staff-identities.js';

const session=(id,room='studio',key='project-a',active=true)=>({id,room,projectKey:key,project:key,active,updatedAt:1000});
const projects=sessions=>sharedProjects({sessions});

test('all active projects share process zones; all idle workers are optional',()=>{
  const sessions=[session('a'),session('b','research','project-b'),session('c','elevator','project-c'),{...session('old','desk','project-a',false),updatedAt:500},session('latest','desk','project-a',false)];
  assert.equal(sharedRoom(sessions[1]),'library');assert.equal(sharedRoom(sessions[2]),'meeting');
  assert.deepEqual(displayedSessions(sessions).map(s=>s.id),['a','b','c','latest','old']);
  assert.equal(displayedSessions(sessions,false).length,3);
});

test('new activity preserves other seats and an existing worker walks to the next process',()=>{
  const state=new SharedOfficeOccupancy(),sessions=[session('a'),session('b'),session('c','meeting','project-b')];
  const first=state.update(sessions,projects(sessions)),before=new Map(first.assignments.map(a=>[a.id,a.seat.id]));
  const second=state.update([session('new','studio','project-z'),...sessions],projects(sessions));
  for(const a of second.assignments.filter(a=>before.has(a.id)))assert.equal(a.seat.id,before.get(a.id));
  const nav=new OfficeNavigator(second.layout),old=second.assignments.find(a=>a.id==='a');
  const start=nav.station('studio',second.layout.seats.filter(s=>s.room==='studio').findIndex(s=>s.id===old.seat.id));
  const walker=new OfficeWalker(nav,start);
  const next=state.update(sessions.map(s=>s.id==='a'?{...s,room:'research'}:s),projects(sessions));
  const changed=next.assignments.find(a=>a.id==='a');assert.equal(changed.seat.room,'library');
  const nextNav=new OfficeNavigator(next.layout);walker.navigator=nextNav;
  const end=nextNav.station('library',next.layout.seats.filter(s=>s.room==='library').findIndex(s=>s.id===changed.seat.id));walker.setDestination(end,'library');
  assert.deepEqual(walker.position,start);assert.ok(walker.walking);
  for(let i=0;i<1500&&walker.walking;i++)walker.tick(.05,1.9);
  assert.ok(Math.hypot(walker.position.x-end.x,walker.position.z-end.z)<.01);assert.equal(walker.room,'library');
});

test('independent meeting teams get separate pods, including fragmented groups after updates',()=>{
  const state=new SharedOfficeOccupancy(),sessions=Array.from({length:10},(_,i)=>session('team-'+i,'meeting','project-'+i));
  const first=state.update(sessions,projects(sessions));assert.equal(first.assignments.length,10);
  assert.equal(new Set(first.assignments.map(a=>a.seat.pod)).size,10);
  const more=[...sessions,...Array.from({length:9},(_,i)=>session('extra-'+i,'meeting','project-0'))];
  const next=state.update(more,projects(more)),teams=new Map();
  for(const a of next.assignments){if(teams.has(a.seat.pod))assert.equal(teams.get(a.seat.pod),a.project.key);teams.set(a.seat.pod,a.project.key);}
  assert.equal(next.assignments.length,19);assert.equal(new Set(next.assignments.map(a=>a.seat.id)).size,19);
});

test('a concentrated workload adds reachable seats instead of wrapping or dropping employees',()=>{
  for(const room of ['library','studio','server','meeting','desk']){
    const sessions=Array.from({length:35},(_,i)=>session(room+'-'+i,room,'project-'+(i%3))),state=new SharedOfficeOccupancy();
    const data=state.update(sessions,projects(sessions)),nav=new OfficeNavigator(data.layout),hub=nav.point(nav.nearest({x:0,z:7.4})),points=[];
    assert.equal(data.assignments.length,35);
    for(const a of data.assignments){
      const point=nav.station(room,data.layout.seats.filter(s=>s.room===room).findIndex(s=>s.id===a.seat.id));
      assert.ok(points.every(p=>Math.hypot(p.x-point.x,p.z-point.z)>.85),`${room}: duplicate seat`);points.push(point);
      const route=nav.findPath(hub,point);assert.ok(route.length,`${room}: inaccessible seat ${a.seat.id}`);
      for(let i=1;i<route.length;i++)assert.ok(nav.segmentIsSafe(route[i-1],route[i]));
    }
  }
});

test('live identity and error metadata match the same persisted identity used by the tower',()=>{
  const staff={a:{index:12},b:{index:7}},raw=[session('a'),{...session('b','server'),error:true}];let received,connection;
  const feed=new OfficeLiveFeed({onSnapshot:s=>received=s,onConnection:s=>connection=s});
  feed.accept({sessions:raw,archives:[],staff,projects:projects(raw)});
  const tower=new StaffIdentities(staff).assign(raw);
  assert.equal(connection,'connected');assert.deepEqual(received.sessions.map(s=>s.identity),tower.map(s=>s.identity));assert.equal(received.sessions[1].error,true);
  feed.stop();feed.accept({sessions:[]});assert.equal(received.sessions.length,2);
});

test('a connection failure retains the last real snapshot without inserting demo workers',async t=>{
  let last,status;const feed=new OfficeLiveFeed({onSnapshot:s=>last=s,onConnection:s=>status=s});
  feed.accept({sessions:[session('real')],projects:[]});
  t.mock.method(globalThis,'fetch',async()=>{throw Error('offline');});await feed.refresh();
  assert.equal(status,'offline');assert.equal(last.sessions[0].id,'real');assert.equal(last.sessions.length,1);feed.stop();
});

test('an older polling response cannot overwrite a newer streamed activity',()=>{
  let last;const feed=new OfficeLiveFeed({onSnapshot:s=>last=s});
  feed.accept({checkedAt:200,sessions:[session('a','server')]});
  feed.accept({checkedAt:100,sessions:[session('a','studio')]});
  assert.equal(last.sessions[0].room,'server');assert.equal(last.checkedAt,200);feed.stop();
});

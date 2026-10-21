import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficeNavigator, roomAt } from '../public/office-navigation.js';
import { EXECUTIVE_ROOM_LAYOUT, EXECUTIVE_GALLERY_REGIONS, EXECUTIVE_WORK_SPOTS } from '../public/office-executive.js';

function suite(){const nav=new OfficeNavigator();nav.setExecutive(true);return nav;}
const lobby={x:-10.6,z:.2};

test('all executive work and visitor positions are reachable through doors, clear of furniture',()=>{
  const nav=suite(),start=nav.point(nav.nearest(lobby));
  for(const [room,spots]of Object.entries(EXECUTIVE_WORK_SPOTS)){
    const stations=spots.map((_,i)=>nav.station(room,i));
    for(let slot=0;slot<stations.length;slot++){
      const target=stations[slot],route=nav.findPath(start,target);
      assert.equal(roomAt(target,EXECUTIVE_ROOM_LAYOUT),room);
      assert.ok(route.length,`unreachable ${room} ${slot}`);
      for(let i=1;i<route.length;i++)assert.ok(nav.segmentIsSafe(route[i-1],route[i]),`${room}: character clips an open door or furnishing`);
      for(let other=slot+1;other<stations.length;other++)assert.ok(Math.hypot(target.x-stations[other].x,target.z-stations[other].z)>=.86,`${room}: assigned positions overlap`);
    }
  }
});

test('public rooms remain connected, but the private wing cannot bypass the CEO office',()=>{
  const nav=suite(),start=nav.point(nav.nearest(lobby));
  const targets=Object.fromEntries(['reception','meeting','library','research','server'].map(key=>[key,nav.station(key)]));
  // Remove the office from the walkable graph. A missing perimeter wall would
  // leave a route around it and make this security/circulation check fail.
  for(let i=0;i<nav.free.length;i++)if(roomAt(nav.point(i),EXECUTIVE_ROOM_LAYOUT)==='desk')nav.free[i]=0;
  for(const key of ['reception','meeting'])assert.ok(nav.findPath(start,targets[key]).length,`${key} depends on entering the CEO office`);
  for(const key of ['library','research','server'])assert.equal(nav.findPath(start,targets[key]).length,0,`${key} has an uncontrolled public bypass`);
});

test('the secretary has a solid backdrop with no opening behind the desk',()=>{
  const nav=suite();
  for(let z=-1.65;z<1.5;z+=.1)assert.equal(nav.isWalkable({x:-5.8,z}),false,`open backdrop at ${z}`);
});

test('rooms and the private gallery fill the reduced floor plate without leftover strips',()=>{
  const regions=[...EXECUTIVE_ROOM_LAYOUT.map(room=>room.bounds),...EXECUTIVE_GALLERY_REGIONS];
  for(let x=-11.9;x<7.8;x+=.2)for(let z=-6.9;z<7;z+=.2){
    const count=regions.filter(([x0,x1,z0,z1])=>x>x0+1e-6&&x<x1-1e-6&&z>z0+1e-6&&z<z1-1e-6).length;
    assert.equal(count,1,`unassigned or overlapping floor area at ${x}, ${z}`);
  }
});

test('the executive elevator trip is reversible and returning to a standard floor restores its navigation',()=>{
  const nav=suite(),cabin=nav.point(nav.nearest({x:-13.4,z:.2})),office=nav.station('desk');
  assert.ok(nav.findPath(cabin,office).length);
  assert.ok(nav.findPath(office,cabin).length);
  nav.setExecutive(false);
  for(const room of ['library','studio','meeting','server','research'])assert.ok(nav.findPath(nav.station('desk'),nav.station(room)).length);
});

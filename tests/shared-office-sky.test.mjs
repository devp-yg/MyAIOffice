import test from 'node:test';
import assert from 'node:assert/strict';
import {celestialAt} from '../public/office-celestial.js';
import {createSharedLayout} from '../public/shared-office-layout.js';
import {OfficeNavigator} from '../public/office-navigation.js';
import {buildOfficeTerrain,groundShapeGeometry,GROUND_LEVEL} from '../public/shared-office-ground.js';
import * as THREE from '../public/vendor/three/three.module.js';

const seoul={latitude:37.5665,longitude:126.978};

test('sun altitude and bearing follow the observer across morning, noon and night',()=>{
  const morning=celestialAt(new Date('2026-11-07T00:00:00Z'),seoul).sun;
  const noon=new Date('2026-11-07T03:00:00Z');
  const midday=celestialAt(noon,seoul).sun;
  const afternoon=celestialAt(new Date('2026-11-07T06:00:00Z'),seoul).sun;
  const night=celestialAt(new Date('2026-11-07T13:00:00Z'),seoul).sun;
  assert.ok(morning.direction[0]>.5&&afternoon.direction[0]<-.5);
  assert.ok(midday.altitude>morning.altitude&&midday.altitude>afternoon.altitude);
  assert.ok(night.altitude<0);
  assert.ok(celestialAt(noon,{latitude:37.5665,longitude:-53.022}).sun.altitude<0);
  assert.ok(celestialAt(noon,null).sun.direction.every(Number.isFinite));
});

test('lunar phase follows the synodic cycle while its altitude depends on the observer',()=>{
  const moonAt=(day,location=seoul)=>celestialAt(new Date(`2026-11-${day}T13:00:00Z`),location);
  assert.ok(moonAt('09').illuminated<.02);
  assert.ok(Math.abs(moonAt('17').illuminated-.5)<.08);
  const full=moonAt('24'),opposite=moonAt('24',{latitude:-seoul.latitude,longitude:seoul.longitude-180});
  assert.ok(full.illuminated>.98);
  assert.ok(full.moon.altitude>0&&opposite.moon.altitude<0);
  assert.ok(Math.abs(full.illuminated-opposite.illuminated)<1e-12);
});

test('the perimeter leaves openings at the main entrance and courtyard elevator',()=>{
  for(const scenario of ['full',{library:35,studio:35,server:35,meeting:36,desk:35}]){
    const layout=createSharedLayout(scenario),nav=new OfficeNavigator(layout);
    const {minX,maxX,minZ,maxZ}=layout.bounds;
    for(const wall of layout.perimeter)assert.ok(layout.blockers.includes(wall));
    assert.ok(layout.perimeter.some(wall=>wall.x===minX));
    assert.ok(layout.perimeter.some(wall=>wall.z===minZ));
    const south=layout.perimeter.filter(wall=>wall.z===maxZ).sort((a,b)=>a.x-b.x);
    assert.equal(south.length,2);
    const {x:elevatorX,width:elevatorWidth}=layout.elevator;
    assert.ok(Math.abs(south[0].x+south[0].w/2-(elevatorX-elevatorWidth/2))<1e-8);
    assert.ok(Math.abs(south[1].x-south[1].w/2-(elevatorX+elevatorWidth/2))<1e-8);
    assert.equal(layout.perimeter.filter(wall=>wall.x===maxX).length,2);
    const {x,z,arrival}=layout.entrance;
    assert.ok(nav.segmentIsSafe(arrival,{x:x-2,z}));
    assert.equal(nav.isWalkable({x,z:z+layout.entrance.clearWidth/2-.15}),false);
    assert.ok(nav.findPath(arrival,layout.circulation.hub).length>0);
  }
});

test('the terrain stays level under the office and paving faces up toward the light',()=>{
  const layout=createSharedLayout('full'),terrain=buildOfficeTerrain(layout.bounds);
  const {x,z}=layout.entrance;
  const ray=new THREE.Raycaster(new THREE.Vector3(x+12,20,z),new THREE.Vector3(0,-1,0));
  const [hit]=ray.intersectObject(terrain);
  assert.ok(Math.abs(hit.point.y-GROUND_LEVEL)<1e-6);
  for(const [x,z] of [[-83.1,-176.2],[-142.4,-224.5]]){
    ray.ray.origin.set(x,50,z);
    const [slope]=ray.intersectObject(terrain);
    assert.ok(Math.abs(slope.point.y-terrain.userData.elevationAt(x,z))<1e-5);
  }
  const shape=new THREE.Shape();
  shape.moveTo(-1,-1);shape.lineTo(1,-1);shape.lineTo(1,1);shape.lineTo(-1,1);shape.closePath();
  const paving=groundShapeGeometry(shape,1);
  const normals=paving.attributes.normal;
  for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>.999);
  paving.dispose();
  terrain.geometry.dispose();
  terrain.material.dispose();
});

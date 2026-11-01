import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/three.module.js';
import {beginCameraOrbit} from '../public/office-camera.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
const {OfficeScene}=await import('../public/office-scene.js');
const {SharedOfficeScene}=await import('../public/shared-office-scene.js');
delete globalThis.document;

function sceneFor(Scene,{zoom=1,executive=false}={}){
  const handlers=new Map();
  const view=Object.create(Scene.prototype);
  Object.assign(view,{
    element:{clientWidth:1200,clientHeight:800,classList:{toggle(){}}},
    renderer:{setSize(){},domElement:{
      addEventListener(type,handler){handlers.set(type,handler);},
      setPointerCapture(){},hasPointerCapture(){return false;},
    }},
    camera:new THREE.OrthographicCamera(-20,20,12,-12,.1,180),
    angle:.48,elevation:.72,zoom,viewTarget:new THREE.Vector3(),
    navigator:{executive},updateLabels(){},
    layout:{bounds:{minX:-35,maxX:22,minZ:-16,maxZ:24}},
  });
  OfficeScene.prototype.bindControls.call(view);
  view.resize();
  return {view,handlers};
}

function centreOnGround(view){
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(),view.camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
}

function assertCentred(view,pivot){
  const point=pivot.clone().project(view.camera);
  assert.ok(Math.abs(point.x)<1e-9,`centre drifted horizontally: ${point.x}`);
  assert.ok(Math.abs(point.y)<1e-9,`centre drifted vertically: ${point.y}`);
}

for(const Scene of [OfficeScene,SharedOfficeScene]){
  for(const zoom of [1,2.8,12]){
    test(`${Scene.name} Shift rotation preserves the visible centre and scale at ${zoom}x after panning`,()=>{
      const {view,handlers}=sceneFor(Scene,{zoom});
      handlers.get('pointerdown')({button:0,shiftKey:false,clientX:0,clientY:0,pointerId:1});
      handlers.get('pointermove')({clientX:160,clientY:-90});
      handlers.get('pointerup')({button:0,pointerId:1});
      const pivot=centreOnGround(view),span=view.camera.top-view.camera.bottom;
      // Orbit is about the viewport centre even when the drag starts elsewhere.
      handlers.get('pointerdown')({button:0,shiftKey:true,clientX:80,clientY:140,pointerId:2});
      for(const [x,y] of [[120,160],[400,200],[-300,260]]){
        handlers.get('pointermove')({clientX:x,clientY:y});
        assertCentred(view,pivot);
        assert.ok(Math.abs((view.camera.top-view.camera.bottom)-span)<1e-9,'rotation changed zoom');
      }
      handlers.get('pointerup')({button:0,pointerId:2});
      const frame={...view.orbitFrame};view.resize();
      assertCentred(view,pivot);assert.deepEqual(view.orbitFrame,frame);
      view.setZoom(zoom*.8);assertCentred(view,pivot);
      assert.ok(Math.abs((view.camera.top-view.camera.bottom)-span/ .8)<1e-9);
    });
  }
  test(`${Scene.name} keyboard rotation shares the viewport pivot`,()=>{
    const {view,handlers}=sceneFor(Scene),pivot=centreOnGround(view);
    handlers.get('keydown')({key:'ArrowRight',preventDefault(){}});
    assertCentred(view,pivot);
  });
  test(`${Scene.name} capturing the overview centre does not shift other map points`,()=>{
    const {view}=sceneFor(Scene),point=new THREE.Vector3(6,1,-4);
    const before=point.clone().project(view.camera);
    beginCameraOrbit(view);view.resize();
    const after=point.clone().project(view.camera);
    assert.ok(Math.abs(before.x-after.x)<1e-9);
    assert.ok(Math.abs(before.y-after.y)<1e-9);
  });
}

test('near-horizontal orbit keeps a finite pivot and does not jump on re-framing',()=>{
  const {view}=sceneFor(OfficeScene);
  view.elevation=0;view.viewTarget.set(4,2,-7);view.resize();
  beginCameraOrbit(view);const pivot=view.viewTarget.clone();view.resize();
  assert.ok(pivot.toArray().every(Number.isFinite));assertCentred(view,pivot);
});

test('tower overview reset restores automatic framing after orbit',()=>{
  const {view}=sceneFor(OfficeScene,{executive:true});
  beginCameraOrbit(view);view.resize();assert.ok(view.orbitFrame);
  view.resetView();assert.equal(view.orbitFrame,null);assert.equal(view.zoom,1);
});

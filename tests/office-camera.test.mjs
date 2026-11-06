import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/three.module.js';
import {beginCameraOrbit} from '../public/office-camera.js';
import {OfficeNavigator} from '../public/office-navigation.js';

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
      setPointerCapture(){},hasPointerCapture(){return false;},setAttribute(){},
    }},
    camera:new THREE.OrthographicCamera(-20,20,12,-12,.1,180),
    angle:.48,elevation:.72,zoom,viewTarget:new THREE.Vector3(),
    navigator:{executive},updateLabels(){},
    layout:{bounds:{minX:-35,maxX:22,minZ:-16,maxZ:24}},
  });
  OfficeScene.prototype.bindControls.call(view,()=>!view.catView);
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

test('tower bubble click selects the character and makes it the camera pivot',t=>{
  const {view,handlers}=sceneFor(OfficeScene,{zoom:3});
  const navigator=new OfficeNavigator();
  Object.assign(view,{
    navigator,actors:new Map(),world:new THREE.Group(),archiveRoomGroup:{},standardOuterWallsGroup:{},
    labelLayer:{append(){}},setExecutiveOffice(){},onSelectSession(id){this.selectedId=id;},
  });
  t.after(()=>{delete globalThis.document;});
  globalThis.document={createElement:()=>new EventTarget()};
  view.setSessions([{id:'staff',projectKey:'floor',active:false}],'floor');
  const {model,label}=view.actors.get('staff');
  model.root.position.set(4,.32,3);
  view.viewTarget.set(-8,0,-5);view.resize();
  const centre=model.body.localToWorld(new THREE.Vector3(0,.8,0));
  const span=view.camera.top-view.camera.bottom;
  label.dispatchEvent(new Event('click'));
  assert.equal(view.selectedId,'staff');
  assertCentred(view,centre);
  assert.ok(Math.abs((view.camera.top-view.camera.bottom)-span)<1e-9);
  handlers.get('keydown')({key:'ArrowRight',preventDefault(){}});
  assertCentred(view,centre);
});

test('shared-office selection centres the rendered character after movement during the transition',t=>{
  const {view}=sceneFor(SharedOfficeScene);
  const root=new THREE.Group(),body=new THREE.Group();
  root.position.set(2,.32,5);root.add(body);
  const label={classList:{remove(){},toggle(){}},setAttribute(){}};
  const model={root,body,selection:{visible:false}};
  Object.assign(view,{
    actors:[{id:'staff',model,label}],
    executive:{owner:{selection:{}},ownerLabel:label,floors:new Map(),update(){},patrol:{},spouseTargets(){}},
    cats:[],visitor:{update(){}},roomMeshes:new Map(),motion:true,
    updateLighting(){},updateActor(){root.position.x+=3;},renderer:{...view.renderer,render(){}},
    lastTime:performance.now(),
  });
  t.after(()=>{delete globalThis.document;delete globalThis.requestAnimationFrame;});
  globalThis.document={hidden:false};
  globalThis.requestAnimationFrame=()=>1;

  view.selectActor('staff');
  view.frame(view.transition.start+651);

  assert.equal(view.transition,null);
  assert.equal(model.selection.visible,true);
  assertCentred(view,body.localToWorld(new THREE.Vector3(0,.8,0)));
});

test('cat view follows the animated head and returns to the same map framing',t=>{
  const {view,handlers}=sceneFor(SharedOfficeScene,{zoom:2});
  const root=new THREE.Group(),head=new THREE.Group();
  root.scale.set(.6,.7,.8);
  root.add(head);head.position.set(0,.65,.35);
  const model={
    root,head,appearance:{name:'토양이'},action:'walk',
    update(){root.position.set(3,.16,-4);root.rotation.y=Math.PI/2;head.rotation.x=.25;},
  };
  const cameras=[],views=[];
  const label={dataset:{action:'walk'},classList:{remove(){},toggle(){}},setAttribute(){}};
  Object.assign(view,{
    catCamera:new THREE.PerspectiveCamera(65,1,.035,180),catLookTarget:new THREE.Vector3(),
    cats:[{model,label}],labelLayer:{hidden:false},actors:[],roomMeshes:new Map(),
    executive:{owner:{selection:{}},ownerLabel:label,floors:new Map(),update(){},patrol:{},spouseTargets(){}},
    visitor:{update(){}},updateLighting(){},onCatView:name=>views.push(name),
    lastTime:performance.now(),renderer:{...view.renderer,render(_scene,camera){cameras.push(camera);}},
  });
  t.after(()=>{delete globalThis.document;delete globalThis.requestAnimationFrame;});
  globalThis.document={hidden:false};
  globalThis.requestAnimationFrame=()=>1;

  const mapPosition=view.camera.position.clone(),mapAngle=view.angle;
  view.selectCat(model);
  const initialEye=view.catCamera.position.clone();
  handlers.get('keydown')({key:'ArrowRight',preventDefault(){}});
  view.frame(view.lastTime+16);

  assert.equal(view.labelLayer.hidden,true);
  assert.equal(cameras.at(-1),view.catCamera);
  assert.notDeepEqual(view.catCamera.position,initialEye);
  const eye=head.localToWorld(new THREE.Vector3(0,.015,.31));
  const forward=head.localToWorld(new THREE.Vector3(0,.015,1.31)).sub(eye).normalize();
  assert.ok(view.catCamera.position.distanceTo(eye)<1e-9);
  assert.ok(view.catCamera.getWorldDirection(new THREE.Vector3()).distanceTo(forward)<1e-9);
  view.element.clientWidth=480;view.resize();
  assert.equal(view.catCamera.aspect,480/800);

  view.leaveCatView();
  view.frame(view.lastTime+16);
  assert.equal(cameras.at(-1),view.camera);
  assert.equal(view.labelLayer.hidden,false);
  assert.equal(view.angle,mapAngle);
  assert.deepEqual(view.camera.position,mapPosition);
  assert.deepEqual(views,['토양이',null]);
});

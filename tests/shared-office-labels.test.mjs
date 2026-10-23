import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three/three.module.js';
import {labelDetail,labelConnector,placeLabel,followLabelAnchor,projectHead} from '../public/shared-office-labels.js';

test('work and direct interaction retain full detail at every apparent size',()=>{
  for(const headPixels of [0,3,14,16,25,60]){
    assert.equal(labelDetail({working:true,headPixels}),'full');
    assert.equal(labelDetail({selected:true,headPixels}),'full');
  }
  assert.equal(labelDetail({engaged:true,headPixels:0}),'compact');
  assert.equal(labelDetail({headPixels:10}),'compact');
  assert.equal(labelDetail({headPixels:19}),'compact');
  assert.equal(labelDetail({headPixels:25}),'compact');
  assert.equal(labelDetail({headPixels:31}),'compact');
  assert.equal(labelDetail({headPixels:32}),'full');
  assert.equal(labelDetail({headPixels:29,previous:'full'}),'full');
  assert.equal(labelDetail({headPixels:29,previous:'compact'}),'compact');
  assert.equal(labelDetail({headPixels:27,previous:'full'}),'compact');
});

test('connectors end at the exact head point on all sides of the bubble',()=>{
  const box={x:100,y:100,w:220,h:80};
  for(const anchor of [{x:50,y:20},{x:380,y:230},{x:180,y:250},{x:360,y:120}]){
    const c=labelConnector(anchor,box);
    assert.equal(c.endX,anchor.x);assert.equal(c.endY,anchor.y);
    assert.ok(c.x>=box.x&&c.x<=box.x+box.w&&c.y>=box.y&&c.y<=box.y+box.h);
    assert.ok(c.x===box.x||c.x===box.x+box.w||c.y===box.y||c.y===box.y+box.h);
  }
});

test('crowded labels stay near their owners instead of spreading across the office',()=>{
  const placed=[],viewport={width:1100,height:700},anchor={x:550,y:350};
  for(let i=0;i<60;i++){
    const result=placeLabel(anchor,{w:220,h:100},viewport,placed);
    assert.ok(Math.hypot(result.connector.x-anchor.x,result.connector.y-anchor.y)<=80);
    assert.ok(result.box.x>=8&&result.box.y>=8);
    assert.ok(result.box.x+result.box.w<=viewport.width-8);
    assert.ok(result.box.y+result.box.h<=viewport.height-8);
    placed.push(result.box);
  }
  const first=placeLabel(anchor,{w:220,h:100},viewport);
  assert.deepEqual(placeLabel(anchor,{w:220,h:100},viewport,[],first.index).box,first.box);
});

test('edge and tall bubbles stay inside the viewport while their lines retain the head endpoint',()=>{
  for(const anchor of [{x:1,y:1},{x:319,y:1},{x:1,y:539},{x:319,y:539}]){
    const {box,connector}=placeLabel(anchor,{w:220,h:524},{width:320,height:540});
    assert.ok(box.x>=8&&box.x+box.w<=312);
    assert.ok(box.y>=8&&box.y+box.h<=532);
    assert.equal(connector.endX,anchor.x);assert.equal(connector.endY,anchor.y);
  }
});

test('camera movement carries each label with its owner without moving its neighbours',()=>{
  const viewport={width:900,height:600},size={w:180,h:56};
  const first={x:310,y:270},second={x:470,y:275};
  const firstBox=placeLabel(first,size,viewport).box,secondBox=placeLabel(second,size,viewport,[firstBox]).box;
  const movedFirst={x:360,y:320},movedSecond={x:520,y:325};
  const carriedFirst=followLabelAnchor(movedFirst,size,viewport,firstBox,first);
  const carriedSecond=followLabelAnchor(movedSecond,size,viewport,secondBox,second);
  assert.equal(carriedFirst.x-firstBox.x,movedFirst.x-first.x);
  assert.equal(carriedFirst.y-firstBox.y,movedFirst.y-first.y);
  assert.equal(carriedSecond.x-secondBox.x,movedSecond.x-second.x);
  assert.equal(carriedSecond.y-secondBox.y,movedSecond.y-second.y);
});

test('head projection follows parent rotation, sofa lift, sitting and head pose before rendering',()=>{
  const suite=new THREE.Group(),root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group();
  suite.add(root);root.add(body);body.add(head);head.position.set(0,1.2,0);
  suite.position.set(3,0,-2);suite.rotation.y=.7;root.position.set(2,.32,1);body.position.y=.29;head.rotation.x=.18;
  const model={root,head},camera=new THREE.OrthographicCamera(-12,12,8,-8,.1,200);
  for(const elevation of [12,45,89])for(const angle of [0,90,180,270]){
    const e=elevation*Math.PI/180,a=angle*Math.PI/180;
    camera.position.set(Math.sin(a)*Math.cos(e)*60,Math.sin(e)*60,Math.cos(a)*Math.cos(e)*60);
    camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const result=projectHead(model,camera,1200,800);
    // Compute independently through each local transform; no walker or fixed y.
    const expected=new THREE.Vector3(0,.44,0).applyEuler(head.rotation).add(head.position)
      .add(body.position).applyEuler(root.rotation).add(root.position).applyEuler(suite.rotation).add(suite.position).project(camera);
    assert.ok(Math.abs(result.anchor.x-(expected.x+1)*600)<1e-8);
    assert.ok(Math.abs(result.anchor.y-(1-expected.y)*400)<1e-8);
    assert.equal(result.visible,true);
  }
  const before=projectHead(model,camera,1200,800);root.position.x+=1;
  const moved=projectHead(model,camera,1200,800);assert.notDeepEqual(moved.anchor,before.anchor);
  camera.top=4;camera.bottom=-4;camera.updateProjectionMatrix();
  assert.equal(projectHead(model,camera,1200,800).headPixels,before.headPixels*2);
  root.position.x=10000;assert.equal(projectHead(model,camera,1200,800).visible,false);
});

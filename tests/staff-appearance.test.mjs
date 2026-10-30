import test from 'node:test';
import assert from 'node:assert/strict';
import {staffAppearance,colorHex} from '../public/staff-appearance.js';
import {StaffIdentities} from '../public/staff-identities.js';
import {characterSvg} from '../public/office-art.js';
import * as THREE from '../public/vendor/three/three.module.js';

const wardrobe=look=>JSON.stringify([look.top,look.bottom,look.style,look.pattern,look.accent]);
const face=look=>JSON.stringify([look.hair,look.skin,look.hairStyle,look.faceWidth,look.faceHeight,look.eyeSpacing]);

test('the full local session capacity has no duplicate outfits or twin faces, including the old repeat interval',()=>{
  const clothes=new Set(),faces=new Set();
  for(let index=0;index<5000;index++){
    const look=staffAppearance(index);
    assert.ok(!clothes.has(wardrobe(look)),`duplicate outfit at ${index}`);clothes.add(wardrobe(look));
    assert.ok(!faces.has(face(look)),`twin face at ${index}`);faces.add(face(look));
  }
  assert.notEqual(wardrobe(staffAppearance(0)),wardrobe(staffAppearance(480)));
  assert.notEqual(wardrobe(staffAppearance(0)),wardrobe(staffAppearance(69120)));
});

test('saved employees retain their appearance after reordering, new hires and registry reloads',()=>{
  const identities=new StaffIdentities(),sessions=Array.from({length:200},(_,i)=>({id:`employee-${i}`}));
  const original=identities.assign(sessions);
  const reloaded=new StaffIdentities(JSON.parse(JSON.stringify(identities.registry)));
  const updated=reloaded.assign([{id:'new-hire'},...sessions.toReversed()]);
  for(const previous of original){
    const next=updated.find(item=>item.id===previous.id);
    assert.deepEqual(next.identity,previous.identity);
    assert.deepEqual(staffAppearance(next.identity.index),staffAppearance(previous.identity.index));
  }
  assert.equal(new Set(updated.map(item=>wardrobe(staffAppearance(item.identity.index)))).size,updated.length);
});

test('roster portraits keep the same clothes across rooms and match the shared appearance colors',()=>{
  for(const index of [0,7,32,100,480,4999]){
    const look=staffAppearance(index);
    for(const room of ['studio','library','server','research','meeting','desk']){
      const svg=characterSvg(room,{index,palette:room});
      for(const color of [look.top,look.bottom,look.hair,look.skin,look.shoes])assert.ok(svg.includes(colorHex(color)));
      assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('undefined'));
    }
  }
});

const modelSignature=model=>{
  const meshes=[];
  model.root.traverse(object=>{if(object.isMesh)meshes.push([object.geometry.type,object.material.color.getHex(),object.position.toArray(),object.scale.toArray()]);});
  return JSON.stringify([model.root.scale.toArray(),model.body.scale.toArray(),model.head.scale.toArray(),meshes]);
};
test('both office renderers produce distinct models and preserve clothes when a worker changes rooms',async()=>{
  // The scene module initializes an unrelated desktop-screen canvas on import.
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  let createCharacter,disposeCharacter;
  try{({createCharacter,disposeCharacter}=await import('../public/office-scene.js'));}
  finally{delete globalThis.document;}
  const models=new Set(),parent=new THREE.Group();
  for(let index=0;index<64;index++){
    const studio=createCharacter(parent,'studio',{index}),meeting=createCharacter(parent,'meeting',{index});
    const signature=modelSignature(studio);
    assert.equal(modelSignature(meeting),signature);
    assert.ok(!models.has(signature),`duplicate rendered employee ${index}`);models.add(signature);
    const colors=new Set();studio.root.traverse(object=>{if(object.isMesh)colors.add(object.material.color.getHex());});
    const look=staffAppearance(index);for(const color of [look.top,look.bottom,look.shoes])assert.ok(colors.has(color));
    for(const model of [studio,meeting]){disposeCharacter(model);parent.remove(model.root);}
  }
});

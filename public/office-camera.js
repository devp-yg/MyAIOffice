import * as THREE from './vendor/three/three.module.js';

export function beginCameraOrbit(view){
  view.transition=null;
  // A symmetric frame already orbits around viewTarget, including elevated targets.
  if(view.orbitFrame)return;
  const {camera,viewTarget,zoom}=view;
  if(camera.isPerspectiveCamera){
    view.orbitFrame={distance:camera.position.distanceTo(viewTarget)*zoom};
    return;
  }
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0,0),camera);
  const pivot=new THREE.Vector3();
  // The screen centre can differ from viewTarget in an off-centre overview.
  // Use the map beneath it; near the horizon retain the current target depth.
  const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  if(Math.abs(ray.ray.direction.y)<.05||!ray.ray.intersectPlane(ground,pivot)){
    ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(ray.ray.direction,viewTarget),pivot);
  }
  viewTarget.copy(pivot);
  view.orbitFrame={halfWidth:(camera.right-camera.left)*zoom/2,halfHeight:(camera.top-camera.bottom)*zoom/2};
}

export function characterFocusPoint(model,target=new THREE.Vector3()){
  return model.body.localToWorld(target.set(0,.8,0));
}

export function orbitHalfHeight(view,aspect){
  return Math.max(view.orbitFrame.halfHeight,view.orbitFrame.halfWidth/aspect)/view.zoom;
}

export function panCamera(view,start,dx,dy){
  const {camera,viewTarget,width}=view;
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  let span;
  if(camera.isPerspectiveCamera){
    span=2*camera.position.distanceTo(viewTarget)/camera.projectionMatrix.elements[0];
    const slope=Math.max(.35,Math.hypot(up.x,up.z));
    up.set(right.z,0,-right.x).divideScalar(slope);
  }else span=camera.right-camera.left;
  viewTarget.copy(start).addScaledVector(right,-dx*span/width).addScaledVector(up,dy*span/width);
}

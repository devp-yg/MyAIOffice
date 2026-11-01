import * as THREE from './vendor/three/three.module.js';

export function beginCameraOrbit(view){
  const {camera,viewTarget,zoom}=view;
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
  view.transition=null;
}

export function orbitHalfHeight(view,aspect){
  return Math.max(view.orbitFrame.halfHeight,view.orbitFrame.halfWidth/aspect)/view.zoom;
}

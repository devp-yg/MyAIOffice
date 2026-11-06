import * as THREE from './vendor/three/three.module.js';

const radians=degrees=>degrees*Math.PI/180;
const smooth=(from,to,value)=>THREE.MathUtils.smoothstep(value,from,to);
const nightHorizon=new THREE.Color('#45546a'),dayHorizon=new THREE.Color('#d6e1d6'),duskHorizon=new THREE.Color('#dca485');
const nightZenith=new THREE.Color('#111d35'),dayZenith=new THREE.Color('#72acd4'),duskZenith=new THREE.Color('#586d92');

const fragmentShader=`
  varying vec2 vUv;
  uniform float daylight, twilight, night, phaseCosine, sunVisible, moonVisible;
  uniform vec3 sun, moon, zenith, horizon;
  uniform mat4 cameraWorld, projectionInverse;

  float hash(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }

  float stars(vec2 p) {
    vec2 cell=floor(p);
    vec2 offset=vec2(hash(cell),hash(cell+12.3));
    float radius=mix(.036,.085,hash(cell-3.2));
    float edge=clamp(length(fwidth(p))*.5,.008,.08);
    float star=1.0-smoothstep(max(0.0,radius-edge),radius+edge,length(fract(p)-.2-.6*offset));
    return star*smoothstep(.44,1.0,hash(cell+8.5));
  }

  void main() {
    vec4 eye=projectionInverse*vec4(vUv*2.0-1.0,1.0,1.0);
    vec3 ray=normalize(mat3(cameraWorld)*eye.xyz);
    float sunRadius=length(ray-sun)/.022;
    float moonRadius=length(ray-moon)/.017;
    float moonLightSide=dot(ray-moon,sun)/.017;

    vec3 color=mix(horizon,zenith,pow(max(0.0,ray.y),.55));
    color+=vec3(.26,.092,.030)*exp(-sunRadius*.48)*sunVisible;
    color+=vec3(.14,.052,.021)*exp(-sunRadius*.055)*twilight;
    vec2 starGrid=vec2(atan(ray.x,ray.z)*25.0,ray.y*63.0);
    color+=vec3(.68,.76,1.0)*stars(starGrid)*night*smoothstep(.016,.19,ray.y);
    color=mix(color,vec3(1.0,.86,.49),(1.0-smoothstep(.92,1.04,sunRadius))*sunVisible);

    float phase=moonLightSide-phaseCosine*sqrt(max(0.0,1.0-moonRadius*moonRadius));
    float lunarDisc=(1.0-smoothstep(.92,1.04,moonRadius))*moonVisible;
    color=mix(color,vec3(.80,.87,.96),lunarDisc*smoothstep(-.04,.04,phase)*mix(.95,.72,daylight));
    gl_FragColor=vec4(color,1.0);
    #include <colorspace_fragment>
  }
`;

export class SharedOfficeSky {
  constructor(scene){
    this.fog=scene.fog=new THREE.Fog(dayHorizon,110,420);
    this.uniforms={
      daylight:{value:1},twilight:{value:0},night:{value:0},
      sun:{value:new THREE.Vector3()},moon:{value:new THREE.Vector3()},phaseCosine:{value:0},sunVisible:{value:0},moonVisible:{value:0},
      cameraWorld:{value:new THREE.Matrix4()},projectionInverse:{value:new THREE.Matrix4()},
      horizon:{value:this.fog.color},zenith:{value:dayZenith.clone()},
    };
    const geometry=new THREE.PlaneGeometry(2,2);
    const material=new THREE.ShaderMaterial({
      uniforms:this.uniforms,depthTest:false,depthWrite:false,
      vertexShader:'varying vec2 vUv; void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader,
    });
    this.mesh=new THREE.Mesh(geometry,material);
    this.mesh.frustumCulled=false;
    this.mesh.renderOrder=-100;
    scene.add(this.mesh);
  }
  update({sun,moon,phaseCosine}){
    const u=this.uniforms, daylight=smooth(radians(-8),radians(12),sun.altitude);
    const twilight=smooth(radians(-14),radians(-2),sun.altitude)*(1-smooth(radians(0),radians(14),sun.altitude));
    u.daylight.value=daylight;
    u.twilight.value=twilight;
    u.night.value=1-smooth(radians(-16),radians(-4),sun.altitude);
    u.sun.value.fromArray(sun.direction);
    u.moon.value.fromArray(moon.direction);
    u.phaseCosine.value=phaseCosine;
    u.sunVisible.value=smooth(radians(-1.5),radians(1.5),sun.altitude);
    u.moonVisible.value=smooth(radians(-1),radians(2),moon.altitude);
    this.fog.color.copy(nightHorizon).lerp(dayHorizon,daylight).lerp(duskHorizon,twilight);
    u.zenith.value.copy(nightZenith).lerp(dayZenith,daylight).lerp(duskZenith,twilight);
    return daylight;
  }
  orient(camera){
    this.uniforms.cameraWorld.value=camera.matrixWorld;
    this.uniforms.projectionInverse.value=camera.projectionMatrixInverse;
  }
  dispose(){
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

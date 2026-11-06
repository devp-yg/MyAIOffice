import * as THREE from './vendor/three/three.module.js';

export const WORLD_DISTANCE=850;
export const GROUND_LEVEL=-.18;
const SKYLINE_DISTANCE=249;
export const CITY_CAMERA_LIMIT=SKYLINE_DISTANCE-74;

const contains=(x,z,r)=>x>r[0]&&x<r[1]&&z>r[2]&&z<r[3];

// Union the orthogonal paths and cut out room footprints. Junctions share one
// surface, so there are no overlapping strips, flickering faces or stray curves.
export function circulationSurface(paths,excluded=[]){
  const rects=paths.map(path=>path.bounds),all=[...rects,...excluded];
  const xs=[...new Set(all.flatMap(r=>r.slice(0,2)))].sort((a,b)=>a-b),zs=[...new Set(all.flatMap(r=>r.slice(2)))].sort((a,b)=>a-b);
  const occupied=new Set(),cells=[],edges=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
    if(rects.some(r=>contains(x,z,r))&&!excluded.some(r=>contains(x,z,r))){occupied.add(`${i},${j}`);cells.push([xs[i],xs[i+1],zs[j],zs[j+1]]);}
  }
  for(const key of occupied){
    const [i,j]=key.split(',').map(Number),x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1];
    if(!occupied.has(`${i-1},${j}`))edges.push([[x0,z0],[x0,z1]]);
    if(!occupied.has(`${i+1},${j}`))edges.push([[x1,z0],[x1,z1]]);
    if(!occupied.has(`${i},${j-1}`))edges.push([[x0,z0],[x1,z0]]);
    if(!occupied.has(`${i},${j+1}`))edges.push([[x0,z1],[x1,z1]]);
  }
  return {cells,edges};
}

function roundedRect([x0,x1,z0,z1],radius=.5){
  const r=Math.min(radius,(x1-x0)/2,(z1-z0)/2),s=new THREE.Shape();
  s.moveTo(x0+r,z0);s.lineTo(x1-r,z0);s.quadraticCurveTo(x1,z0,x1,z0+r);s.lineTo(x1,z1-r);s.quadraticCurveTo(x1,z1,x1-r,z1);s.lineTo(x0+r,z1);s.quadraticCurveTo(x0,z1,x0,z1-r);s.lineTo(x0,z0+r);s.quadraticCurveTo(x0,z0,x0+r,z0);return s;
}

// Shape coordinates use world X/Z. Reverse the triangles after laying the
// shape flat so its upward normals also agree with directional shadow bias.
export function groundShapeGeometry(shape,segments){
  const geometry=new THREE.ShapeGeometry(shape,segments);
  geometry.rotateX(Math.PI/2);
  const index=geometry.index.array;
  for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
  geometry.computeVertexNormals();
  return geometry;
}

function floorTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#faf9f3';ctx.fillRect(0,0,256,256);
  let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  if(kind==='wood'){
    for(let i=0;i<8;i++){
      ctx.fillStyle=`rgba(137,114,82,${.025+random()*.045})`;ctx.fillRect(i*32,0,32,256);
      ctx.fillStyle='rgba(105,88,65,.15)';ctx.fillRect(i*32,0,1.2,256);ctx.fillRect(i*32,(i%2)*128,32,1);
      for(let g=0;g<24;g++){ctx.strokeStyle=`rgba(119,97,67,${.012+random()*.025})`;ctx.beginPath();const x=i*32+random()*30;ctx.moveTo(x,0);ctx.bezierCurveTo(x+4,80,x-4,180,x+1,256);ctx.stroke();}
    }
  }else{
    const step=kind==='technical'?64:128;
    ctx.strokeStyle=kind==='technical'?'rgba(87,108,111,.18)':'rgba(133,123,103,.18)';ctx.lineWidth=1;
    for(let i=0;i<=256;i+=step){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}
    for(let i=0;i<2800;i++){ctx.fillStyle=`rgba(127,123,108,${random()*.06})`;ctx.fillRect(random()*256,random()*256,1,1);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(.5,.5);texture.anisotropy=4;return texture;
}

const BUILDING_COLORS=['#c9ba9e','#aab6b4','#bd9f89','#dad1bb','#9daab2'];
const WINDOW_COLORS=['#667f85','#839ba0'];

function officeDistricts({minX,maxX,minZ,maxZ}){
  return [
    {x:minX-28,z:minZ-83,width:43,depth:23,buildings:[
      [-15,-6.8,8,7,5.3,2],[-4,-6.8,10,7.5,9.4,0],[11,-6.8,12,8,7.2,1],
      [-12,6.5,11,6,4.2,3],[3,6.5,10,7,5.7,2],[15,6.5,7,6,4.7,4],
    ]},
    {x:maxX+21,z:minZ-106,width:37,depth:23,buildings:[
      [-11,-6.8,9,7,7.2,1],[0,-6.8,8,7,10.2,4],[11,-6.8,9,8,8,0],
      [-10,6.5,10,6.5,4.7,2],[5,6.5,12,7,5.2,3],
    ]},
    {x:minX-92,z:(minZ+maxZ)/2-12,width:34,depth:22,buildings:[
      [-9,-6.5,10,7,7.3,3],[6,-6.5,12,7,8.1,4],
      [-10,6.2,8,6,4.7,0],[1,6.2,8,6,5.5,1],[12,6.2,7,6,4,2],
    ]},
  ];
}

function districtRoads([northwest,northeast,west]){
  const link=(from,to)=>{
    const start=new THREE.Vector2(from.x+from.width/2-.25,from.z);
    const end=new THREE.Vector2(to.x-to.width/2+.25,to.z);
    return new THREE.CubicBezierCurve(
      start,new THREE.Vector2(start.x+12,start.y),new THREE.Vector2(end.x-14,end.y),end,
    );
  };
  return [link(west,northwest),link(northwest,northeast)];
}

function roadShape(curve){
  const shape=new THREE.Shape();
  for(const side of [1,-1]){
    for(let i=0;i<=24;i++){
      const t=(side===1?i:24-i)/24;
      const point=curve.getPoint(t),tangent=curve.getTangent(t);
      const x=point.x-tangent.y*side*2.25,z=point.y+tangent.x*side*2.25;
      if(side===1&&i===0)shape.moveTo(x,z);
      else shape.lineTo(x,z);
    }
  }
  shape.closePath();
  return shape;
}

function skylineCenter(bounds){
  return new THREE.Vector2((bounds.minX+bounds.maxX)/2-117,bounds.minZ-SKYLINE_DISTANCE);
}

function buildCityRoad(bounds,localRoad,elevationAt){
  const start=localRoad.getPoint(.21),end=skylineCenter(bounds);
  const curve=new THREE.CubicBezierCurve(
    start,new THREE.Vector2(start.x-5,start.y-38),new THREE.Vector2(end.x+49,end.y+57),end,
  );
  const rows=Math.ceil(curve.getLength()/1.5),positions=[],indices=[];
  for(let row=0;row<=rows;row++){
    const t=row/rows,point=curve.getPointAt(t),tangent=curve.getTangentAt(t);
    const lift=THREE.MathUtils.lerp(.16,.24,Math.min(1,t*8));
    for(const offset of [-2.65,0,2.65]){
      const x=point.x-tangent.y*offset,z=point.y+tangent.x*offset;
      positions.push(x,elevationAt(x,z)+lift,z);
    }
    if(row===rows)continue;
    const i=row*3;
    indices.push(i,i+1,i+3,i+1,i+4,i+3,i+1,i+2,i+4,i+2,i+5,i+4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildOfficeDistricts(districts,box,window,tree){
  const streetLevel=GROUND_LEVEL+.11;
  for(const [districtIndex,{x,z,width,depth,buildings}] of districts.entries()){
    box('#c8c4ad',x,streetLevel-.13,z,width,.26,depth);
    box('#808b88',x,streetLevel+.012,z,width-.5,.024,4.5);
    for(const side of [-1,1])box('#e0d9c4',x,streetLevel+.09,z+side*2.45,width-.5,.13,.62);
    for(let laneX=x-width/2+3;laneX<x+width/2-2;laneX+=4.5)box('#d3cdb5',laneX,streetLevel+.033,z,1.6,.012,.12);

    for(const [index,[dx,dz,w,d,h,palette]] of buildings.entries()){
      const bx=x+dx,bz=z+dz;
      box(BUILDING_COLORS[palette],bx,streetLevel+h/2,bz,w,h,d);
      box('#c1bdae',bx,streetLevel+h,bz,w+.19,.18,d+.19);
      box('#b0b4a7',bx-w*.17,streetLevel+h+.39,bz+d*.14,w*.23,.65,d*.24);
      const floors=Math.max(1,Math.floor((h-.6)/2.15));
      const columns=Math.max(2,Math.floor((w-1)/2));
      const sideColumns=Math.max(1,Math.floor((d-1)/2.5));
      for(let floor=0;floor<floors;floor++){
        const wy=streetLevel+1.5+floor*2.05;
        for(const side of [-1,1]){
          for(let col=0;col<columns;col++){
            const wx=bx+(col-(columns-1)/2)*(w-.95)/columns;
            const pattern=(districtIndex*3+index+floor*2+col*3+side)%5;
            window(wx,wy,bz+side*(d/2+.02),1.03,1.02,.045,pattern===0,pattern===2);
          }
          for(let col=0;col<sideColumns;col++){
            const wz=bz+(col-(sideColumns-1)/2)*(d-.9)/sideColumns;
            window(bx+side*(w/2+.02),wy,wz,.045,.92,.88,(index+floor+col+side)%5===0,false);
          }
        }
      }
      const front=bz-Math.sign(dz)*d/2;
      box('#637b78',bx,streetLevel+.94,front,.95,1.88,.12);
      if(h<6)box('#a17d62',bx,streetLevel+2.15,front-Math.sign(dz)*.26,w*.46,.13,.64);
    }
    for(const side of [-1,1])tree(x+side*(width/2-1.6),z+side*3.35,1.1,streetLevel);
  }
}

function buildDistantSkyline(bounds,box,window){
  const center=skylineCenter(bounds);
  const colors=['#768a96','#81939b','#8999a3'];
  const rows=[
    {offset:0,heights:[19,27,23,39,25,33,22,44,31,25,37,27,21,33,25,19]},
    {offset:35,heights:[21,31,26,43,35,52,29,61,37,71,48,34,58,41,29,24]},
  ];
  for(const [row,{offset,heights}] of rows.entries()){
    for(const [index,profileHeight] of heights.entries()){
      const height=profileHeight*.90;
      const across=(index-(heights.length-1)/2)*11+(row?3:0);
      const x=center.x+across*.89-offset*.46;
      const z=center.y-across*.46-offset*.89;
      const width=6.5+(index*5%5.5),depth=7+(index*3%5);
      const color=colors[(row+index)%colors.length];
      const base=GROUND_LEVEL-2;
      const crown=profileHeight>=52?height*.19:0;
      box(color,x,base+(height-crown)/2,z,width,height-crown,depth);
      if(profileHeight>=29&&(index+row)%3===1){
        const top=base+height-crown;
        for(let level=0;level<5;level++){
          const y=top-3-level*3.8;
          if(y<base+height*.49)break;
          const windowOffset=(level%3-1)*width*.23;
          window(color,x+windowOffset,y,z+depth/2+.035,1.14,1.35,.055);
          if(level%2===0)window(color,x+width/2+.035,y,z-depth*.18,.055,1.35,1.14);
        }
      }
      if(crown){
        const shoulder=base+height-crown;
        box(color,x,shoulder+crown*.31,z,width*.71,crown*.62,depth*.76);
        box(color,x,shoulder+crown*.81,z,width*.46,crown*.38,depth*.53);
      }
      if(profileHeight>=61){
        const mast=profileHeight>=70?6:3.5;
        box(color,x,base+height+mast/2,z,.56,mast,.56);
      }
    }
  }
}

export function buildSharedGround(parent,layout,terrain){
  const group=new THREE.Group();parent.add(group);
  const geometries=new Set(),materials=new Set(),textures=new Map(),mats=new Map(),fixtures=[];
  const ownGeometry=g=>(geometries.add(g),g),cube=ownGeometry(new THREE.BoxGeometry(1,1,1)),sphere=ownGeometry(new THREE.SphereGeometry(1,12,8)),cyl=ownGeometry(new THREE.CylinderGeometry(1,1,1,20));
  const mat=color=>{if(!mats.has(color)){const m=new THREE.MeshStandardMaterial({color,roughness:.9});mats.set(color,m);materials.add(m);}return mats.get(color);};
  const make=(g,m,x,y,z,w=1,h=1,d=1)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.receiveShadow=true;mesh.userData.landscape=true;group.add(mesh);return mesh;};
  const box=(color,x,y,z,w,h,d)=>make(cube,mat(color),x,y,z,w,h,d);
  const surface=(rect,color,y,r=.4)=>{return make(ownGeometry(groundShapeGeometry(roundedRect(rect,r),10)),mat(color),0,y,0);};
  const texture=room=>{const kind=['library','meeting','desk'].includes(room)?'wood':room==='server'?'technical':'stone';if(!textures.has(kind))textures.set(kind,floorTexture(kind));return textures.get(kind);};
  const glow=new THREE.MeshStandardMaterial({color:0xffe3ac,emissive:0xffd18b,emissiveIntensity:.04,roughness:.6});materials.add(glow);
  const {park,landscape,circulation,executive,rooms}=layout;
  surface(park.bounds,'#ddd9ca',-.007,.8);
  const {minX,maxX,minZ,maxZ}=layout.bounds;
  const {x,z}=layout.entrance;
  const approach=new THREE.Shape();
  approach.moveTo(x+3.55,z-1.18);
  approach.bezierCurveTo(x+11,z-1.18,x+16,z-6.2,x+25,z-6.2);
  approach.quadraticCurveTo(x+27,z-5.9,x+26.2,z-4.4);
  approach.bezierCurveTo(x+18,z-4.4,x+12,z+1.18,x+3.55,z+1.18);
  approach.closePath();
  make(ownGeometry(groundShapeGeometry(approach,16)),mat('#c4b99d'),0,GROUND_LEVEL+.04,0);
  const {cells,edges}=circulationSurface(circulation.paths,[...rooms.map(room=>room.bounds),executive.bounds]);
  const vertices=[],uv=[];
  for(const [x0,x1,z0,z1]of cells){for(const [x,z]of [[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]){vertices.push(x,.026,z);uv.push(x,z);}}
  const pavingGeometry=ownGeometry(new THREE.BufferGeometry());pavingGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));pavingGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));pavingGeometry.computeVertexNormals();
  const pavingMaterial=new THREE.MeshStandardMaterial({color:0xe4ddcc,map:texture('stone'),roughness:.95,side:THREE.DoubleSide});materials.add(pavingMaterial);make(pavingGeometry,pavingMaterial,0,0,0);
  // Thin brass edging and flush light inserts follow the union perimeter.
  const edgeVertices=edges.flatMap(([a,b])=>[a[0],.043,a[1],b[0],.043,b[1]]),edgeGeometry=ownGeometry(new THREE.BufferGeometry());edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edgeVertices,3));
  const edgeMaterial=new THREE.LineBasicMaterial({color:0xae9e7e,transparent:true,opacity:.6});materials.add(edgeMaterial);const outline=new THREE.LineSegments(edgeGeometry,edgeMaterial);outline.userData.landscape=true;group.add(outline);
  for(const [a,b]of edges){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1.6)continue;
    for(let d=.8;d<length;d+=2.8){const t=d/length,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;make(cube,glow,x,.052,z,a[0]===b[0]?.045:.28,.014,a[0]===b[0]?.28:.045);}
  }
  // Gravel margins, meadow planting and timber seats repeat along the streets
  // as well as the courtyard, with all solid footprints shared by navigation.
  const beds=[...park.beds,...landscape.beds];
  for(const [index,bed]of beds.entries()){
    surface([bed[0]-.12,bed[1]+.12,bed[2]-.12,bed[3]+.12],'#bdb69e',.065,.45);
    surface(bed,'#d5cfba',.085,.38);
    surface([bed[0]+.17,bed[1]-.17,bed[2]+.17,bed[3]-.17],'#a5b98b',.09,.3);
    const width=bed[1]-bed[0],depth=bed[3]-bed[2];
    for(let k=0;k<28;k++){
      const t=(k+.5)/28,x=k%2?bed[0]+.1:bed[1]-.1,z=bed[2]+t*depth;
      make(sphere,mat(['#b8b2a2','#eee6d5','#c5bda9'][k%3]),x,.12,z,.055+(k%3)*.012,.035,.065);
    }
    for(let k=0;k<Math.max(8,Math.ceil(width*depth*1.2));k++){
      const x=bed[0]+.25+((k*.61803398875+index*.37)%1)*(width-.5),z=bed[2]+.3+((k*.41421356237)%1)*(depth-.6);
      const green=['#718c62','#8fa976','#a6b68a'][k%3];
      make(sphere,mat(green),x,.21,z,.16,.14,.17);
      for(let blade=0;blade<3;blade++){
        const grass=box(green,x+(blade-1)*.065,.32,z,.025,.32,.025);grass.rotation.z=(blade-1)*.22;
      }
      if(k%2===0){
        const color=['#efe4ba','#c6aecb','#d4a396','#f4edd9'][k%4];
        make(cyl,mat('#6b8957'),x,.34,z,.014,.4,.014);
        make(sphere,mat(color),x,.55,z,.105,.055,.105);
        make(sphere,mat('#dbbd79'),x,.59,z,.04,.03,.04);
      }
    }
  }
  const tree=(x,z,size,base=0)=>{
    make(cyl,mat('#8e7456'),x,base+.85,z,.09*size,1.7,.09*size);
    for(const [dx,dy,dz,r]of [[0,0,0,.85],[-.45,.3,.12,.62],[.4,.1,-.1,.67]]){
      const canopy=make(sphere,mat(dx<0?'#8da57b':'#78966b'),x+dx*size,base+2.05+dy,z+dz*size,r*size,.68*size,r*size);
      canopy.castShadow=true;
    }
  };
  const townWindows=new THREE.MeshStandardMaterial({color:0x97a49a,emissive:0xffbd70,emissiveIntensity:0,roughness:.55});
  materials.add(townWindows);
  const window=(x,y,z,w,h,d,lit,alternate)=>{
    make(cube,lit?townWindows:mat(WINDOW_COLORS[Number(alternate)]),x,y,z,w,h,d);
  };
  const districts=officeDistricts(layout.bounds);
  buildOfficeDistricts(districts,box,window,tree);
  const skylineWindows=new Map();
  const skylineWindow=(color,x,y,z,w,h,d)=>{
    if(!skylineWindows.has(color)){
      const material=new THREE.MeshStandardMaterial({color,emissive:0xffcc83,emissiveIntensity:0,roughness:.9});
      skylineWindows.set(color,material);materials.add(material);
    }
    make(cube,skylineWindows.get(color),x,y,z,w,h,d);
  };
  buildDistantSkyline(layout.bounds,box,skylineWindow);
  const roads=districtRoads(districts);
  for(const road of roads){
    const geometry=ownGeometry(groundShapeGeometry(roadShape(road),1));
    make(geometry,mat('#808b88'),0,GROUND_LEVEL+.134,0);
  }
  const cityRoad=ownGeometry(buildCityRoad(layout.bounds,roads[1],terrain.userData.elevationAt));
  make(cityRoad,mat('#808b88'),0,0,0);

  for(const [x,z,size]of [
    [minX-7,minZ+4,1.5],[minX-11,minZ+.5,1.2],
    [minX+16,minZ-11,1.45],[minX+20,minZ-14,1.1],
    [maxX+12,-10,1.4],[maxX+18,-13,1.2],[maxX+23,-8,1.35],
    [maxX+8,maxZ-3,1.25],[maxX+13,maxZ,1.5],
  ])tree(x,z,size,GROUND_LEVEL);
  for(const [x,z,size]of [...park.trees,...landscape.trees]){
    tree(x,z,size);
    const light=new THREE.PointLight(0xffd9a1,0,5.2,2);light.position.set(x,.45,z);group.add(light);fixtures.push({light,intensity:.58});
    make(cyl,glow,x,.11,z-.4,.1,.045,.1);
  }
  for(const {x,z,w,rotation}of landscape.benches){
    const across=Math.abs(Math.cos(rotation))>.5,halfX=across?1.75:.65,halfZ=across?.65:1.75;
    surface([x-halfX,x+halfX,z-halfZ,z+halfZ],'#d3c3a5',.06,.35);
    const bench=new THREE.Group();bench.position.set(x,0,z);bench.rotation.y=rotation;group.add(bench);
    const part=(color,lx,y,lz,width,height,depth)=>{
      const mesh=new THREE.Mesh(cube,mat(color));mesh.position.set(lx,y,lz);mesh.scale.set(width,height,depth);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.landscape=true;bench.add(mesh);return mesh;
    };
    for(let i=0;i<5;i++)part('#b89b73',0,.51,-.28+i*.14,w,.1,.115);
    for(let i=0;i<3;i++)part('#c3a780',0,.77+i*.14,-.34,w,.105,.09);
    for(const side of [-1,1]){
      part('#637866',side*(w/2-.23),.29,0,.1,.46,.58);
      part('#637866',side*(w/2-.23),.75,-.04,.075,.52,.075);
      part('#b89b73',side*(w/2-.23),.82,.02,.12,.08,.63);
    }
  }
  const junctions=[[layout.circulation.hub.x,0],[2.7,7],[2.7,14.2],[2.7,executive.z]];
  for(const [x,z]of junctions){const light=new THREE.PointLight(0xffdfa8,0,5,2);light.position.set(x,.7,z);group.add(light);fixtures.push({light,intensity:.4});}
  return {group,texture,
    updateLighting(darkness){
      glow.emissiveIntensity=.035+darkness*.8;
      townWindows.emissiveIntensity=darkness**2*.85;
      for(const window of skylineWindows.values())window.emissiveIntensity=darkness**3*2.25;
      for(const fixture of fixtures)fixture.light.intensity=darkness*fixture.intensity;
    },
    dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures.values())t.dispose();}
  };
}

export function buildOfficeTerrain(bounds,opening){
  const divisions=140;
  const grid=Array.from({length:divisions+1},(_,i)=>WORLD_DISTANCE*(2*i/divisions-1));
  const axis=(start,end)=>opening?[...new Set([...grid,start,end])].sort((a,b)=>a-b):grid;
  const xs=axis(opening?.minX,opening?.maxX),zs=axis(opening?.minZ,opening?.maxZ);
  const positions=[],colors=[],indices=[],districts=officeDistricts(bounds);
  const roadGrades=districtRoads(districts).map(road=>{
    const points=road.getPoints(24);
    const bounds=new THREE.Box2().setFromPoints(points).expandByScalar(42);
    const segments=points.slice(1).map((end,index)=>{
      const start=points[index],dx=end.x-start.x,dz=end.y-start.y;
      return {start,dx,dz,lengthSquared:dx*dx+dz*dz};
    });
    return {bounds,segments};
  });
  const green=new THREE.Color('#8da579'),dry=new THREE.Color('#a7ae87'),color=new THREE.Color();
  for(const z of zs)for(const x of xs){
    const outside=Math.hypot(Math.max(0,bounds.minX-x,x-bounds.maxX),Math.max(0,bounds.minZ-z,z-bounds.maxZ));
    const rise=THREE.MathUtils.smoothstep(outside,32,190);
    const hills=10+7*Math.cos(x*.029+z*.012)+5*Math.sin(z*.045-x*.021);
    let slope=1;
    for(const district of districts){
      // Keep the entire block level, including the adjacent terrain grid cells.
      const dx=Math.max(0,Math.abs(x-district.x)-district.width/2-13);
      const dz=Math.max(0,Math.abs(z-district.z)-district.depth/2-13);
      slope=Math.min(slope,THREE.MathUtils.smoothstep(Math.hypot(dx,dz),0,22));
    }
    for(const road of roadGrades){
      if(x<road.bounds.min.x||x>road.bounds.max.x||z<road.bounds.min.y||z>road.bounds.max.y)continue;
      let distance=Infinity;
      for(const {start,dx,dz,lengthSquared} of road.segments){
        const tx=x-start.x,tz=z-start.y;
        const along=THREE.MathUtils.clamp((tx*dx+tz*dz)/lengthSquared,0,1);
        distance=Math.min(distance,Math.hypot(tx-along*dx,tz-along*dz));
      }
      slope=Math.min(slope,THREE.MathUtils.smoothstep(distance,20,42));
    }
    positions.push(x,GROUND_LEVEL+rise*hills*slope,z);
    const tint=.5+.27*Math.sin(x*.059+z*.036)+.18*Math.cos(z*.091-x*.022);
    color.copy(green).lerp(dry,tint);
    colors.push(color.r,color.g,color.b);
  }
  for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
    // The trench edges are explicit grid lines, so the surrounding turf is a single surface.
    if(opening&&xs[i]>=opening.minX&&xs[i+1]<=opening.maxX&&zs[j]>=opening.minZ&&zs[j+1]<=opening.maxZ)continue;
    const a=j*xs.length+i,b=a+xs.length;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  terrain.receiveShadow=true;
  const cellIndex=(axis,value)=>{
    let low=0,high=axis.length-1;
    while(high-low>1){
      const mid=Math.floor((low+high)/2);
      if(axis[mid]<=value)low=mid;
      else high=mid;
    }
    return low;
  };
  const vertices=geometry.getAttribute('position');
  terrain.userData.elevationAt=(x,z)=>{
    const i=cellIndex(xs,x),j=cellIndex(zs,z);
    const u=THREE.MathUtils.clamp((x-xs[i])/(xs[i+1]-xs[i]),0,1);
    const v=THREE.MathUtils.clamp((z-zs[j])/(zs[j+1]-zs[j]),0,1);
    const a=j*xs.length+i,b=a+xs.length;
    // Follow the same diagonal as the terrain triangles.
    const top=vertices.getY(a+1),bottom=vertices.getY(b);
    return u+v<=1?vertices.getY(a)*(1-u-v)+top*u+bottom*v:
      vertices.getY(b+1)*(u+v-1)+top*(1-v)+bottom*(1-u);
  };
  return terrain;
}

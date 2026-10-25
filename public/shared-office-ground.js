import * as THREE from './vendor/three/three.module.js';

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

export function buildSharedGround(parent,layout){
  const group=new THREE.Group();parent.add(group);
  const geometries=new Set(),materials=new Set(),textures=new Map(),mats=new Map(),fixtures=[];
  const ownGeometry=g=>(geometries.add(g),g),cube=ownGeometry(new THREE.BoxGeometry(1,1,1)),sphere=ownGeometry(new THREE.SphereGeometry(1,12,8)),cyl=ownGeometry(new THREE.CylinderGeometry(1,1,1,20));
  const mat=color=>{if(!mats.has(color)){const m=new THREE.MeshStandardMaterial({color,roughness:.9});mats.set(color,m);materials.add(m);}return mats.get(color);};
  const make=(g,m,x,y,z,w=1,h=1,d=1)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.receiveShadow=true;mesh.userData.landscape=true;group.add(mesh);return mesh;};
  const box=(color,x,y,z,w,h,d)=>make(cube,mat(color),x,y,z,w,h,d);
  const surface=(rect,color,y,r=.4)=>{const g=ownGeometry(new THREE.ShapeGeometry(roundedRect(rect,r),10));g.rotateX(Math.PI/2);const m=mat(color);m.side=THREE.DoubleSide;return make(g,m,0,y,0);};
  const texture=room=>{const kind=['library','meeting','desk'].includes(room)?'wood':room==='server'?'technical':'stone';if(!textures.has(kind))textures.set(kind,floorTexture(kind));return textures.get(kind);};
  const glow=new THREE.MeshStandardMaterial({color:0xffe3ac,emissive:0xffd18b,emissiveIntensity:.04,roughness:.6});materials.add(glow);
  const {park,landscape,circulation,executive,rooms}=layout;
  surface(park.bounds,'#ddd9ca',-.007,.8);
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
  for(const [x,z,size]of [...park.trees,...landscape.trees]){
    make(cyl,mat('#8e7456'),x,.85,z,.09*size,1.7,.09*size);
    for(const [dx,dy,dz,r]of [[0,0,0,.85],[-.45,.3,.12,.62],[.4,.1,-.1,.67]]){const canopy=make(sphere,mat(dx<0?'#8da57b':'#78966b'),x+dx*size,2.05+dy*size,z+dz*size,r*size,.68*size,r*size);canopy.castShadow=true;}
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
    updateLighting(darkness){glow.emissiveIntensity=.035+darkness*.8;for(const fixture of fixtures)fixture.light.intensity=darkness*fixture.intensity;},
    dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures.values())t.dispose();}
  };
}

import * as THREE from './vendor/three/three.module.js';

// The normal points toward the corridor. Its tangent points left for someone entering.
const OUTWARD = {north:[0,-1], south:[0,1], west:[-1,0], east:[1,0]};

export function buildWoodenSign(parent, {
  door, side, title, description, room, width = 1.65, height = .65,
  align = 'left',
}) {
  const [outX, outZ] = OUTWARD[side];
  const offset = (door.w / 2 + width / 2 + .12) * (align === 'right' ? -1 : 1);
  const setback = .46;
  const root = new THREE.Group();
  root.position.set(door.x + outX * setback - outZ * offset, .05, door.z + outZ * setback + outX * offset);
  root.rotation.y = Math.atan2(outX, outZ);
  root.userData.room = room;
  parent.add(root);

  const postMaterial = new THREE.MeshStandardMaterial({color:0x714526, roughness:.9});
  const edgeMaterial = new THREE.MeshStandardMaterial({color:0xa16a3a, roughness:.85});
  const box = (group, material, w, h, d, x, y) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const boardY = .79 + height / 2;
  for (const x of [-width * .3, width * .3]) box(root, postMaterial, .11, boardY, .13, x, boardY / 2);
  const board = new THREE.Group();
  board.position.y = boardY;
  board.rotation.x = -.24;
  root.add(board);
  box(board, edgeMaterial, width, height, .12, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 304;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const faceMaterial = new THREE.MeshStandardMaterial({
    map:texture, roughness:.88, emissive:0xffffff, emissiveMap:texture, emissiveIntensity:.19,
  });
  const faceGeometry = new THREE.PlaneGeometry(width - .018, height - .018);
  for (const side of [1,-1]) {
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.z = side * .061;
    if (side === -1) face.rotation.y = Math.PI;
    board.add(face);
  }

  let previousTitle, previousStatus;
  function write(name = title, status = '') {
    if (name === previousTitle && status === previousStatus) return;
    previousTitle = name;
    previousStatus = status;
    const gradient = ctx.createLinearGradient(0,0,0,304);
    gradient.addColorStop(0,'#d7a66e');
    gradient.addColorStop(.54,'#e8be87');
    gradient.addColorStop(1,'#c6925d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,768,304);
    for (let i = 0; i < 54; i++) {
      const y = 6 + i * 5.5;
      ctx.strokeStyle = i % 4 === 0 ? '#fff1ca55' : '#7844192d';
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.bezierCurveTo(240,y + Math.sin(i) * 14,510,y - Math.cos(i) * 13,768,y + 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#87552e';
    ctx.lineWidth = 4;
    ctx.strokeRect(16,16,736,272);
    ctx.fillStyle = '#68462e';
    for (const x of [33,735]) {
      for (const y of [33,271]) {
        ctx.beginPath();
        ctx.arc(x,y,5,0,Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#332013';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 81px system-ui, sans-serif';
    ctx.fillText(name,384,status ? 100 : 113,650);
    ctx.font = '600 46px system-ui, sans-serif';
    ctx.fillText(description,384,status ? 180 : 207,660);
    if (status) {
      ctx.font = '600 39px system-ui, sans-serif';
      ctx.fillText(status,384,241,660);
    }
    texture.needsUpdate = true;
  }
  write();

  return {
    root,
    write,
    dispose() {
      root.removeFromParent();
      const geometries = new Set();
      root.traverse(node => { if (node.isMesh) geometries.add(node.geometry); });
      for (const geometry of geometries) geometry.dispose();
      for (const material of [postMaterial,edgeMaterial,faceMaterial]) material.dispose();
      texture.dispose();
    },
  };
}

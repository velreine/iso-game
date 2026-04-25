/* ── editor.js — Hammer-style Level Editor ────────────────────────────────── */
'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const TILE_SIZE      = 1.0;
const TILE_THICKNESS = 0.22;
const TILE_GAP       = 0.06;
const STEP_H         = 0.3;
const WALL_HEIGHT    = 0.9;
const WALL_THICK     = 0.12;
const WALL_Y         = WALL_HEIGHT / 2;

// ── Editor State ─────────────────────────────────────────────────────────────
const ES = {
  levelId: 'level1', levelName: 'New Level', stepHeight: 0.3,
  playerStart: { x: 0, z: 0 },
  rooms: [], elevatedTiles: [], decoratives: [], lights: [], portals: [],
  standaloneTiles: [],

  // Multi-selection: array of {kind, id}
  // kind: 'room' | 'elevated' | 'decor' | 'light' | 'standalone'
  selection: [],

  tool: 'select',

  // Room-draw drag
  drawing:   false,
  drawStart: null,
  drawEnd:   null,

  undoStack: [],
};

// ── Selection helpers ─────────────────────────────────────────────────────────
function selContains(kind, id) { return ES.selection.some(s => s.kind === kind && s.id === id); }
function selAdd(kind, id)      { if (!selContains(kind, id)) ES.selection.push({ kind, id }); }
function selRemove(kind, id)   { ES.selection = ES.selection.filter(s => !(s.kind === kind && s.id === id)); }
function selSet(kind, id)      { ES.selection = [{ kind, id }]; }
function selClear()            { ES.selection = []; }
// Convenience: first selected item of a kind
function selFirst(kind)        { return ES.selection.find(s => s.kind === kind) || null; }
function selSingle()           { return ES.selection.length === 1 ? ES.selection[0] : null; }

// ── Renderer ─────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('vp-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;
renderer.setClearColor(0x0d0d14, 1);

// ── Two scenes ────────────────────────────────────────────────────────────────
// scene       → level geometry (wireframe overrideMaterial applied in ortho views)
// helperScene → grids, handles, selection boxes, hover  (never overridden)
const scene       = new THREE.Scene();
const helperScene = new THREE.Scene();
const levelGroup  = new THREE.Group();
scene.add(levelGroup);

const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x4a4a88, wireframe: true });

// ── Grid helpers (helperScene — never wireframed) ─────────────────────────────
const gridTop   = new THREE.GridHelper(80, 80, 0x303060, 0x1e1e3a);               // XZ
const gridFront = new THREE.GridHelper(80, 80, 0x2a2a44, 0x18182e);               // XY
gridFront.rotation.x = Math.PI / 2;
const gridSide  = new THREE.GridHelper(80, 80, 0x2a2a44, 0x18182e);               // ZY
gridSide.rotation.z  = Math.PI / 2;
helperScene.add(gridTop, gridFront, gridSide);

// ── Edge-box factory ──────────────────────────────────────────────────────────
function _makeEdgeBox(color) {
  const ls = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color })
  );
  ls.visible = false;
  helperScene.add(ls);
  return ls;
}

// Preview box while drawing a room (green)
const previewBox    = _makeEdgeBox(0x00ff50);
// Single-room selection bounding box (yellow)
const roomBoundsBox = _makeEdgeBox(0xffcc00);

// Pool of BoxHelpers for multi-selection outlines
const selBoxPool = [];
function _clearSelBoxPool() {
  selBoxPool.forEach(b => helperScene.remove(b));
  selBoxPool.length = 0;
}
function _addSelOutline(mesh) {
  if (!mesh) return;
  const b = new THREE.BoxHelper(mesh, 0xffcc00);
  helperScene.add(b);
  selBoxPool.push(b);
}

// ── Resize handles (shown for single room selection) ─────────────────────────
const handlesGroup = new THREE.Group();
helperScene.add(handlesGroup);
const HANDLE_AXES  = ['xMin', 'xMax', 'zMin', 'zMax'];
const HANDLE_COLOR = { xMin: 0xff4444, xMax: 0xff4444, zMin: 0x4488ff, zMax: 0x4488ff };
const handleMeshes = {};
HANDLE_AXES.forEach(ax => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: HANDLE_COLOR[ax] })
  );
  m.userData.handleType = ax;
  handlesGroup.add(m);
  handleMeshes[ax] = m;
});
handlesGroup.visible = false;

// ── Hover + spawn ─────────────────────────────────────────────────────────────
const hoverMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(TILE_SIZE - TILE_GAP, TILE_SIZE - TILE_GAP),
  new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.28, depthWrite: false })
);
hoverMesh.rotation.x = -Math.PI / 2;
hoverMesh.visible    = false;
helperScene.add(hoverMesh);

const spawnMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0x00ff88 })
);
spawnMesh.position.y = 0.4;
helperScene.add(spawnMesh);

// ── Lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 40, 20); sun.castShadow = true;
scene.add(sun);

// ── Cameras ───────────────────────────────────────────────────────────────────
const perspCam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const topCam   = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
const frontCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
const sideCam  = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);

let perspYaw = -Math.PI * 0.75, perspPitch = -0.7;
let perspPos = new THREE.Vector3(-14, 18, -14);
let orthoZoom = 20;
let topPanX = 0, topPanZ = 0, frontPanX = 0, frontPanY = 10, sidePanZ = 0, sidePanY = 10;

function _applyPerspCam() {
  const dir = new THREE.Vector3(Math.cos(perspPitch)*Math.sin(perspYaw), Math.sin(perspPitch), Math.cos(perspPitch)*Math.cos(perspYaw));
  perspCam.position.copy(perspPos);
  perspCam.lookAt(perspPos.clone().add(dir));
}
function _applyTopCam()   { topCam.position.set(topPanX,100,topPanZ); topCam.lookAt(topPanX,0,topPanZ); topCam.up.set(0,0,-1); }
function _applyFrontCam() { frontCam.position.set(frontPanX,frontPanY,100); frontCam.lookAt(frontPanX,frontPanY,0); }
function _applySideCam()  { sideCam.position.set(-100,sidePanY,sidePanZ); sideCam.lookAt(0,sidePanY,sidePanZ); }
function _updateOrthoCameras() {
  const asp = (canvas.clientWidth||800) / (canvas.clientHeight||600);
  [topCam, frontCam, sideCam].forEach(c => {
    c.left=-orthoZoom*asp; c.right=orthoZoom*asp; c.top=orthoZoom; c.bottom=-orthoZoom;
    c.updateProjectionMatrix();
  });
}
function setOrthoZoom(z) { orthoZoom=Math.max(4,Math.min(80,z)); _updateOrthoCameras(); _applyTopCam(); _applyFrontCam(); _applySideCam(); }
_applyPerspCam(); _applyTopCam(); _applyFrontCam(); _applySideCam();

// ── Viewport geometry ─────────────────────────────────────────────────────────
// Layout:  TL=side  TR=top  /  BL=persp  BR=front
function getViewportRect(vp) {
  const W=canvas.clientWidth, H=canvas.clientHeight, hw=W/2, hh=H/2;
  return { persp:{x:0,y:hh,w:hw,h:hh}, top:{x:hw,y:0,w:hw,h:hh}, front:{x:hw,y:hh,w:hw,h:hh}, side:{x:0,y:0,w:hw,h:hh} }[vp];
}
const _camFor = vp => ({ persp:perspCam, top:topCam, front:frontCam, side:sideCam }[vp]);
function getViewportAt(cx, cy) {
  const W=canvas.clientWidth, H=canvas.clientHeight;
  if (cx<W/2&&cy>=H/2) return 'persp';
  if (cx>=W/2&&cy<H/2)  return 'top';
  if (cx>=W/2&&cy>=H/2) return 'front';
  return 'side';
}
function toClip(vp, cx, cy) {
  const r=getViewportRect(vp);
  return { x:((cx-r.x)/r.w)*2-1, y:-((cy-r.y)/r.h)*2+1 };
}
// World XZ from top-view click (y=0 plane)
function topToWorld(cx, cy) {
  const ray=new THREE.Raycaster();
  ray.setFromCamera(toClip('top',cx,cy), topCam);
  const pt=new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),pt) ? {x:pt.x,z:pt.z} : null;
}
// Project world pos → CSS coords in a given viewport
function worldToCSS(wx, wy, wz, vp) {
  const v=new THREE.Vector3(wx,wy,wz).project(_camFor(vp));
  const r=getViewportRect(vp);
  return { x:r.x+(v.x+1)/2*r.w, y:r.y+(1-v.y)/2*r.h };
}

// ── Tile map ──────────────────────────────────────────────────────────────────
let tileMap = {};
const tmSet=(x,z,d)=>{ (tileMap[x]||(tileMap[x]={}))[z]=d; };
const tmGet=(x,z)=>tileMap[x]?.[z];

// ── Geometry arrays ───────────────────────────────────────────────────────────
let tileMeshes=[], wallMeshes=[], decorMeshes=[], lightMeshes=[], standaloneMs=[];

function rebuildLevel() {
  while (levelGroup.children.length) {
    const o=levelGroup.children[0]; levelGroup.remove(o);
    if (o.geometry) o.geometry.dispose();
  }
  tileMeshes=[]; wallMeshes=[]; decorMeshes=[]; lightMeshes=[]; standaloneMs=[];
  tileMap={};

  ES.rooms.forEach(r => r.type==='ramp' ? _buildRampRoom(r) : _buildRoom(r));
  ES.elevatedTiles.forEach(_buildElevatedTile);
  ES.standaloneTiles.forEach(_buildStandaloneTile);
  _buildWalls();
  ES.decoratives.forEach(_buildDecorMesh);
  ES.lights.forEach(_buildLightHelper);

  spawnMesh.position.set(ES.playerStart.x, 0.4, ES.playerStart.z);
  _refreshSelBoxes();
  _refreshLayersList();
  _showPropsForSelection();
}

// ── Builders ──────────────────────────────────────────────────────────────────
const _mat  = c => new THREE.MeshLambertMaterial({ color: c });
const _rand = a => a[Math.floor(Math.random()*a.length)];

function _floorTile(x, z, elev, color, roomId, arr) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE-TILE_GAP,TILE_THICKNESS,TILE_SIZE-TILE_GAP), _mat(color));
  mesh.position.set(x, elev-TILE_THICKNESS/2, z);
  mesh.receiveShadow=true;
  mesh.userData={kind:'tile', roomId, x, z, elevation:elev};
  levelGroup.add(mesh); (arr||tileMeshes).push(mesh);
  tmSet(x,z,{kind:'tile',roomId,elevation:elev,walkable:true});
}

function _buildRoom(room) {
  const elev=room.elevation||0;
  for (let x=room.xMin;x<=room.xMax;x++) for (let z=room.zMin;z<=room.zMax;z++) {
    const isLava=room.lavaCoords?.some(([lx,lz])=>lx===x&&lz===z);
    const pal=isLava?(room.lavaPalette||[0xff3300]):(room.palette||[0x505050]);
    _floorTile(x,z,elev,_rand(pal),room.id);
  }
}

function _buildRampRoom(room) {
  const axis=room.elevationAxis||'x';
  const steps=axis==='z'?room.zMax-room.zMin+1:room.xMax-room.xMin+1;
  for (let s=0;s<steps;s++) {
    const elev=(room.elevationStart||STEP_H)+STEP_H*s;
    const x0=axis==='z'?room.xMin:room.xMin+s, x1=axis==='z'?room.xMax:x0;
    const z0=axis==='z'?room.zMin+s:room.zMin, z1=axis==='z'?z0:room.zMax;
    for (let x=x0;x<=x1;x++) for (let z=z0;z<=z1;z++)
      _floorTile(x,z,elev,_rand(room.palette||[0x707058]),room.id);
  }
}

function _buildElevatedTile(et) {
  const h=et.elevation+TILE_THICKNESS;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE-TILE_GAP,h,TILE_SIZE-TILE_GAP), _mat(et.type==='platform'?0x3a4868:0x485070));
  mesh.position.set(et.x,h/2-TILE_THICKNESS/2,et.z);
  mesh.receiveShadow=mesh.castShadow=true;
  mesh.userData={kind:'elevated',x:et.x,z:et.z,elevation:et.elevation,type:et.type};
  levelGroup.add(mesh); tileMeshes.push(mesh);
  tmSet(et.x,et.z,{kind:'elevated',elevation:et.elevation,walkable:true});
}

function _buildStandaloneTile(st) {
  const elev=st.elevation||0;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE-TILE_GAP,TILE_THICKNESS,TILE_SIZE-TILE_GAP), _mat(st.color||0x505060));
  mesh.position.set(st.x,elev-TILE_THICKNESS/2,st.z);
  mesh.receiveShadow=true;
  mesh.userData={kind:'standalone',id:st.id,x:st.x,z:st.z,elevation:elev};
  levelGroup.add(mesh); standaloneMs.push(mesh); tileMeshes.push(mesh);
  tmSet(st.x,st.z,{kind:'standalone',id:st.id,elevation:elev,walkable:true});
}

function _buildWalls() {
  const DIRS=[
    {dx:0,dz:-1,px:0,                 pz:-0.5+WALL_THICK/2},
    {dx:0,dz:1, px:0,                 pz: 0.5-WALL_THICK/2},
    {dx:-1,dz:0,px:-0.5+WALL_THICK/2,pz:0,ry:true},
    {dx:1, dz:0,px: 0.5-WALL_THICK/2,pz:0,ry:true},
  ];
  for (const xk in tileMap) for (const zk in tileMap[xk]) {
    const x=parseInt(xk),z=parseInt(zk),cell=tileMap[x][z]; if(!cell) continue;
    const elev=cell.elevation||0;
    DIRS.forEach(d=>{
      if (tmGet(x+d.dx,z+d.dz)!==undefined) return;
      const room=ES.rooms.find(r=>r.type!=='ramp'&&x>=r.xMin&&x<=r.xMax&&z>=r.zMin&&z<=r.zMax);
      const wc=room?(room.doorColor||room.palette?.[0]||0x505050):0x505050;
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE-TILE_GAP,WALL_HEIGHT,WALL_THICK),_mat(wc));
      mesh.position.set(x+d.px,elev+WALL_Y,z+d.pz);
      if(d.ry) mesh.rotation.y=Math.PI/2;
      mesh.castShadow=mesh.receiveShadow=true; mesh.userData={kind:'wall'};
      levelGroup.add(mesh); wallMeshes.push(mesh);
    });
  }
}

function _buildDecorMesh(def) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(def.w||1,def.h||1,def.d||1),_mat(def.color||0x606060));
  mesh.position.set(def.x||0,def.y||0.5,def.z||0);
  mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={kind:'decor',id:def.id,w:def.w,h:def.h,d:def.d};
  levelGroup.add(mesh); decorMeshes.push(mesh);
}

function _buildLightHelper(def) {
  const s=new THREE.Mesh(new THREE.SphereGeometry(0.18,6,6),new THREE.MeshBasicMaterial({color:def.color||0xffffff}));
  s.position.set(def.x||0,def.y||2,def.z||0); s.userData={kind:'light',id:def.id};
  levelGroup.add(s); lightMeshes.push(s);
  const w=new THREE.Mesh(new THREE.SphereGeometry(def.distance||5,10,6),new THREE.MeshBasicMaterial({color:def.color||0xffffff,wireframe:true,opacity:0.1,transparent:true}));
  w.position.copy(s.position); levelGroup.add(w); lightMeshes.push(w);
}

// ── Selection box pool refresh ────────────────────────────────────────────────
function _refreshSelBoxes() {
  _clearSelBoxPool();
  roomBoundsBox.visible=false; handlesGroup.visible=false;

  ES.selection.forEach(s => {
    const mesh=_findMeshById(s.kind, s.id);
    _addSelOutline(mesh);
  });

  // Single-room selection: show handles + bounding box
  const roomSels=ES.selection.filter(s=>s.kind==='room');
  if (roomSels.length===1) {
    _updateRoomBoundsBox(roomSels[0].id);
    _updateHandles(roomSels[0].id);
  }
}

function _findMeshById(kind, id) {
  if (kind==='decor')      return decorMeshes.find(m=>m.userData.id===id)||null;
  if (kind==='light')      return lightMeshes.find(m=>m.userData.id===id&&m.userData.kind==='light')||null;
  if (kind==='standalone') return standaloneMs.find(m=>m.userData.id===id)||null;
  if (kind==='room')       return tileMeshes.find(m=>m.userData.roomId===id)||null;
  if (kind==='elevated')   { const [x,z]=id.split(',').map(Number); return tileMeshes.find(m=>m.userData.kind==='elevated'&&m.userData.x===x&&m.userData.z===z)||null; }
  return null;
}

// ── Room bounds box + handles ─────────────────────────────────────────────────
function _updateRoomBoundsBox(roomId) {
  const room=ES.rooms.find(r=>r.id===roomId);
  if (!room) { roomBoundsBox.visible=false; return; }
  const x0=room.xMin-0.5,x1=room.xMax+0.5,z0=room.zMin-0.5,z1=room.zMax+0.5;
  const elev=room.elevation||0, ht=WALL_HEIGHT+elev+0.05;
  roomBoundsBox.position.set((x0+x1)/2,ht/2,(z0+z1)/2);
  roomBoundsBox.scale.set(x1-x0,ht,z1-z0);
  roomBoundsBox.visible=true;
}
function _updateHandles(roomId) {
  const room=ES.rooms.find(r=>r.id===roomId);
  if (!room) { handlesGroup.visible=false; return; }
  handlesGroup.visible=true;
  const elev=(room.elevation||0)+0.4, mx=(room.xMin+room.xMax)/2, mz=(room.zMin+room.zMax)/2;
  handleMeshes.xMin.position.set(room.xMin-0.5,elev,mz);
  handleMeshes.xMax.position.set(room.xMax+0.5,elev,mz);
  handleMeshes.zMin.position.set(mx,elev,room.zMin-0.5);
  handleMeshes.zMax.position.set(mx,elev,room.zMax+0.5);
}

// Preview box during room creation
function _updatePreviewBox() {
  if (!ES.drawing||!ES.drawStart||!ES.drawEnd) { previewBox.visible=false; return; }
  const x0=Math.min(ES.drawStart.x,ES.drawEnd.x)-0.5, x1=Math.max(ES.drawStart.x,ES.drawEnd.x)+0.5;
  const z0=Math.min(ES.drawStart.z,ES.drawEnd.z)-0.5, z1=Math.max(ES.drawStart.z,ES.drawEnd.z)+0.5;
  previewBox.position.set((x0+x1)/2,0.75,(z0+z1)/2);
  previewBox.scale.set(x1-x0,1.5,z1-z0);
  previewBox.visible=true;
}

// ── Raycaster ─────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();

function _raycastHandles(cx, cy, vp) {
  if (!handlesGroup.visible) return null;
  raycaster.setFromCamera(toClip(vp,cx,cy), _camFor(vp));
  const hits=raycaster.intersectObjects(Object.values(handleMeshes));
  return hits.length ? hits[0].object.userData.handleType : null;
}

// Returns userData of first hit object in levelGroup
function _raycastLevel(cx, cy, vp) {
  raycaster.setFromCamera(toClip(vp,cx,cy), _camFor(vp));
  const hits=raycaster.intersectObjects([...tileMeshes,...decorMeshes,...lightMeshes]);
  if (!hits.length) return null;
  return hits[0].object.userData;
}

// ── Drag-state ────────────────────────────────────────────────────────────────
let mouseButtons = { left:false, right:false, middle:false };
let lastMouse    = { x:0, y:0 };
let activeVP     = null;

// Handle resize drag
let _dragHandle = null;   // { type, room }

// Move-selection drag
let _dragMove = null;
// { worldStart:{x,z}, origStates:[{kind,id, orig:{}}] }

// Marquee drag
let _dragMarquee = null;
// { startCSS:{x,y}, vpName, startWorld:{x,z} }
const DRAG_THRESHOLD = 5; // px before drag is recognised as a drag vs click
let _dragDistance = 0;

// ── Mouse events ──────────────────────────────────────────────────────────────
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  const cx=e.offsetX, cy=e.offsetY;
  activeVP=getViewportAt(cx,cy);
  lastMouse={x:cx,y:cy};
  _dragDistance=0;
  if (e.button===0) { mouseButtons.left=true;  _onLeftDown(cx,cy,e.ctrlKey||e.metaKey); }
  if (e.button===1) { mouseButtons.middle=true; e.preventDefault(); }
  if (e.button===2)   mouseButtons.right=true;
});

window.addEventListener('mouseup', e => {
  if (e.button===0) { mouseButtons.left=false; _onLeftUp(e.ctrlKey||e.metaKey); }
  if (e.button===1)   mouseButtons.middle=false;
  if (e.button===2)   mouseButtons.right=false;
});

window.addEventListener('mousemove', e => {
  const rect=canvas.getBoundingClientRect();
  const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
  const dx=cx-lastMouse.x, dy=cy-lastMouse.y;
  _dragDistance+=Math.abs(dx)+Math.abs(dy);
  lastMouse={x:cx,y:cy};
  _onMouseMove(cx,cy,dx,dy);
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const vp=getViewportAt(e.offsetX,e.offsetY);
  if (vp==='persp') {
    const dir=new THREE.Vector3(Math.cos(perspPitch)*Math.sin(perspYaw),Math.sin(perspPitch),Math.cos(perspPitch)*Math.cos(perspYaw));
    perspPos.addScaledVector(dir,-e.deltaY*0.05); _applyPerspCam();
  } else setOrthoZoom(orthoZoom+e.deltaY*0.05);
}, {passive:false});

// ── Left-down ─────────────────────────────────────────────────────────────────
function _onLeftDown(cx, cy, ctrl) {
  const vp=activeVP;

  // ── SELECT tool ──
  if (ES.tool==='select') {
    // 1. Resize handle?
    const ht=_raycastHandles(cx,cy,vp);
    if (ht) {
      const s=ES.selection.find(s=>s.kind==='room');
      if (s) { _dragHandle={type:ht, room:ES.rooms.find(r=>r.id===s.id)}; return; }
    }

    // 2. Hit any object?
    const ud=_raycastLevel(cx,cy,vp);
    if (ud) {
      const { kind, id: rawId, roomId, x, z } = ud;
      const kind2 = (kind==='tile'||kind==='wall') ? (roomId ? 'room' : (ud.kind==='standalone' ? 'standalone' : null)) : kind;
      const id2   = kind2==='room' ? roomId : (kind2==='elevated' ? `${x},${z}` : (kind2==='standalone' ? rawId : rawId));
      if (!kind2) return;

      if (ctrl) {
        // Toggle in selection
        selContains(kind2,id2) ? selRemove(kind2,id2) : selAdd(kind2,id2);
      } else {
        // If clicking an already-selected item: don't change selection (will drag)
        if (!selContains(kind2,id2)) selSet(kind2,id2);
      }
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();

      // Start move drag
      if (vp==='top') {
        const wp=topToWorld(cx,cy);
        if (wp) _startMoveDrag(wp);
      }
      return;
    }

    // 3. Empty space → marquee (or deselect on click)
    if (!ctrl && vp!=='persp') {
      const wp=topToWorld(cx,cy);
      _dragMarquee={ startCSS:{x:cx,y:cy}, vpName:vp, startWorld:wp };
    } else if (!ctrl) {
      selClear(); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    }
    return;
  }

  // ── Other tools ──
  if (ES.tool==='room' && vp==='top') {
    const wp=topToWorld(cx,cy);
    if (wp) {
      ES.drawing=true; ES.drawStart=ES.drawEnd={x:Math.round(wp.x),z:Math.round(wp.z)};
      _showDrawRect(true); _updateDrawRect(); _updatePreviewBox();
    }
    return;
  }
  if (ES.tool==='tile' && vp==='top') {
    const wp=topToWorld(cx,cy); if(wp) _placeTile(Math.round(wp.x),Math.round(wp.z)); return;
  }
  if (ES.tool==='lava'     && vp==='top') { _toggleLava(cx,cy); return; }
  if (ES.tool==='elevated' && vp==='top') {
    const wp=topToWorld(cx,cy); if(wp) _openElevDialog(Math.round(wp.x),Math.round(wp.z)); return;
  }
  if (ES.tool==='decor'    && vp==='top') {
    const wp=topToWorld(cx,cy); if(wp) _placeDecor(Math.round(wp.x),Math.round(wp.z)); return;
  }
  if (ES.tool==='light'    && vp==='top') {
    const wp=topToWorld(cx,cy); if(wp) _placeLight(Math.round(wp.x),Math.round(wp.z)); return;
  }
  if (ES.tool==='spawn'    && vp==='top') {
    const wp=topToWorld(cx,cy);
    if (wp) {
      ES.playerStart={x:Math.round(wp.x),z:Math.round(wp.z)};
      spawnMesh.position.set(ES.playerStart.x,0.4,ES.playerStart.z);
      document.getElementById('meta-spawnx').value=ES.playerStart.x;
      document.getElementById('meta-spawnz').value=ES.playerStart.z;
      _setStatus(`Spawn → (${ES.playerStart.x}, ${ES.playerStart.z})`);
    }
  }
}

// ── Left-up ───────────────────────────────────────────────────────────────────
function _onLeftUp(ctrl) {
  // Finish room draw
  if (ES.tool==='room' && ES.drawing) {
    ES.drawing=false; _showDrawRect(false); previewBox.visible=false;
    if (ES.drawStart&&ES.drawEnd) {
      const x0=Math.min(ES.drawStart.x,ES.drawEnd.x), x1=Math.max(ES.drawStart.x,ES.drawEnd.x);
      const z0=Math.min(ES.drawStart.z,ES.drawEnd.z), z1=Math.max(ES.drawStart.z,ES.drawEnd.z);
      if (x1>=x0&&z1>=z0) _openRoomDialog(x0,x1,z0,z1);
    }
  }

  // Finish marquee
  if (_dragMarquee) {
    const m=_dragMarquee;
    _dragMarquee=null;
    _hideMarqueeRect();
    if (_dragDistance > DRAG_THRESHOLD) {
      const css1={x:lastMouse.x, y:lastMouse.y};
      _finishMarquee(m.startCSS, css1, m.vpName, ctrl);
    } else if (!ctrl) {
      // It was a click on empty space → deselect
      selClear(); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    }
    return;
  }

  // Finish handle resize — push undo
  if (_dragHandle) {
    _pushUndo(); // undo pushed at end of resize
    _dragHandle=null;
    return;
  }

  // Finish move
  if (_dragMove) {
    _dragMove=null;
  }
}

// ── Mouse move ────────────────────────────────────────────────────────────────
function _onMouseMove(cx, cy, dx, dy) {
  const vp=activeVP||getViewportAt(cx,cy);

  // Handle resize
  if (_dragHandle && mouseButtons.left) {
    const wp=topToWorld(cx,cy); if (!wp) return;
    const r=_dragHandle.room, sx=Math.round(wp.x), sz=Math.round(wp.z);
    switch (_dragHandle.type) {
      case 'xMin': r.xMin=Math.min(sx,r.xMax-1); break;
      case 'xMax': r.xMax=Math.max(sx,r.xMin+1); break;
      case 'zMin': r.zMin=Math.min(sz,r.zMax-1); break;
      case 'zMax': r.zMax=Math.max(sz,r.zMin+1); break;
    }
    rebuildLevel();
    _setStatus(`${r.id}: x[${r.xMin}→${r.xMax}]  z[${r.zMin}→${r.zMax}]`);
    return;
  }

  // Selection move
  if (_dragMove && mouseButtons.left && _dragDistance > DRAG_THRESHOLD) {
    const wp=topToWorld(cx,cy); if (!wp) return;
    const dx2=Math.round(wp.x-_dragMove.worldStart.x);
    const dz2=Math.round(wp.z-_dragMove.worldStart.z);
    _applyMoveDelta(dx2, dz2);
    return;
  }

  // Marquee
  if (_dragMarquee && mouseButtons.left && _dragDistance > DRAG_THRESHOLD) {
    _updateMarqueeRect(_dragMarquee.startCSS, {x:cx,y:cy});
  }

  // Persp right-drag look
  if (mouseButtons.right && vp==='persp') {
    perspYaw  -=dx*0.005;
    perspPitch=Math.max(-1.4,Math.min(1.4,perspPitch-dy*0.005));
    _applyPerspCam();
  }

  // Ortho middle-drag pan
  if (mouseButtons.middle) {
    const ps=orthoZoom/(canvas.clientWidth/2);
    if(vp==='top')   { topPanX-=dx*ps; topPanZ+=dy*ps; _applyTopCam(); }
    if(vp==='front') { frontPanX-=dx*ps; frontPanY+=dy*ps; _applyFrontCam(); }
    if(vp==='side')  { sidePanZ+=dx*ps; sidePanY+=dy*ps; _applySideCam(); }
  }

  // Room draw
  if (mouseButtons.left && ES.tool==='room' && ES.drawing && vp==='top') {
    const wp=topToWorld(cx,cy);
    if (wp) { ES.drawEnd={x:Math.round(wp.x),z:Math.round(wp.z)}; _updateDrawRect(); _updatePreviewBox(); }
  }

  // Hover highlight (top view only, non-drag)
  if (vp==='top'&&!mouseButtons.left) {
    const wp=topToWorld(cx,cy);
    if(wp) { hoverMesh.position.set(Math.round(wp.x),0.01,Math.round(wp.z)); hoverMesh.visible=true; }
  } else if(vp!=='top') hoverMesh.visible=false;

  // Coord readout
  if (vp==='top') {
    const wp=topToWorld(cx,cy);
    if(wp) document.getElementById('coord-top').textContent=`X ${wp.x.toFixed(1)}  Z ${wp.z.toFixed(1)}`;
  }
}

// ── Move drag helpers ─────────────────────────────────────────────────────────
function _startMoveDrag(worldPos) {
  _pushUndo();
  _dragMove = {
    worldStart: { x: worldPos.x, z: worldPos.z },
    origStates: ES.selection.map(s => {
      if (s.kind==='room') {
        const r=ES.rooms.find(r=>r.id===s.id);
        return r ? {...s, orig:{xMin:r.xMin,xMax:r.xMax,zMin:r.zMin,zMax:r.zMax}} : {...s,orig:null};
      }
      if (s.kind==='standalone') {
        const t=ES.standaloneTiles.find(t=>t.id===s.id);
        return t ? {...s, orig:{x:t.x,z:t.z}} : {...s,orig:null};
      }
      if (s.kind==='decor') {
        const d=ES.decoratives.find(d=>d.id===s.id);
        return d ? {...s, orig:{x:d.x,z:d.z}} : {...s,orig:null};
      }
      if (s.kind==='light') {
        const l=ES.lights.find(l=>l.id===s.id);
        return l ? {...s, orig:{x:l.x,z:l.z}} : {...s,orig:null};
      }
      return {...s, orig:null};
    }),
  };
}

function _applyMoveDelta(dx, dz) {
  if (!_dragMove) return;
  _dragMove.origStates.forEach(s => {
    if (!s.orig) return;
    if (s.kind==='room') {
      const r=ES.rooms.find(r=>r.id===s.id);
      if(r) { r.xMin=s.orig.xMin+dx; r.xMax=s.orig.xMax+dx; r.zMin=s.orig.zMin+dz; r.zMax=s.orig.zMax+dz; }
    } else if (s.kind==='standalone') {
      const t=ES.standaloneTiles.find(t=>t.id===s.id); if(t) { t.x=s.orig.x+dx; t.z=s.orig.z+dz; }
    } else if (s.kind==='decor') {
      const d=ES.decoratives.find(d=>d.id===s.id); if(d) { d.x=s.orig.x+dx; d.z=s.orig.z+dz; }
    } else if (s.kind==='light') {
      const l=ES.lights.find(l=>l.id===s.id); if(l) { l.x=s.orig.x+dx; l.z=s.orig.z+dz; }
    }
  });
  rebuildLevel();
  _setStatus(`Move Δ(${dx>=0?'+':''}${dx}, ${dz>=0?'+':''}${dz})`);
}

// ── Marquee ───────────────────────────────────────────────────────────────────
const marqueeRect = document.getElementById('marquee-rect');

function _updateMarqueeRect(a, b) {
  const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.abs(b.x-a.x), h=Math.abs(b.y-a.y);
  marqueeRect.setAttribute('x',x); marqueeRect.setAttribute('y',y);
  marqueeRect.setAttribute('width',w); marqueeRect.setAttribute('height',h);
  marqueeRect.setAttribute('visibility','visible');
}
function _hideMarqueeRect() { marqueeRect.setAttribute('visibility','hidden'); }

function _finishMarquee(cssStart, cssEnd, vp, additive) {
  const cam=_camFor(vp);
  const r=getViewportRect(vp);
  const sxMin=Math.min(cssStart.x,cssEnd.x), sxMax=Math.max(cssStart.x,cssEnd.x);
  const syMin=Math.min(cssStart.y,cssEnd.y), syMax=Math.max(cssStart.y,cssEnd.y);

  // Project a world point to screen-space and check if it falls in the marquee rect
  const inMarquee = (wx,wy,wz) => {
    const v=new THREE.Vector3(wx,wy,wz).project(cam);
    const sx=r.x+(v.x+1)/2*r.w;
    const sy=r.y+(1-v.y)/2*r.h;
    return sx>=sxMin&&sx<=sxMax&&sy>=syMin&&sy<=syMax;
  };

  const newSel = additive ? [...ES.selection] : [];
  const push = (kind,id) => { if(!newSel.some(s=>s.kind===kind&&s.id===id)) newSel.push({kind,id}); };

  ES.rooms.forEach(room => {
    const cx=(room.xMin+room.xMax)/2, cz=(room.zMin+room.zMax)/2, elev=room.elevation||0;
    if (inMarquee(cx,elev,cz)) push('room',room.id);
  });
  ES.standaloneTiles.forEach(t => { if(inMarquee(t.x,t.elevation||0,t.z)) push('standalone',t.id); });
  ES.decoratives.forEach(d => { if(inMarquee(d.x,d.y||0.5,d.z)) push('decor',d.id); });
  ES.lights.forEach(l => { if(inMarquee(l.x,l.y||2,l.z)) push('light',l.id); });
  ES.elevatedTiles.forEach(et => { if(inMarquee(et.x,et.elevation,et.z)) push('elevated',`${et.x},${et.z}`); });

  ES.selection=newSel;
  _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  _setStatus(`${newSel.length} item(s) selected`);
}

// ── Arrow key + Ctrl+D movement / duplication ─────────────────────────────────
function _moveSelection(dx, dz) {
  if (!ES.selection.length) return;
  _pushUndo();
  ES.selection.forEach(s => {
    if (s.kind==='room') {
      const r=ES.rooms.find(r=>r.id===s.id);
      if(r) { r.xMin+=dx; r.xMax+=dx; r.zMin+=dz; r.zMax+=dz; }
    } else if (s.kind==='standalone') {
      const t=ES.standaloneTiles.find(t=>t.id===s.id); if(t) { t.x+=dx; t.z+=dz; }
    } else if (s.kind==='decor') {
      const d=ES.decoratives.find(d=>d.id===s.id); if(d) { d.x+=dx; d.z+=dz; }
    } else if (s.kind==='light') {
      const l=ES.lights.find(l=>l.id===s.id); if(l) { l.x+=dx; l.z+=dz; }
    }
  });
  rebuildLevel();
}

function _duplicateSelection() {
  if (!ES.selection.length) return;
  _pushUndo();
  const newSel=[];
  ES.selection.forEach(s => {
    if (s.kind==='room') {
      const r=JSON.parse(JSON.stringify(ES.rooms.find(x=>x.id===s.id))); if(!r) return;
      r.id=_nextId('room'); r.xMin+=2; r.xMax+=2; ES.rooms.push(r); newSel.push({kind:'room',id:r.id});
    } else if (s.kind==='standalone') {
      const t=JSON.parse(JSON.stringify(ES.standaloneTiles.find(x=>x.id===s.id))); if(!t) return;
      t.id=_nextId('tile'); t.x+=1; ES.standaloneTiles.push(t); newSel.push({kind:'standalone',id:t.id});
    } else if (s.kind==='decor') {
      const d=JSON.parse(JSON.stringify(ES.decoratives.find(x=>x.id===s.id))); if(!d) return;
      d.id=_nextId('decor'); d.x+=2; ES.decoratives.push(d); newSel.push({kind:'decor',id:d.id});
    } else if (s.kind==='light') {
      const l=JSON.parse(JSON.stringify(ES.lights.find(x=>x.id===s.id))); if(!l) return;
      l.id=_nextId('light'); l.x+=2; ES.lights.push(l); newSel.push({kind:'light',id:l.id});
    }
  });
  ES.selection=newSel;
  rebuildLevel(); _setStatus(`Duplicated ${newSel.length} item(s) — selection updated to new copies`);
}

// ── Undo / Delete ─────────────────────────────────────────────────────────────
function _pushUndo() {
  ES.undoStack.push(JSON.stringify({
    rooms:ES.rooms, elevatedTiles:ES.elevatedTiles, decoratives:ES.decoratives,
    lights:ES.lights, portals:ES.portals, playerStart:ES.playerStart,
    standaloneTiles:ES.standaloneTiles, selection:ES.selection,
  }));
  if (ES.undoStack.length>50) ES.undoStack.shift();
}
function _undo() {
  if (!ES.undoStack.length) return;
  const snap=JSON.parse(ES.undoStack.pop()); Object.assign(ES,snap);
  rebuildLevel(); _showPropsForSelection(); _setStatus('Undo');
}
function _deleteSelected() {
  if (!ES.selection.length) return;
  _pushUndo();
  ES.selection.forEach(s => {
    if(s.kind==='room')       ES.rooms=ES.rooms.filter(r=>r.id!==s.id);
    else if(s.kind==='decor') ES.decoratives=ES.decoratives.filter(d=>d.id!==s.id);
    else if(s.kind==='light') ES.lights=ES.lights.filter(l=>l.id!==s.id);
    else if(s.kind==='standalone') ES.standaloneTiles=ES.standaloneTiles.filter(t=>t.id!==s.id);
    else if(s.kind==='elevated') { const [x,z]=s.id.split(',').map(Number); ES.elevatedTiles=ES.elevatedTiles.filter(e=>!(e.x===x&&e.z===z)); }
  });
  selClear(); rebuildLevel(); _showPropsForSelection();
}

// ── Property panel ────────────────────────────────────────────────────────────
const propsContent=document.getElementById('props-content');

function _showPropsForSelection() {
  const n=ES.selection.length;
  if (n===0) { propsContent.innerHTML='<p class="hint">Nothing selected.</p>'; return; }
  if (n===1) {
    const {kind,id}=ES.selection[0];
    if(kind==='room')          _showProps('room',       ES.rooms.find(r=>r.id===id));
    else if(kind==='elevated') { const [x,z]=id.split(',').map(Number); _showProps('elevated',ES.elevatedTiles.find(e=>e.x===x&&e.z===z)); }
    else if(kind==='standalone') _showProps('standalone', ES.standaloneTiles.find(s=>s.id===id));
    else if(kind==='decor')    _showProps('decor',      ES.decoratives.find(d=>d.id===id));
    else if(kind==='light')    _showProps('light',      ES.lights.find(l=>l.id===id));
    return;
  }
  // Multi-select → batch editor
  const kinds=[...new Set(ES.selection.map(s=>s.kind))];
  const items=ES.selection.map(s=>{
    let data=null;
    if(s.kind==='room')          data=ES.rooms.find(r=>r.id===s.id);
    else if(s.kind==='standalone') data=ES.standaloneTiles.find(t=>t.id===s.id);
    else if(s.kind==='decor')    data=ES.decoratives.find(d=>d.id===s.id);
    else if(s.kind==='light')    data=ES.lights.find(l=>l.id===s.id);
    else if(s.kind==='elevated') { const [x,z]=s.id.split(',').map(Number); data=ES.elevatedTiles.find(e=>e.x===x&&e.z===z); }
    return data?{kind:s.kind,data}:null;
  }).filter(Boolean);
  _showBatchProps(kinds,items,n);
}

function _showBatchProps(kinds, items, n) {
  // Returns the shared value if all items agree, or null if mixed
  const shared=(field)=>{ const vals=items.map(i=>i.data[field]); return vals.every(v=>v===vals[0])?vals[0]:null; };

  // Row builders (blank value + "mixed" placeholder when values differ)
  const bnum=(l,id,field,step=1)=>{ const v=shared(field); return `<div class="prop-row"><label>${l}</label><input type="number" id="${id}" value="${v!==null?v:''}" step="${step}" placeholder="${v===null?'mixed':''}"></div>`; };
  const bcol=(l,id,field)=>{ const v=shared(field); const isMixed=v===null; const hex=isMixed?'#808080':'#'+((v||0)>>>0).toString(16).padStart(6,'0'); return `<div class="prop-row"><label>${l}</label><input type="color" id="${id}" value="${hex}"${isMixed?' title="Mixed — will override all" style="opacity:0.55"':''}></div>`; };
  const bsel=(l,id,field,opts)=>{ const v=shared(field); return `<div class="prop-row"><label>${l}</label><select id="${id}">${v===null?'<option value="" disabled selected>— mixed —</option>':''}${opts.map(o=>`<option value="${o}"${o===v?' selected':''}>${o}</option>`).join('')}</select></div>`; };

  const sameKind=kinds.length===1, kind=kinds[0];
  let html=`<div class="prop-heading">${n} items${sameKind?' · '+kind:' · mixed'}</div>`;

  if(sameKind){
    if(kind==='room'){
      html+=bnum('Elevation','bm-elev','elevation',0.3);
      html+=`<div class="prop-row palette-row"><label>Palette</label><div class="palette-list" id="bm-pal"></div><input type="color" id="bm-swatch-pick" style="opacity:0;width:0;height:0;padding:0;border:0;position:absolute"><button class="small-btn" id="bm-addpal">+ Add</button></div>`;
    } else if(kind==='standalone'){
      html+=bnum('Elevation','bm-elev','elevation',0.3);
      html+=bcol('Color','bm-color','color');
    } else if(kind==='decor'){
      html+=bcol('Color','bm-color','color');
      html+=bnum('W','bm-w','w',0.1)+bnum('H','bm-h','h',0.1)+bnum('D','bm-d','d',0.1);
    } else if(kind==='light'){
      html+=bcol('Color','bm-color','color');
      html+=bnum('Intensity','bm-int','intensity',0.1)+bnum('Distance','bm-dist','distance',1);
    } else if(kind==='elevated'){
      html+=bnum('Elevation','bm-elev','elevation',0.3);
      html+=bsel('Type','bm-type','type',['step','platform']);
    }
  } else {
    html+=`<p class="hint" style="margin-top:4px">Mixed types.</p>`;
    if(items.every(i=>i.data.elevation!==undefined)) html+=bnum('Elevation','bm-elev','elevation',0.3);
  }
  html+=`<p class="hint" style="margin-top:6px;font-size:10px">Changes apply to all ${n} items  ·  Del=delete  Ctrl+D=dup</p>`;
  propsContent.innerHTML=html;

  // Bind helpers
  const bBN=(id,field)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ const v=parseFloat(el.value); if(isNaN(v))return; _pushUndo(); items.forEach(i=>{i.data[field]=v;}); rebuildLevel(); }); };
  const bBC=(id,field)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ const v=parseInt(el.value.replace('#',''),16); _pushUndo(); items.forEach(i=>{i.data[field]=v;}); rebuildLevel(); }); };
  const bBS=(id,field)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ if(!el.value)return; _pushUndo(); items.forEach(i=>{i.data[field]=el.value;}); rebuildLevel(); }); };

  if(sameKind){
    if(kind==='room'){
      bBN('bm-elev','elevation');
      // Batch palette: show swatches; click to edit that index across all selected rooms
      const palEl=document.getElementById('bm-pal');
      const pickEl=document.getElementById('bm-swatch-pick');
      if(palEl&&pickEl){
        const maxLen=Math.max(...items.map(i=>(i.data.palette||[]).length),0);
        let sw='';
        for(let idx=0;idx<maxLen;idx++){
          const vals=items.map(i=>(i.data.palette||[])[idx]).filter(v=>v!==undefined);
          const same=vals.length&&vals.every(v=>v===vals[0]);
          const hex=same?'#'+vals[0].toString(16).padStart(6,'0'):'#404040';
          sw+=`<span class="palette-swatch" style="background:${hex}${!same?';outline:1px dashed #888':''}" data-idx="${idx}" title="${same?'Click to edit':'Mixed — click to unify'}"><span class="swatch-del">✕</span></span>`;
        }
        palEl.innerHTML=sw;
        let _pickIdx=-1;
        pickEl.addEventListener('change',()=>{
          if(_pickIdx<0)return;
          const v=parseInt(pickEl.value.replace('#',''),16);
          _pushUndo();
          items.forEach(i=>{if(!i.data.palette)i.data.palette=[];while(i.data.palette.length<=_pickIdx)i.data.palette.push(0x808080);i.data.palette[_pickIdx]=v;});
          rebuildLevel(); _showPropsForSelection();
        });
        palEl.querySelectorAll('.palette-swatch').forEach(sw=>{
          sw.addEventListener('click',e=>{
            if(e.target.classList.contains('swatch-del')){
              e.stopPropagation();
              const idx=+sw.dataset.idx; _pushUndo();
              items.forEach(i=>{if(i.data.palette)i.data.palette.splice(idx,1);});
              rebuildLevel(); _showPropsForSelection(); return;
            }
            _pickIdx=+sw.dataset.idx;
            const vals=items.map(i=>(i.data.palette||[])[_pickIdx]).filter(v=>v!==undefined);
            pickEl.value='#'+(vals.length?vals[0]:0x808080).toString(16).padStart(6,'0');
            pickEl.click();
          });
        });
        document.getElementById('bm-addpal')?.addEventListener('click',()=>{ _pushUndo(); items.forEach(i=>{if(!i.data.palette)i.data.palette=[];i.data.palette.push(0x808080);}); rebuildLevel(); _showPropsForSelection(); });
      }
    } else if(kind==='standalone'){ bBN('bm-elev','elevation'); bBC('bm-color','color'); }
    else if(kind==='decor'){ bBC('bm-color','color'); bBN('bm-w','w'); bBN('bm-h','h'); bBN('bm-d','d'); }
    else if(kind==='light'){ bBC('bm-color','color'); bBN('bm-int','intensity'); bBN('bm-dist','distance'); }
    else if(kind==='elevated'){ bBN('bm-elev','elevation'); bBS('bm-type','type'); }
  } else {
    bBN('bm-elev','elevation');
  }
}

function _showProps(kind, data) {
  if (!data) { propsContent.innerHTML='<p class="hint">Data not found.</p>'; return; }
  let html='';
  if(kind==='room') html=`<div class="prop-heading">Room</div>
    ${_tr('ID','pr-id',data.id)}
    ${_tn('xMin','pr-xmin',data.xMin)}${_tn('xMax','pr-xmax',data.xMax)}
    ${_tn('zMin','pr-zmin',data.zMin)}${_tn('zMax','pr-zmax',data.zMax)}
    ${_tn('Elevation','pr-elev',data.elevation||0,0.3)}
    ${_palRows(data)}`;
  else if(kind==='elevated') html=`<div class="prop-heading">Elevated Tile</div>
    ${_tn('Elevation','pe-elev',data.elevation,0.3)}
    ${_tsel('Type','pe-type',data.type,['step','platform'])}`;
  else if(kind==='standalone') html=`<div class="prop-heading">Standalone Tile</div>
    ${_tn('X','ps-x',data.x)}${_tn('Z','ps-z',data.z)}
    ${_tn('Elevation','ps-elev',data.elevation||0,0.3)}${_tcol('Color','ps-color',data.color)}`;
  else if(kind==='decor') html=`<div class="prop-heading">Decorative</div>
    ${_tr('ID','pd-id',data.id)}
    ${_tn('X','pd-x',data.x)}${_tn('Y','pd-y',data.y)}${_tn('Z','pd-z',data.z)}
    ${_tn('W','pd-w',data.w,0.1)}${_tn('H','pd-h',data.h,0.1)}${_tn('D','pd-d',data.d,0.1)}
    ${_tcol('Color','pd-color',data.color)}`;
  else if(kind==='light') html=`<div class="prop-heading">Light</div>
    ${_tr('ID','pl-id',data.id)}
    ${_tn('X','pl-x',data.x)}${_tn('Y','pl-y',data.y)}${_tn('Z','pl-z',data.z)}
    ${_tn('Intensity','pl-int',data.intensity,0.1)}${_tn('Distance','pl-dist',data.distance,1)}
    ${_tcol('Color','pl-color',data.color)}`;
  propsContent.innerHTML=html;
  _bindProps(kind,data);
}

const _tr  =(l,id,v)=>     `<div class="prop-row"><label>${l}</label><input type="text"   id="${id}" value="${v||''}"></div>`;
const _tn  =(l,id,v,s=1)=> `<div class="prop-row"><label>${l}</label><input type="number" id="${id}" value="${v||0}" step="${s}"></div>`;
const _tsel=(l,id,v,opts)=>`<div class="prop-row"><label>${l}</label><select id="${id}">${opts.map(o=>`<option value="${o}"${o===v?' selected':''}>${o}</option>`).join('')}</select></div>`;
const _tcol=(l,id,v)=>{ const h='#'+((v||0x808080)>>>0).toString(16).padStart(6,'0'); return `<div class="prop-row"><label>${l}</label><input type="color" id="${id}" value="${h}"></div>`; };
function _palRows(room) {
  if(!room.palette) return '';
  const sw=room.palette.map((c,i)=>{const h='#'+c.toString(16).padStart(6,'0');return `<span class="palette-swatch" style="background:${h}" data-idx="${i}"><span class="swatch-del">✕</span></span>`;}).join('');
  return `<div class="prop-row palette-row"><label>Palette</label><div class="palette-list" id="pp-pal">${sw}</div><button class="small-btn" id="pp-add">+ Add</button></div>`;
}
function _bindProps(kind,data) {
  const b=(id,field,num,col)=>{ const el=document.getElementById(id); if(!el) return; el.addEventListener('change',()=>{ let v=el.value; if(col) v=parseInt(v.replace('#',''),16); else if(num) v=parseFloat(v); data[field]=v; rebuildLevel(); if(kind==='room'){_updateRoomBoundsBox(data.id);_updateHandles(data.id);} }); };
  if(kind==='room')       { b('pr-id','id'); b('pr-xmin','xMin',true); b('pr-xmax','xMax',true); b('pr-zmin','zMin',true); b('pr-zmax','zMax',true); b('pr-elev','elevation',true); document.getElementById('pp-pal')?.querySelectorAll('.swatch-del').forEach(d=>d.addEventListener('click',e=>{e.stopPropagation();data.palette.splice(+d.parentElement.dataset.idx,1);rebuildLevel();_showProps('room',data);})); document.getElementById('pp-add')?.addEventListener('click',()=>{data.palette.push(0x808080);rebuildLevel();_showProps('room',data);}); }
  else if(kind==='elevated') { b('pe-elev','elevation',true); b('pe-type','type'); }
  else if(kind==='standalone') { b('ps-x','x',true); b('ps-z','z',true); b('ps-elev','elevation',true); b('ps-color','color',false,true); }
  else if(kind==='decor') { b('pd-x','x',true); b('pd-y','y',true); b('pd-z','z',true); b('pd-w','w',true); b('pd-h','h',true); b('pd-d','d',true); b('pd-color','color',false,true); }
  else if(kind==='light') { b('pl-x','x',true); b('pl-y','y',true); b('pl-z','z',true); b('pl-int','intensity',true); b('pl-dist','distance',true); b('pl-color','color',false,true); }
}

// ── Layers list ───────────────────────────────────────────────────────────────
const layersList=document.getElementById('layers-list');
function _refreshLayersList() {
  const row=(kind,id,icon,name,sub)=>`<div class="layer-item${selContains(kind,id)?' selected':''}" data-kind="${kind}" data-id="${id}"><span class="layer-icon">${icon}</span><span class="layer-name">${name}</span><span class="layer-kind">${sub}</span></div>`;
  const rows=[];
  ES.rooms.forEach(r=>rows.push(row('room',r.id,'▣',r.id,r.type)));
  ES.elevatedTiles.forEach(et=>{ const k=`${et.x},${et.z}`; rows.push(row('elevated',k,'▲',`(${et.x},${et.z})`,et.type)); });
  ES.standaloneTiles.forEach(st=>rows.push(row('standalone',st.id,'◻',st.id,'tile')));
  ES.decoratives.forEach(d=>rows.push(row('decor',d.id,'□',d.id,'decor')));
  ES.lights.forEach(l=>rows.push(row('light',l.id,'✦',l.id,'light')));
  layersList.innerHTML=rows.join('');
  layersList.querySelectorAll('.layer-item').forEach(el=>{
    el.addEventListener('click',e=>{
      const{kind,id}=el.dataset;
      const ctrl=e.ctrlKey||e.metaKey;
      if(ctrl) { selContains(kind,id)?selRemove(kind,id):selAdd(kind,id); }
      else      { selSet(kind,id); }
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    });
  });
}

// ── Status ────────────────────────────────────────────────────────────────────
function _setStatus(msg) { document.getElementById('status-text').textContent=msg; }

// ── Toolbar + keyboard ────────────────────────────────────────────────────────
document.getElementById('tool-buttons').querySelectorAll('.tool-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ES.tool=btn.dataset.tool;
    _setStatus({select:'Select — click / Ctrl+click / drag marquee in any ortho view  ·  drag room to move  ·  arrow keys to nudge',room:'Room — drag rectangle in TOP view',tile:'Tile — click TOP view to place  ·  drag to move when selected',elevated:'Elevated — click tile in TOP view',lava:'Lava — click to toggle lava on room tiles',decor:'Decor — click TOP view',light:'Light — click TOP view',spawn:'Spawn — click TOP view'}[ES.tool]||ES.tool);
    canvas.style.cursor=ES.tool==='select'?'default':'crosshair';
  });
});

window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  const map={s:'select',r:'room',t:'tile',e:'elevated',v:'lava',d:'decor',l:'light',p:'spawn'};
  if(map[e.key.toLowerCase()]) document.querySelector(`[data-tool="${map[e.key.toLowerCase()]}"]`)?.click();
  if(e.key==='Delete'||e.key==='Backspace') _deleteSelected();
  if(e.ctrlKey&&e.key.toLowerCase()==='z') { e.preventDefault(); _undo(); }
  if(e.ctrlKey&&e.key.toLowerCase()==='d') { e.preventDefault(); _duplicateSelection(); }

  // Arrow keys — move selection
  if(e.key==='ArrowLeft')  { e.preventDefault(); _moveSelection(-1,0); }
  if(e.key==='ArrowRight') { e.preventDefault(); _moveSelection(1,0); }
  if(e.key==='ArrowUp')    { e.preventDefault(); _moveSelection(0,-1); }
  if(e.key==='ArrowDown')  { e.preventDefault(); _moveSelection(0,1); }

  // WASD perspective fly (only when no modifier)
  if(!e.ctrlKey&&!e.altKey) {
    const spd=0.4;
    const dir=new THREE.Vector3(Math.cos(perspPitch)*Math.sin(perspYaw),0,Math.cos(perspPitch)*Math.cos(perspYaw)).normalize();
    const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize();
    if(e.key.toLowerCase()==='w') perspPos.addScaledVector(dir,spd);
    if(e.key.toLowerCase()==='s') perspPos.addScaledVector(dir,-spd);
    if(e.key.toLowerCase()==='a') perspPos.addScaledVector(right,-spd);
    if(e.key.toLowerCase()==='d') perspPos.addScaledVector(right,spd);
    if(e.key==='q') perspPos.y-=spd;
    if(e.key==='e') perspPos.y+=spd;
    _applyPerspCam();
  }
});

// Dup button in panel
document.getElementById('btn-dup-obj').addEventListener('click', _duplicateSelection);
document.getElementById('btn-del-obj').addEventListener('click', _deleteSelected);

// ── Tool actions ──────────────────────────────────────────────────────────────
let _idCtr=1000;
const _nextId=pfx=>`${pfx}_${++_idCtr}`;

function _toggleLava(cx,cy) {
  const wp=topToWorld(cx,cy); if(!wp) return;
  const tx=Math.round(wp.x),tz=Math.round(wp.z);
  const room=ES.rooms.find(r=>r.type!=='ramp'&&tx>=r.xMin&&tx<=r.xMax&&tz>=r.zMin&&tz<=r.zMax);
  if(!room) { _setStatus('No room tile here'); return; }
  if(!room.lavaCoords)  room.lavaCoords=[];
  if(!room.lavaPalette) room.lavaPalette=[0xff3300,0xff4400,0xff5500,0xee4400];
  const idx=room.lavaCoords.findIndex(([lx,lz])=>lx===tx&&lz===tz);
  if(idx>=0) { room.lavaCoords.splice(idx,1); _setStatus(`Lava removed (${tx},${tz})`); }
  else       { room.lavaCoords.push([tx,tz]);  _setStatus(`Lava painted (${tx},${tz})`); }
  rebuildLevel();
}
function _placeTile(x,z) { _pushUndo(); const id=_nextId('tile'); ES.standaloneTiles.push({id,x,z,elevation:0,color:0x505060}); rebuildLevel(); selSet('standalone',id); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection(); _setStatus(`Tile at (${x},${z})`); }
function _placeDecor(x,z) { _pushUndo(); const id=_nextId('decor'); ES.decoratives.push({id,type:'box',x,y:0.5,z,w:1,h:1,d:1,color:0x808080,castShadow:true}); rebuildLevel(); selSet('decor',id); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection(); _setStatus(`Decor at (${x},${z})`); }
function _placeLight(x,z) { _pushUndo(); const id=_nextId('light'); ES.lights.push({id,color:0xffffff,intensity:1.5,distance:10,x,y:2,z}); rebuildLevel(); selSet('light',id); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection(); _setStatus(`Light at (${x},${z})`); }

// ── SVG draw rect ─────────────────────────────────────────────────────────────
const drawRect=document.getElementById('draw-rect');
function _showDrawRect(v) { drawRect.setAttribute('visibility',v?'visible':'hidden'); }
function _updateDrawRect() {
  if(!ES.drawStart||!ES.drawEnd) return;
  const x0=Math.min(ES.drawStart.x,ES.drawEnd.x),x1=Math.max(ES.drawStart.x,ES.drawEnd.x);
  const z0=Math.min(ES.drawStart.z,ES.drawEnd.z),z1=Math.max(ES.drawStart.z,ES.drawEnd.z);
  const c0=worldToCSS(x0-0.5,0,z0-0.5,'top'), c1=worldToCSS(x1+0.5,0,z1+0.5,'top');
  drawRect.setAttribute('x',Math.min(c0.x,c1.x)); drawRect.setAttribute('y',Math.min(c0.y,c1.y));
  drawRect.setAttribute('width',Math.abs(c1.x-c0.x)); drawRect.setAttribute('height',Math.abs(c1.y-c0.y));
}

// ── Room dialog ───────────────────────────────────────────────────────────────
const roomDialog=document.getElementById('room-dialog');
const rdType=document.getElementById('rd-type');
let _rdPalette=[0x505060,0x585868,0x4a4a5a];
let _pendingBounds=null;
rdType.addEventListener('change',()=>{document.getElementById('rd-ramp-opts').classList.toggle('hidden',rdType.value!=='ramp');document.getElementById('rd-corridor-opts').classList.toggle('hidden',rdType.value!=='corridor');});
function _openRoomDialog(x0,x1,z0,z1) { _pendingBounds={x0,x1,z0,z1}; document.getElementById('rd-bounds-text').textContent=`X ${x0}→${x1}  Z ${z0}→${z1}`; document.getElementById('rd-id').value=_nextId('room'); _renderRdPalette(); roomDialog.classList.remove('hidden'); }
function _renderRdPalette() { const el=document.getElementById('rd-palette-list'); el.innerHTML=_rdPalette.map((c,i)=>{const h='#'+c.toString(16).padStart(6,'0');return `<span class="palette-swatch" style="background:${h}" data-idx="${i}"><span class="swatch-del">✕</span></span>`;}).join(''); el.querySelectorAll('.swatch-del').forEach(d=>d.addEventListener('click',e=>{e.stopPropagation();_rdPalette.splice(+d.parentElement.dataset.idx,1);_renderRdPalette();})); }
document.getElementById('rd-add-color').addEventListener('click',()=>{_rdPalette.push(0x808080);_renderRdPalette();});
document.getElementById('rd-cancel').addEventListener('click',()=>{roomDialog.classList.add('hidden');_pendingBounds=null;});
document.getElementById('rd-create').addEventListener('click',()=>{
  if(!_pendingBounds) return;
  const{x0,x1,z0,z1}=_pendingBounds, type=rdType.value;
  const room={id:document.getElementById('rd-id').value||_nextId('room'),type,tileType:document.getElementById('rd-tiletype').value||type,xMin:x0,xMax:x1,zMin:z0,zMax:z1,elevation:parseFloat(document.getElementById('rd-elevation').value)||0,palette:[..._rdPalette]};
  if(type==='corridor') room.doorColor=parseInt(document.getElementById('rd-doorcolor').value.replace('#',''),16);
  if(type==='ramp')     { room.elevationAxis=document.getElementById('rd-rampaxis').value; room.elevationStart=parseFloat(document.getElementById('rd-rampstart').value)||0.3; }
  _pushUndo(); ES.rooms.push(room); rebuildLevel(); selSet('room',room.id); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  roomDialog.classList.add('hidden'); _pendingBounds=null; _setStatus(`Room "${room.id}" created`);
});

// ── Elevated dialog ───────────────────────────────────────────────────────────
const elevDialog=document.getElementById('elev-dialog'); let _pendingElev=null;
function _openElevDialog(x,z) { _pendingElev={x,z}; elevDialog.classList.remove('hidden'); }
document.getElementById('ed-cancel').addEventListener('click',()=>{elevDialog.classList.add('hidden');_pendingElev=null;});
document.getElementById('ed-ok').addEventListener('click',()=>{
  if(!_pendingElev) return;
  const{x,z}=_pendingElev, elev=parseFloat(document.getElementById('ed-elev').value)||0.3, type=document.getElementById('ed-type').value;
  ES.elevatedTiles=ES.elevatedTiles.filter(e=>!(e.x===x&&e.z===z));
  _pushUndo(); ES.elevatedTiles.push({x,z,elevation:elev,type});
  rebuildLevel(); selSet('elevated',`${x},${z}`); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  elevDialog.classList.add('hidden'); _pendingElev=null; _setStatus(`Elevated tile (${x},${z}) elev=${elev}`);
});

// ── Metadata ──────────────────────────────────────────────────────────────────
document.getElementById('meta-name').addEventListener('change',e=>ES.levelName=e.target.value);
document.getElementById('meta-id').addEventListener('change',e=>ES.levelId=e.target.value);
document.getElementById('meta-steph').addEventListener('change',e=>ES.stepHeight=parseFloat(e.target.value)||0.3);
document.getElementById('meta-spawnx').addEventListener('change',e=>{ ES.playerStart.x=+e.target.value||0; spawnMesh.position.setX(ES.playerStart.x); });
document.getElementById('meta-spawnz').addEventListener('change',e=>{ ES.playerStart.z=+e.target.value||0; spawnMesh.position.setZ(ES.playerStart.z); });

// ── Export / Import ───────────────────────────────────────────────────────────
function _serialize() {
  const d={id:ES.levelId,name:ES.levelName,stepHeight:ES.stepHeight,playerStart:ES.playerStart,rooms:ES.rooms,elevatedTiles:ES.elevatedTiles,decoratives:ES.decoratives,lights:ES.lights,portals:ES.portals};
  return `// ─── ${d.name} ────\n(function () {\n  window.LEVELS = window.LEVELS || {};\n  window.LEVELS[${JSON.stringify(d.id)}] = ${JSON.stringify(d,null,2)};\n}());`;
}
document.getElementById('btn-export').addEventListener('click',()=>{document.getElementById('export-text').value=_serialize();document.getElementById('export-modal').classList.remove('hidden');});
document.getElementById('btn-copy-export').addEventListener('click',()=>{const ta=document.getElementById('export-text');ta.select();document.execCommand('copy');_setStatus('Copied');});
document.getElementById('btn-dl-export').addEventListener('click',()=>{ const blob=new Blob([document.getElementById('export-text').value],{type:'text/javascript'}); const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:ES.levelId+'.js'}); a.click(); });
document.getElementById('btn-close-export').addEventListener('click',()=>document.getElementById('export-modal').classList.add('hidden'));
document.getElementById('btn-import').addEventListener('click',()=>document.getElementById('import-modal').classList.remove('hidden'));
document.getElementById('btn-cancel-import').addEventListener('click',()=>document.getElementById('import-modal').classList.add('hidden'));
document.getElementById('btn-do-import').addEventListener('click',()=>{
  const code=document.getElementById('import-text').value.trim(); if(!code) return;
  try { const bk=window.LEVELS; window.LEVELS={}; new Function(code)(); const keys=Object.keys(window.LEVELS); if(!keys.length) throw new Error('No LEVELS found'); _loadLevel(window.LEVELS[keys[0]]); window.LEVELS=bk; document.getElementById('import-modal').classList.add('hidden'); _setStatus('Imported'); }
  catch(err) { alert('Import failed: '+err.message); }
});
document.getElementById('btn-load-lvl1').addEventListener('click',()=>{ if(!window.LEVELS?.level1){_setStatus('level1.js not loaded');return;} _loadLevel(window.LEVELS.level1); _setStatus('Loaded level1'); });
document.getElementById('btn-new').addEventListener('click',()=>{
  if(!confirm('Clear current level?')) return;
  ES.rooms=[]; ES.elevatedTiles=[]; ES.decoratives=[]; ES.lights=[]; ES.portals=[]; ES.standaloneTiles=[]; selClear();
  ES.levelId='level_new'; ES.levelName='New Level'; ES.stepHeight=0.3; ES.playerStart={x:0,z:0};
  ['meta-name','meta-id','meta-steph','meta-spawnx','meta-spawnz'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value={['meta-name']:'New Level',['meta-id']:'level_new',['meta-steph']:'0.3',['meta-spawnx']:'0',['meta-spawnz']:'0'}[id]||''; });
  rebuildLevel(); _showPropsForSelection(); _setStatus('New level');
});
function _loadLevel(lvl) {
  ES.levelId=lvl.id||'level1'; ES.levelName=lvl.name||'Imported'; ES.stepHeight=lvl.stepHeight||0.3;
  ES.playerStart=lvl.playerStart||{x:0,z:0}; ES.rooms=lvl.rooms||[]; ES.elevatedTiles=lvl.elevatedTiles||[];
  ES.decoratives=lvl.decoratives||[]; ES.lights=lvl.lights||[]; ES.portals=lvl.portals||[]; ES.standaloneTiles=[]; selClear();
  document.getElementById('meta-name').value=ES.levelName; document.getElementById('meta-id').value=ES.levelId;
  document.getElementById('meta-steph').value=ES.stepHeight; document.getElementById('meta-spawnx').value=ES.playerStart.x; document.getElementById('meta-spawnz').value=ES.playerStart.z;
  rebuildLevel(); _showPropsForSelection();
}

// ── Render loop ───────────────────────────────────────────────────────────────
function _resize() {
  const W=canvas.clientWidth, H=canvas.clientHeight;
  renderer.setSize(W,H,false);
  perspCam.aspect=(W/2)/(H/2); perspCam.updateProjectionMatrix();
  _updateOrthoCameras(); _applyTopCam(); _applyFrontCam(); _applySideCam();
}
new ResizeObserver(_resize).observe(canvas.parentElement);
_resize();

function _renderVP(name, cam, isLive) {
  const r=getViewportRect(name), W=canvas.clientWidth, H=canvas.clientHeight;
  const bly=H-r.y-r.h;
  renderer.setViewport(r.x,bly,r.w,r.h); renderer.setScissor(r.x,bly,r.w,r.h); renderer.setScissorTest(true);
  renderer.clear(true,true,true);
  scene.overrideMaterial=isLive?null:wireframeMat;
  renderer.render(scene,cam);
  scene.overrideMaterial=null;
  if(!isLive) renderer.clearDepth();
  renderer.render(helperScene,cam);
}
function animate() {
  requestAnimationFrame(animate);
  _renderVP('persp',perspCam,true);
  _renderVP('top',  topCam,  false);
  _renderVP('front',frontCam,false);
  _renderVP('side', sideCam, false);
  renderer.setScissorTest(false);
}
animate();

// ── Init ──────────────────────────────────────────────────────────────────────
_setStatus('Ready  ·  S=Select  R=Room  T=Tile  E=Elev  V=Lava  D=Decor  L=Light  P=Spawn');
rebuildLevel();

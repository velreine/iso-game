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
  brushes:   [],  // Hammer-style solid brushes
  navMesh:   [],  // baked nav tiles [{id,x,z,elevation,cost,navGroupId?}]
  navGroups: [],  // sub-groups within the virtual _navmesh folder [{id,name,collapsed}]
  groups:    [],  // [{id, name, collapsed, items:[{kind,id}]}]
  entities: [],   // unified entity list [{id, entityType:'decor'|'light'|'spawn', x,y,z, ...}]

  // Multi-selection: array of {kind, id}
  // kind: 'room' | 'elevated' | 'decor' | 'light' | 'standalone' | 'brush' | 'entity'
  selection: [],

  tool: 'select',

  // Room/brush draw drag
  drawing:   false,
  drawStart: null,
  drawEnd:   null,

  undoStack: [],
};

// BoxGeometry face-group order (Three.js r128): px nx py ny pz nz
const FACE_ORDER = ['px','nx','py','ny','pz','nz'];
const FACE_LABEL = { py:'Top +Y', ny:'Bot −Y', px:'Rt +X', nx:'Lt −X', pz:'Ft +Z', nz:'Bk −Z' };
let _showNavMesh = false;
let _selectedFace = null; // { brushId, faceKey } — face highlighted in panel

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

// Tiles are centered at integers; their edges fall at ±0.5, ±1.5, etc.
// Shifting each grid by 0.5 in its two active axes puts grid lines on tile boundaries.
gridTop.position.set(0.5, 0,   0.5);   // XZ: offset X and Z
gridFront.position.set(0.5, 0.5, 0);   // XY: offset X and Y
gridSide.position.set(0,   0.5, 0.5);  // ZY: offset Y and Z

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
const HANDLE_AXES  = ['xMin', 'xMax', 'zMin', 'zMax', 'yMin', 'yMax',
                      'xMinzMin', 'xMinzMax', 'xMaxzMin', 'xMaxzMax',   // XZ corners (Top)
                      'xMinyMin', 'xMinyMax', 'xMaxyMin', 'xMaxyMax',   // XY corners (Front)
                      'zMinyMin', 'zMinyMax', 'zMaxyMin', 'zMaxyMax'];  // ZY corners (Side)
const HANDLE_COLOR = {
  xMin: 0xff4444, xMax: 0xff4444, zMin: 0x4488ff, zMax: 0x4488ff,
  yMin: 0x44cc44, yMax: 0x44cc44,
  xMinzMin: 0xffcc00, xMinzMax: 0xffcc00, xMaxzMin: 0xffcc00, xMaxzMax: 0xffcc00,
  xMinyMin: 0xffcc00, xMinyMax: 0xffcc00, xMaxyMin: 0xffcc00, xMaxyMax: 0xffcc00,
  zMinyMin: 0xffcc00, zMinyMax: 0xffcc00, zMaxyMin: 0xffcc00, zMaxyMax: 0xffcc00,
};
const CORNER_AXES = ['xMinzMin', 'xMinzMax', 'xMaxzMin', 'xMaxzMax',
                     'xMinyMin', 'xMinyMax', 'xMaxyMin', 'xMaxyMax',
                     'zMinyMin', 'zMinyMax', 'zMaxyMin', 'zMaxyMax'];
const handleMeshes = {};
HANDLE_AXES.forEach(ax => {
  const isCorner = CORNER_AXES.includes(ax);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(isCorner ? 0.4 : 0.5, isCorner ? 0.4 : 0.5, isCorner ? 0.4 : 0.5),
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
spawnMesh.visible = false;
helperScene.add(spawnMesh);

// Boundary box outline for the spawn point (helperScene — never wireframed)
const spawnEdgeBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.7, 0.95, 0.7)),
  new THREE.LineBasicMaterial({ color: 0x00ff88 })
);
spawnEdgeBox.visible = false;
helperScene.add(spawnEdgeBox);

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

// Isometric home — mirrors the game camera exactly (CAM_HEIGHT=18, angle=π/4, looking at origin)
// pos (18,18,18) → dir toward (0,0,0) → yaw = -¾π, pitch = -asin(1/√3) ≈ -0.6155
const ISO_YAW   = -Math.PI * 0.75;
const ISO_PITCH = -Math.asin(1 / Math.sqrt(3));   // ≈ -0.6155 rad  (~35.26°)
const ISO_POS   = new THREE.Vector3(18, 18, 18);

let perspYaw   = ISO_YAW;
let perspPitch = ISO_PITCH;
let perspPos   = ISO_POS.clone();
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
// World XY from front-view click
function frontToWorld(cx, cy) {
  const r=getViewportRect('front');
  const asp=canvas.clientWidth/canvas.clientHeight;
  const clipX=((cx-r.x)/r.w)*2-1, clipY=-((cy-r.y)/r.h)*2+1;
  return { x: frontPanX + clipX*orthoZoom*asp, y: frontPanY + clipY*orthoZoom };
}
// World ZY from side-view click (side cam looks from -X; screen-right = world +Z)
function sideToWorld(cx, cy) {
  const r=getViewportRect('side');
  const asp=canvas.clientWidth/canvas.clientHeight;
  const clipX=((cx-r.x)/r.w)*2-1, clipY=-((cy-r.y)/r.h)*2+1;
  return { z: sidePanZ + clipX*orthoZoom*asp, y: sidePanY + clipY*orthoZoom };
}
// World Y from mouse position in front or side view (ortho, Y is vertical axis)
function _worldYFromView(cx, cy, vp) {
  if (vp!=='front'&&vp!=='side') return null;
  const clip=toClip(vp,cx,cy);
  return (vp==='front'?frontPanY:sidePanY)+clip.y*orthoZoom;
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
let tileMeshes=[], wallMeshes=[], decorMeshes=[], lightMeshes=[], standaloneMs=[], brushMeshes=[], entityMeshes=[];

// Nav mesh overlay lives in helperScene (never wireframed)
const navOverlayGroup = new THREE.Group();
helperScene.add(navOverlayGroup);

// Edge-outline overlays for solid brushes (helperScene — never wireframed)
const brushEdgeGroup = new THREE.Group();
helperScene.add(brushEdgeGroup);

// Nav cell hitboxes — always present for raycasting regardless of Show Nav state
const navHitboxGroup = new THREE.Group();
helperScene.add(navHitboxGroup);

// Virtual _navmesh folder collapsed state
let _navFolderCollapsed = false;
const _navMat = new THREE.MeshBasicMaterial({ color:0x00ff88, transparent:true, opacity:0.35, depthWrite:false, side:THREE.DoubleSide });

function rebuildLevel() {
  while (levelGroup.children.length) {
    const o=levelGroup.children[0]; levelGroup.remove(o);
    if (o.geometry) o.geometry.dispose();
  }
  while (brushEdgeGroup.children.length) {
    const o=brushEdgeGroup.children[0]; brushEdgeGroup.remove(o);
    if (o.geometry) o.geometry.dispose();
  }
  while (navHitboxGroup.children.length) {
    const o=navHitboxGroup.children[0]; navHitboxGroup.remove(o);
    if (o.geometry) o.geometry.dispose();
  }
  tileMeshes=[]; wallMeshes=[]; decorMeshes=[]; lightMeshes=[]; standaloneMs=[]; brushMeshes=[]; entityMeshes=[];
  tileMap={};
  spawnMesh.visible = false;    // re-shown by _buildEntityMesh if a spawn entity exists
  spawnEdgeBox.visible = false;

  ES.rooms.forEach(r => r.type==='ramp' ? _buildRampRoom(r) : _buildRoom(r));
  ES.elevatedTiles.forEach(_buildElevatedTile);
  ES.standaloneTiles.forEach(_buildStandaloneTile);
  _buildWalls();
  ES.decoratives.forEach(_buildDecorMesh);   // legacy backward compat
  ES.lights.forEach(_buildLightHelper);       // legacy backward compat
  ES.brushes.forEach(_buildBrushMesh);
  ES.entities.forEach(_buildEntityMesh);
  _buildNavOverlay();
  _buildNavHitboxes();

  // Use spawn entity position if one exists, otherwise ES.playerStart
  const _spawnEnt = ES.entities.find(e => e.entityType === 'spawn');
  spawnMesh.position.set(_spawnEnt ? _spawnEnt.x : ES.playerStart.x, 0.4, _spawnEnt ? _spawnEnt.z : ES.playerStart.z);
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

function _buildBrushMesh(brush) {
  // Tile-indexed: brush visually spans (xMin-0.5, yMin, zMin-0.5) to (xMax+0.5, yMax, zMax+0.5)
  const w=(brush.xMax-brush.xMin)+1, h=brush.yMax-brush.yMin, d=(brush.zMax-brush.zMin)+1;
  if (h<=0) return;
  const geo=new THREE.BoxGeometry(w,h,d);
  const pos=new THREE.Vector3((brush.xMin+brush.xMax)/2,(brush.yMin+brush.yMax)/2,(brush.zMin+brush.zMax)/2);

  if (brush.brushClass==='trigger') {
    // Trigger zones: semi-transparent fill + edge outline (editor-only, invisible in game)
    const tCol = brush.triggerColor ?? 0x4488ff;
    const fillMat = new THREE.MeshBasicMaterial({ color:tCol, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, fillMat);
    mesh.position.copy(pos);
    mesh.userData={kind:'brush',id:brush.id,brushClass:'trigger'};
    levelGroup.add(mesh); brushMeshes.push(mesh);
    // Edge wireframe overlay
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color:tCol, transparent:true, opacity:0.8 })
    );
    mesh.add(edges);
    return;
  }

  // Solid brush — per-face materials (Three.js BoxGeometry group order: px nx py ny pz nz)
  const mats=FACE_ORDER.map(fk=>{
    const f=(brush.faces||{})[fk]||{};
    if (f.nodraw) return new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false});
    return new THREE.MeshLambertMaterial({color:f.color??0x808080});
  });
  const mesh=new THREE.Mesh(geo,mats);
  mesh.position.copy(pos);
  mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={kind:'brush',id:brush.id,brushClass:'solid'};
  levelGroup.add(mesh); brushMeshes.push(mesh);

  // EdgesGeometry overlay in helperScene — draws clean box outlines (no diagonal artifacts)
  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x6666aa, depthTest: false })
  );
  edgeLines.position.copy(pos);
  brushEdgeGroup.add(edgeLines);
}

// Derive integer nav tiles from walkable brushes + rooms + standalone tiles
// mode: 'override' (replace all) | 'new' (add only coordinates not already present)
function _compileNavMesh(mode='override') {
  const cells={};
  const SH = ES.stepHeight || STEP_H;
  const stamp=(x,z,elev)=>{ const k=`${x},${z}`; if(!cells[k]||cells[k].elevation<elev) cells[k]={x,z,elevation:elev}; };

  // Brushes — walkable, use yMax as walking surface
  ES.brushes.forEach(b=>{
    if(!b.walkable || b.brushClass==='trigger') return;
    for(let x=b.xMin;x<=b.xMax;x++) for(let z=b.zMin;z<=b.zMax;z++) stamp(x,z,b.yMax);
  });

  // Rooms — handle ramps with per-step elevation
  ES.rooms.forEach(r=>{
    if(r.type==='ramp'){
      const axis=r.elevationAxis||'x';
      const steps=axis==='z'?r.zMax-r.zMin+1:r.xMax-r.xMin+1;
      for(let s=0;s<steps;s++){
        const elev=(r.elevationStart||SH)+SH*s;
        if(axis==='z'){ for(let x=r.xMin;x<=r.xMax;x++) stamp(x,r.zMin+s,elev); }
        else           { for(let z=r.zMin;z<=r.zMax;z++) stamp(r.xMin+s,z,elev); }
      }
    } else {
      for(let x=r.xMin;x<=r.xMax;x++) for(let z=r.zMin;z<=r.zMax;z++) stamp(x,z,r.elevation||0);
    }
  });

  // Elevated tiles
  ES.elevatedTiles.forEach(et=>stamp(et.x,et.z,et.elevation||0));

  // Standalone tiles
  ES.standaloneTiles.forEach(st=>stamp(st.x,st.z,st.elevation||0));

  if (mode==='new') {
    // Keep existing cells; only add newly discovered coordinates
    const existing = new Map(ES.navMesh.map(c=>[`${c.x},${c.z}`,c]));
    Object.values(cells).forEach(c=>{
      if (!existing.has(`${c.x},${c.z}`)) {
        ES.navMesh.push({ id:_nextId('nav'), x:c.x, z:c.z, elevation:c.elevation, cost:1 });
      }
    });
  } else {
    // Override all — assign new IDs and default costs
    ES.navMesh = Object.values(cells).map(c=>({ id:_nextId('nav'), x:c.x, z:c.z, elevation:c.elevation, cost:1 }));
  }

  _buildNavOverlay();
  _buildNavHitboxes();
  _refreshLayersList();
  _setStatus(`Nav compiled (${mode}) — ${ES.navMesh.length} cell(s)  ·  export to bake`);
  return ES.navMesh;
}

function _buildNavOverlay() {
  while(navOverlayGroup.children.length){ const o=navOverlayGroup.children[0]; navOverlayGroup.remove(o); if(o.geometry)o.geometry.dispose(); }
  if (!_showNavMesh||!ES.navMesh.length) return;
  ES.navMesh.forEach(cell=>{
    const isSel = selContains('nav', cell.id);
    const mat = isSel
      ? new THREE.MeshBasicMaterial({ color:0xffff44, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide })
      : _navMat;
    const geo=new THREE.PlaneGeometry(0.92,0.92);
    const m=new THREE.Mesh(geo,mat);
    m.rotation.x=-Math.PI/2;
    m.position.set(cell.x,(cell.elevation??0)+0.012,cell.z);
    navOverlayGroup.add(m);
  });
}

// Invisible hitbox for each nav cell — always built so cells are always clickable
function _buildNavHitboxes() {
  const geo = new THREE.BoxGeometry(0.9, 0.08, 0.9);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  ES.navMesh.forEach(cell => {
    const m = new THREE.Mesh(geo.clone(), mat.clone());
    m.position.set(cell.x, (cell.elevation ?? 0) + 0.04, cell.z);
    m.userData = { kind: 'nav', id: cell.id };
    navHitboxGroup.add(m);
  });
}

function _buildLightHelper(def) {
  const s=new THREE.Mesh(new THREE.SphereGeometry(0.18,6,6),new THREE.MeshBasicMaterial({color:def.color||0xffffff}));
  s.position.set(def.x||0,def.y||2,def.z||0); s.userData={kind:'light',id:def.id};
  levelGroup.add(s); lightMeshes.push(s);
  const w=new THREE.Mesh(new THREE.SphereGeometry(def.distance||5,10,6),new THREE.MeshBasicMaterial({color:def.color||0xffffff,wireframe:true,opacity:0.1,transparent:true}));
  w.position.copy(s.position); levelGroup.add(w); lightMeshes.push(w);
}

function _buildEntityMesh(entity) {
  if (entity.entityType === 'spawn') {
    const sy = 0.475; // centre of 0.95h box sitting on the floor
    spawnMesh.position.set(entity.x, 0.4, entity.z);
    spawnMesh.visible = true;
    spawnEdgeBox.position.set(entity.x, sy, entity.z);
    spawnEdgeBox.visible = true;
    // Invisible hitbox so spawn can be clicked/raycasted like any other entity
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.95, 0.7),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitbox.position.set(entity.x, sy, entity.z);
    hitbox.userData = { kind: 'entity', id: entity.id, entityType: 'spawn' };
    levelGroup.add(hitbox);
    entityMeshes.push(hitbox);
    return;
  }
  if (entity.entityType === 'decor') {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(entity.w||1, entity.h||1, entity.d||1),
      _mat(entity.color||0x606060)
    );
    mesh.position.set(entity.x, entity.y??0.5, entity.z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = {kind:'entity', id:entity.id, entityType:'decor'};
    levelGroup.add(mesh); entityMeshes.push(mesh);
    return;
  }
  if (entity.entityType === 'light') {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 6),
      new THREE.MeshBasicMaterial({color: entity.color||0xffffff})
    );
    s.position.set(entity.x, entity.y??2, entity.z);
    s.userData = {kind:'entity', id:entity.id, entityType:'light'};
    levelGroup.add(s); entityMeshes.push(s);
    // Range sphere (visual only, not selectable)
    const w = new THREE.Mesh(
      new THREE.SphereGeometry(entity.distance||5, 10, 6),
      new THREE.MeshBasicMaterial({color:entity.color||0xffffff, wireframe:true, opacity:0.08, transparent:true})
    );
    w.position.copy(s.position);
    w.userData = {kind:'_entityRange', id:entity.id+'_r'};
    levelGroup.add(w); entityMeshes.push(w);
    return;
  }
}

// ── Selection box pool refresh ────────────────────────────────────────────────
function _refreshSelBoxes() {
  _clearSelBoxPool();
  roomBoundsBox.visible=false; handlesGroup.visible=false;

  ES.selection.forEach(s => {
    const mesh=_findMeshById(s.kind, s.id);
    _addSelOutline(mesh);
  });

  // Update nav overlay highlight whenever selection changes (selected cells turn yellow)
  _buildNavOverlay();

  // Single-room: show bounds box + handles
  const roomSels=ES.selection.filter(s=>s.kind==='room');
  if (roomSels.length===1) {
    _updateRoomBoundsBox(roomSels[0].id);
    _updateHandles(roomSels[0].id, 'room');
  }
  // Single-brush: show handles
  const brushSels=ES.selection.filter(s=>s.kind==='brush');
  if (brushSels.length===1 && roomSels.length===0) {
    _updateHandles(brushSels[0].id, 'brush');
  }
}

function _findMeshById(kind, id) {
  if (kind==='decor')      return decorMeshes.find(m=>m.userData.id===id)||null;
  if (kind==='light')      return lightMeshes.find(m=>m.userData.id===id&&m.userData.kind==='light')||null;
  if (kind==='standalone') return standaloneMs.find(m=>m.userData.id===id)||null;
  if (kind==='room')       return tileMeshes.find(m=>m.userData.roomId===id)||null;
  if (kind==='brush')      return brushMeshes.find(m=>m.userData.id===id)||null;
  if (kind==='entity')     return entityMeshes.find(m=>m.userData.kind==='entity'&&m.userData.id===id)||null;
  if (kind==='nav')        return navHitboxGroup.children.find(m=>m.userData.id===id)||null;
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
function _updateHandles(id, kind) {
  // Hide corners + y handles by default; shown per-kind below
  CORNER_AXES.forEach(ax => { handleMeshes[ax].visible = false; });
  handleMeshes.yMin.visible = false;
  handleMeshes.yMax.visible = false;
  if (kind === 'room') {
    const room=ES.rooms.find(r=>r.id===id);
    if (!room) { handlesGroup.visible=false; return; }
    handlesGroup.visible=true;
    const elev=(room.elevation||0)+0.4, mx=(room.xMin+room.xMax)/2, mz=(room.zMin+room.zMax)/2;
    handleMeshes.xMin.position.set(room.xMin-0.5,elev,mz);
    handleMeshes.xMax.position.set(room.xMax+0.5,elev,mz);
    handleMeshes.zMin.position.set(mx,elev,room.zMin-0.5);
    handleMeshes.zMax.position.set(mx,elev,room.zMax+0.5);
    handleMeshes.xMinzMin.position.set(room.xMin-0.5,elev,room.zMin-0.5); handleMeshes.xMinzMin.visible=true;
    handleMeshes.xMinzMax.position.set(room.xMin-0.5,elev,room.zMax+0.5); handleMeshes.xMinzMax.visible=true;
    handleMeshes.xMaxzMin.position.set(room.xMax+0.5,elev,room.zMin-0.5); handleMeshes.xMaxzMin.visible=true;
    handleMeshes.xMaxzMax.position.set(room.xMax+0.5,elev,room.zMax+0.5); handleMeshes.xMaxzMax.visible=true;
  } else if (kind === 'brush') {
    const b=ES.brushes.find(b=>b.id===id);
    if (!b) { handlesGroup.visible=false; return; }
    handlesGroup.visible=true;
    const mx=(b.xMin+b.xMax)/2, mz=(b.zMin+b.zMax)/2, my=(b.yMin+b.yMax)/2;
    handleMeshes.xMin.position.set(b.xMin-0.5,my,mz);
    handleMeshes.xMax.position.set(b.xMax+0.5,my,mz);
    handleMeshes.zMin.position.set(mx,my,b.zMin-0.5);
    handleMeshes.zMax.position.set(mx,my,b.zMax+0.5);
    handleMeshes.yMin.position.set(mx,b.yMin,mz); handleMeshes.yMin.visible=true;
    handleMeshes.yMax.position.set(mx,b.yMax,mz); handleMeshes.yMax.visible=true;
    // XZ corners (Top view)
    handleMeshes.xMinzMin.position.set(b.xMin-0.5,my,b.zMin-0.5); handleMeshes.xMinzMin.visible=true;
    handleMeshes.xMinzMax.position.set(b.xMin-0.5,my,b.zMax+0.5); handleMeshes.xMinzMax.visible=true;
    handleMeshes.xMaxzMin.position.set(b.xMax+0.5,my,b.zMin-0.5); handleMeshes.xMaxzMin.visible=true;
    handleMeshes.xMaxzMax.position.set(b.xMax+0.5,my,b.zMax+0.5); handleMeshes.xMaxzMax.visible=true;
    // XY corners (Front view)
    handleMeshes.xMinyMin.position.set(b.xMin-0.5,b.yMin,mz); handleMeshes.xMinyMin.visible=true;
    handleMeshes.xMinyMax.position.set(b.xMin-0.5,b.yMax,mz); handleMeshes.xMinyMax.visible=true;
    handleMeshes.xMaxyMin.position.set(b.xMax+0.5,b.yMin,mz); handleMeshes.xMaxyMin.visible=true;
    handleMeshes.xMaxyMax.position.set(b.xMax+0.5,b.yMax,mz); handleMeshes.xMaxyMax.visible=true;
    // ZY corners (Side view)
    handleMeshes.zMinyMin.position.set(mx,b.yMin,b.zMin-0.5); handleMeshes.zMinyMin.visible=true;
    handleMeshes.zMinyMax.position.set(mx,b.yMax,b.zMin-0.5); handleMeshes.zMinyMax.visible=true;
    handleMeshes.zMaxyMin.position.set(mx,b.yMin,b.zMax+0.5); handleMeshes.zMaxyMin.visible=true;
    handleMeshes.zMaxyMax.position.set(mx,b.yMax,b.zMax+0.5); handleMeshes.zMaxyMax.visible=true;
  } else {
    handlesGroup.visible=false;
  }
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

// Handles valid per viewport — prevents depth-axis handles intercepting rays in the wrong view
const _vpHandleAxes = {
  top:   ['xMin','xMax','zMin','zMax','xMinzMin','xMinzMax','xMaxzMin','xMaxzMax'],
  front: ['xMin','xMax','yMin','yMax','xMinyMin','xMinyMax','xMaxyMin','xMaxyMax'],
  side:  ['zMin','zMax','yMin','yMax','zMinyMin','zMinyMax','zMaxyMin','zMaxyMax'],
};
function _raycastHandles(cx, cy, vp) {
  if (!handlesGroup.visible) return null;
  raycaster.setFromCamera(toClip(vp,cx,cy), _camFor(vp));
  const allowed = _vpHandleAxes[vp];
  const targets = Object.entries(handleMeshes)
    .filter(([ax, m]) => m.visible && (!allowed || allowed.includes(ax)))
    .map(([, m]) => m);
  const hits = raycaster.intersectObjects(targets);
  return hits.length ? hits[0].object.userData.handleType : null;
}

// Returns userData of first hit; for brushes also includes materialIndex for face ID
function _raycastLevel(cx, cy, vp) {
  raycaster.setFromCamera(toClip(vp,cx,cy), _camFor(vp));
  const selectableEnts = entityMeshes.filter(m => m.userData.kind === 'entity');
  const hits=raycaster.intersectObjects([...tileMeshes,...decorMeshes,...lightMeshes,...brushMeshes,...selectableEnts,...navHitboxGroup.children]);
  if (!hits.length) return null;
  const hit=hits[0];
  const ud={...hit.object.userData};
  if (ud.kind==='brush' && hit.face!=null) ud.materialIndex=hit.face.materialIndex;
  return ud;
}

// ── Drag-state ────────────────────────────────────────────────────────────────
let mouseButtons = { left:false, right:false, middle:false };
let lastMouse    = { x:0, y:0 };
let activeVP     = null;
let _lastHoverVP = 'top';  // last viewport the mouse was over — drives arrow keys

// Cache outline divs once DOM is ready
const _vpOutlines = {};
['persp','top','front','side'].forEach(n => {
  _vpOutlines[n] = document.getElementById('vp-outline-' + n);
});

function _setVPHighlight(vp) {
  if (_lastHoverVP === vp) return;
  _lastHoverVP = vp;
  Object.entries(_vpOutlines).forEach(([n, el]) => {
    if (el) el.classList.toggle('active', n === vp);
  });
}

// Fly-cam
let _flyMode    = false;
const _heldKeys = new Set();   // keys currently held in fly mode

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
  if (_flyMode) {
    // Pointer locked — raw deltas drive look, cursor is hidden
    const mx=e.movementX||0, my=e.movementY||0;
    perspYaw  -=mx*0.002;
    perspPitch=Math.max(-1.4,Math.min(1.4,perspPitch-my*0.002));
    _applyPerspCam();
    return;
  }
  const rect=canvas.getBoundingClientRect();
  const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
  const dx=cx-lastMouse.x, dy=cy-lastMouse.y;
  _dragDistance+=Math.abs(dx)+Math.abs(dy);
  lastMouse={x:cx,y:cy};
  _onMouseMove(cx,cy,dx,dy);
});

window.addEventListener('mouseleave', () => {
  Object.values(_vpOutlines).forEach(el => { if(el) el.classList.remove('active'); });
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
      const roomSel=ES.selection.find(s=>s.kind==='room');
      if (roomSel) { _dragHandle={type:ht,kind:'room',obj:ES.rooms.find(r=>r.id===roomSel.id)}; return; }
      const brushSel=ES.selection.find(s=>s.kind==='brush');
      if (brushSel) { _dragHandle={type:ht,kind:'brush',obj:ES.brushes.find(b=>b.id===brushSel.id)}; return; }
    }

    // 2. Hit any object?
    const ud=_raycastLevel(cx,cy,vp);
    if (ud) {
      const { kind, id: rawId, roomId, x, z, materialIndex } = ud;
      let kind2 = (kind==='tile'||kind==='wall') ? (roomId ? 'room' : (ud.kind==='standalone' ? 'standalone' : null)) : kind;
      const id2   = kind2==='room' ? roomId : (kind2==='elevated' ? `${x},${z}` : rawId);
      if (!kind2) return;

      // Face selection on already-selected brush
      if (kind2==='brush' && materialIndex!=null && selContains('brush',id2)) {
        _selectedFace = { brushId: id2, faceKey: FACE_ORDER[materialIndex] };
        _showPropsForSelection(); return;
      }

      if (ctrl) {
        // Toggle in selection
        selContains(kind2,id2) ? selRemove(kind2,id2) : selAdd(kind2,id2);
      } else {
        // If clicking an already-selected item: don't change selection (will drag)
        if (!selContains(kind2,id2)) selSet(kind2,id2);
      }
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();

      // Start move drag (works from all ortho views)
      if (vp==='top')   { const wp=topToWorld(cx,cy);   if(wp) _startMoveDrag({x:wp.x,y:0,z:wp.z}, vp); }
      if (vp==='front') { const wp=frontToWorld(cx,cy); if(wp) _startMoveDrag({x:wp.x,y:wp.y,z:0}, vp); }
      if (vp==='side')  { const wp=sideToWorld(cx,cy);  if(wp) _startMoveDrag({x:0,y:wp.y,z:wp.z}, vp); }
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
  if ((ES.tool==='room'||ES.tool==='brush') && vp==='top') {
    const wp=topToWorld(cx,cy);
    if (wp) {
      ES.drawing=true; ES.drawStart=ES.drawEnd={x:Math.round(wp.x),z:Math.round(wp.z)};
      _showDrawRect(true); _updateDrawRect(); _updatePreviewBox();
    }
    return;
  }
  if (ES.tool==='entity' && vp==='top') {
    const wp=topToWorld(cx,cy);
    if(wp) _openEntityDialog(Math.round(wp.x), Math.round(wp.z));
    return;
  }
  if (ES.tool==='nav' && vp==='top') {
    const wp=topToWorld(cx,cy); if(!wp) return;
    const tx=Math.round(wp.x), tz=Math.round(wp.z);
    const idx=ES.navMesh.findIndex(c=>c.x===tx&&c.z===tz);
    if (ctrl || idx>=0) {
      // ctrl+click or click on existing cell → remove
      if(idx>=0) { ES.navMesh.splice(idx,1); _buildNavHitboxes(); _buildNavOverlay(); _setStatus(`Nav cell removed (${tx},${tz})  ·  ${ES.navMesh.length} total`); }
    } else {
      // click on empty → add at tileMap elevation or 0
      const elev = tmGet(tx,tz)?.elevation ?? 0;
      ES.navMesh.push({id:_nextId('nav'),x:tx,z:tz,elevation:elev,cost:1,manual:true});
      _buildNavHitboxes(); _buildNavOverlay(); _setStatus(`Nav cell added (${tx},${tz})  ·  ${ES.navMesh.length} total`);
    }
    // Auto-show overlay when painting
    if (!_showNavMesh) { _showNavMesh=true; document.getElementById('btn-nav-toggle').classList.add('nav-active'); _buildNavOverlay(); }
    return;
  }
}

// ── Left-up ───────────────────────────────────────────────────────────────────
function _onLeftUp(ctrl) {
  // Finish brush draw
  if (ES.tool==='brush' && ES.drawing) {
    ES.drawing=false; _showDrawRect(false); previewBox.visible=false;
    if (ES.drawStart&&ES.drawEnd) {
      const x0=Math.min(ES.drawStart.x,ES.drawEnd.x), x1=Math.max(ES.drawStart.x,ES.drawEnd.x);
      const z0=Math.min(ES.drawStart.z,ES.drawEnd.z), z1=Math.max(ES.drawStart.z,ES.drawEnd.z);
      if (x1>=x0&&z1>=z0) _openBrushDialog(x0,x1,z0,z1);
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
  // Use activeVP (locked on mousedown) when a button is held so drags don't
  // jump viewport mid-gesture.  For plain hover, always compute fresh.
  const hoverVP = getViewportAt(cx, cy);
  const vp = (mouseButtons.left || mouseButtons.middle || mouseButtons.right)
    ? (activeVP || hoverVP)
    : hoverVP;
  _setVPHighlight(hoverVP);

  // Handle resize
  if (_dragHandle && mouseButtons.left) {
    const o=_dragHandle.obj;
    const ht=_dragHandle.type;
    if (['xMin','xMax','zMin','zMax','xMinzMin','xMinzMax','xMaxzMin','xMaxzMax'].includes(ht)) {
      // Top-view XZ handles
      const wp=topToWorld(cx,cy); if (!wp) return;
      const sx=Math.round(wp.x), sz=Math.round(wp.z);
      switch (ht) {
        case 'xMin':     o.xMin=Math.min(sx,o.xMax-1); break;
        case 'xMax':     o.xMax=Math.max(sx,o.xMin+1); break;
        case 'zMin':     o.zMin=Math.min(sz,o.zMax-1); break;
        case 'zMax':     o.zMax=Math.max(sz,o.zMin+1); break;
        case 'xMinzMin': o.xMin=Math.min(sx,o.xMax-1); o.zMin=Math.min(sz,o.zMax-1); break;
        case 'xMinzMax': o.xMin=Math.min(sx,o.xMax-1); o.zMax=Math.max(sz,o.zMin+1); break;
        case 'xMaxzMin': o.xMax=Math.max(sx,o.xMin+1); o.zMin=Math.min(sz,o.zMax-1); break;
        case 'xMaxzMax': o.xMax=Math.max(sx,o.xMin+1); o.zMax=Math.max(sz,o.zMin+1); break;
      }
      _setStatus(`${o.id}: x[${o.xMin}→${o.xMax}]  z[${o.zMin}→${o.zMax}]`);
    } else if (['yMin','yMax'].includes(ht)) {
      // Edge Y handles
      const y=_worldYFromView(cx,cy,vp); if (y===null) return;
      const snap=parseFloat(y.toFixed(2));
      if (ht==='yMin') o.yMin=Math.min(snap,o.yMax-0.1);
      else             o.yMax=Math.max(snap,o.yMin+0.1);
      _setStatus(`${o.id}: y[${o.yMin}→${o.yMax}]`);
    } else if (['xMinyMin','xMinyMax','xMaxyMin','xMaxyMax'].includes(ht)) {
      // Front-view XY corners
      const wp=frontToWorld(cx,cy); if (!wp) return;
      const sx=Math.round(wp.x), sy=parseFloat(wp.y.toFixed(2));
      switch (ht) {
        case 'xMinyMin': o.xMin=Math.min(sx,o.xMax-1); o.yMin=Math.min(sy,o.yMax-0.1); break;
        case 'xMinyMax': o.xMin=Math.min(sx,o.xMax-1); o.yMax=Math.max(sy,o.yMin+0.1); break;
        case 'xMaxyMin': o.xMax=Math.max(sx,o.xMin+1); o.yMin=Math.min(sy,o.yMax-0.1); break;
        case 'xMaxyMax': o.xMax=Math.max(sx,o.xMin+1); o.yMax=Math.max(sy,o.yMin+0.1); break;
      }
      _setStatus(`${o.id}: x[${o.xMin}→${o.xMax}]  y[${o.yMin}→${o.yMax}]`);
    } else if (['zMinyMin','zMinyMax','zMaxyMin','zMaxyMax'].includes(ht)) {
      // Side-view ZY corners
      const wp=sideToWorld(cx,cy); if (!wp) return;
      const sz=Math.round(wp.z), sy=parseFloat(wp.y.toFixed(2));
      switch (ht) {
        case 'zMinyMin': o.zMin=Math.min(sz,o.zMax-1); o.yMin=Math.min(sy,o.yMax-0.1); break;
        case 'zMinyMax': o.zMin=Math.min(sz,o.zMax-1); o.yMax=Math.max(sy,o.yMin+0.1); break;
        case 'zMaxyMin': o.zMax=Math.max(sz,o.zMin+1); o.yMin=Math.min(sy,o.yMax-0.1); break;
        case 'zMaxyMax': o.zMax=Math.max(sz,o.zMin+1); o.yMax=Math.max(sy,o.yMin+0.1); break;
      }
      _setStatus(`${o.id}: z[${o.zMin}→${o.zMax}]  y[${o.yMin}→${o.yMax}]`);
    }
    rebuildLevel();
    return;
  }

  // Selection move — use whichever viewport the drag started in
  if (_dragMove && mouseButtons.left && _dragDistance > DRAG_THRESHOLD) {
    const dvp = _dragMove.vp;
    if (dvp==='top') {
      const wp=topToWorld(cx,cy); if(!wp) return;
      _applyMoveDelta(Math.round(wp.x-_dragMove.worldStart.x), Math.round(wp.z-_dragMove.worldStart.z), 0);
    } else if (dvp==='front') {
      const wp=frontToWorld(cx,cy); if(!wp) return;
      _applyMoveDelta(Math.round(wp.x-_dragMove.worldStart.x), 0, parseFloat((wp.y-_dragMove.worldStart.y).toFixed(2)));
    } else if (dvp==='side') {
      const wp=sideToWorld(cx,cy); if(!wp) return;
      _applyMoveDelta(0, Math.round(wp.z-_dragMove.worldStart.z), parseFloat((wp.y-_dragMove.worldStart.y).toFixed(2)));
    }
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

  // Ortho pan — middle-drag or right-drag (non-persp)
  if (mouseButtons.middle || (mouseButtons.right && vp!=='persp')) {
    const ps=orthoZoom/(canvas.clientWidth/2)*3;
    if(vp==='top')   { topPanX-=dx*ps; topPanZ-=dy*ps; _applyTopCam(); }
    if(vp==='front') { frontPanX-=dx*ps; frontPanY+=dy*ps; _applyFrontCam(); }
    if(vp==='side')  { sidePanZ-=dx*ps; sidePanY+=dy*ps; _applySideCam(); }
  }

  // Room / brush draw
  if (mouseButtons.left && (ES.tool==='room'||ES.tool==='brush') && ES.drawing && vp==='top') {
    const wp=topToWorld(cx,cy);
    if (wp) { ES.drawEnd={x:Math.round(wp.x),z:Math.round(wp.z)}; _updateDrawRect(); _updatePreviewBox(); }
  }

  // Hover highlight (top view only, non-drag)
  if (vp==='top'&&!mouseButtons.left) {
    const wp=topToWorld(cx,cy);
    if(wp) { hoverMesh.position.set(Math.round(wp.x),0.01,Math.round(wp.z)); hoverMesh.visible=true; }
  } else if(vp!=='top') hoverMesh.visible=false;

  // Cursor feedback in select mode
  if (ES.tool==='select' && !mouseButtons.left) {
    if (_dragMove) {
      canvas.style.cursor='grabbing';
    } else {
      const ht=_raycastHandles(cx,cy,vp);
      if (ht) {
        // Corner handles → diagonal resize; edge handles → axis resize
        const isCorner=CORNER_AXES.includes(ht);
        const isX=(ht==='xMin'||ht==='xMax');
        const isY=(ht==='yMin'||ht==='yMax');
        canvas.style.cursor = isCorner ? 'nwse-resize' : isY ? 'ns-resize' : isX ? 'ew-resize' : 'ns-resize';
      } else {
        const ud=_raycastLevel(cx,cy,vp);
        canvas.style.cursor = (ud && ud.kind && ud.kind!=='_entityRange') ? 'grab' : 'default';
      }
    }
  } else if (ES.tool==='select' && mouseButtons.left && _dragMove) {
    canvas.style.cursor='grabbing';
  }

  // Coord readout
  if (vp==='top') {
    const wp=topToWorld(cx,cy);
    if(wp) document.getElementById('coord-top').textContent=`X ${wp.x.toFixed(1)}  Z ${wp.z.toFixed(1)}`;
  }
}

// ── Move drag helpers ─────────────────────────────────────────────────────────
function _startMoveDrag(worldPos, vp) {
  _pushUndo();
  _dragMove = {
    vp: vp || 'top',
    worldStart: { x: worldPos.x||0, y: worldPos.y||0, z: worldPos.z||0 },
    origStates: ES.selection.map(s => {
      if (s.kind==='room') {
        const r=ES.rooms.find(r=>r.id===s.id);
        return r ? {...s, orig:{xMin:r.xMin,xMax:r.xMax,zMin:r.zMin,zMax:r.zMax,yMin:0,yMax:0}} : {...s,orig:null};
      }
      if (s.kind==='standalone') {
        const t=ES.standaloneTiles.find(t=>t.id===s.id);
        return t ? {...s, orig:{x:t.x,z:t.z,y:0}} : {...s,orig:null};
      }
      if (s.kind==='decor') {
        const d=ES.decoratives.find(d=>d.id===s.id);
        return d ? {...s, orig:{x:d.x,z:d.z,y:0}} : {...s,orig:null};
      }
      if (s.kind==='light') {
        const l=ES.lights.find(l=>l.id===s.id);
        return l ? {...s, orig:{x:l.x,z:l.z,y:0}} : {...s,orig:null};
      }
      if (s.kind==='brush') {
        const b=ES.brushes.find(b=>b.id===s.id);
        return b ? {...s, orig:{xMin:b.xMin,xMax:b.xMax,zMin:b.zMin,zMax:b.zMax,yMin:b.yMin,yMax:b.yMax}} : {...s,orig:null};
      }
      if (s.kind==='entity') {
        const e=ES.entities.find(e=>e.id===s.id);
        return e ? {...s, orig:{x:e.x,z:e.z,y:e.y??0}} : {...s,orig:null};
      }
      if (s.kind==='nav') {
        const c=ES.navMesh.find(c=>c.id===s.id);
        return c ? {...s, orig:{x:c.x,z:c.z,y:0}} : {...s,orig:null};
      }
      return {...s, orig:null};
    }),
  };
}

function _applyMoveDelta(dx, dz, dy=0) {
  if (!_dragMove) return;
  dy = parseFloat(dy.toFixed(2));
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
    } else if (s.kind==='brush') {
      const b=ES.brushes.find(b=>b.id===s.id);
      if(b) { b.xMin=s.orig.xMin+dx; b.xMax=s.orig.xMax+dx; b.zMin=s.orig.zMin+dz; b.zMax=s.orig.zMax+dz;
              b.yMin=parseFloat((s.orig.yMin+dy).toFixed(2)); b.yMax=parseFloat((s.orig.yMax+dy).toFixed(2)); }
    } else if (s.kind==='entity') {
      const e=ES.entities.find(e=>e.id===s.id);
      if(e) { e.x=s.orig.x+dx; e.z=s.orig.z+dz; e.y=parseFloat((s.orig.y+dy).toFixed(2)); }
    } else if (s.kind==='nav') {
      const c=ES.navMesh.find(c=>c.id===s.id);
      if(c) { c.x=s.orig.x+dx; c.z=s.orig.z+dz; }
    }
  });
  rebuildLevel();
  const parts=[`Δx${dx>=0?'+':''}${dx}`, `Δz${dz>=0?'+':''}${dz}`];
  if(dy!==0) parts.push(`Δy${dy>=0?'+':''}${dy}`);
  _setStatus('Move ' + parts.join('  '));
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
  ES.brushes.forEach(b => { const cx=(b.xMin+b.xMax)/2, cy=(b.yMin+b.yMax)/2, cz=(b.zMin+b.zMax)/2; if(inMarquee(cx,cy,cz)) push('brush',b.id); });
  ES.entities.forEach(e => { if(inMarquee(e.x, e.y??0.5, e.z)) push('entity',e.id); });
  ES.navMesh.forEach(c => { if(inMarquee(c.x, c.elevation??0, c.z)) push('nav',c.id); });

  ES.selection=newSel;
  _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  _setStatus(`${newSel.length} item(s) selected`);
}

// ── Arrow key + Ctrl+D movement / duplication ─────────────────────────────────
function _moveSelection(dx, dz, dy=0) {
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
    } else if (s.kind==='brush') {
      const b=ES.brushes.find(b=>b.id===s.id);
      if(b) { b.xMin+=dx; b.xMax+=dx; b.zMin+=dz; b.zMax+=dz; b.yMin+=dy; b.yMax+=dy; }
    } else if (s.kind==='entity') {
      const e=ES.entities.find(e=>e.id===s.id);
      if(e) { e.x+=dx; e.z+=dz; e.y=(e.y??0)+dy; }
    } else if (s.kind==='nav') {
      const c=ES.navMesh.find(c=>c.id===s.id);
      if(c) { c.x+=dx; c.z+=dz; }
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
    } else if (s.kind==='brush') {
      const b=JSON.parse(JSON.stringify(ES.brushes.find(x=>x.id===s.id))); if(!b) return;
      b.id=_nextId('brush'); b.xMin+=2; b.xMax+=2; ES.brushes.push(b); newSel.push({kind:'brush',id:b.id});
    } else if (s.kind==='entity') {
      const e=JSON.parse(JSON.stringify(ES.entities.find(x=>x.id===s.id))); if(!e) return;
      e.id=_nextId('entity'); e.x+=2; ES.entities.push(e); newSel.push({kind:'entity',id:e.id});
    } else if (s.kind==='nav') {
      const c=JSON.parse(JSON.stringify(ES.navMesh.find(x=>x.id===s.id))); if(!c) return;
      c.id=_nextId('nav'); c.x+=1; ES.navMesh.push(c); newSel.push({kind:'nav',id:c.id});
    }
  });
  ES.selection=newSel;
  // Always land back on Select so the copies can be moved immediately
  document.querySelector('[data-tool="select"]')?.click();
  rebuildLevel(); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  _setStatus(`Duplicated ${newSel.length} item(s) — selection updated to new copies`);
}

// ── Undo / Delete ─────────────────────────────────────────────────────────────
function _pushUndo() {
  ES.undoStack.push(JSON.stringify({
    rooms:ES.rooms, elevatedTiles:ES.elevatedTiles, decoratives:ES.decoratives,
    lights:ES.lights, portals:ES.portals, playerStart:ES.playerStart,
    standaloneTiles:ES.standaloneTiles, brushes:ES.brushes, navMesh:ES.navMesh,
    navGroups:ES.navGroups, groups:ES.groups, entities:ES.entities, selection:ES.selection,
  }));
  if (ES.undoStack.length>50) ES.undoStack.shift();
}
function _undo() {
  if (!ES.undoStack.length) return;
  const snap=JSON.parse(ES.undoStack.pop());
  Object.assign(ES,snap);
  if (!ES.brushes)    ES.brushes=[];
  if (!ES.navMesh)    ES.navMesh=[];
  if (!ES.navGroups)  ES.navGroups=[];
  if (!ES.groups)     ES.groups=[];
  if (!ES.entities)   ES.entities=[];
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
    else if(s.kind==='brush') ES.brushes=ES.brushes.filter(b=>b.id!==s.id);
    else if(s.kind==='entity') ES.entities=ES.entities.filter(e=>e.id!==s.id);
    else if(s.kind==='nav') ES.navMesh=ES.navMesh.filter(c=>c.id!==s.id);
  });
  // Remove deleted items from any groups; prune empty groups
  ES.groups.forEach(g => {
    g.items = g.items.filter(ref => {
      switch(ref.kind) {
        case 'room':       return ES.rooms.some(r=>r.id===ref.id);
        case 'brush':      return ES.brushes.some(b=>b.id===ref.id);
        case 'entity':     return ES.entities.some(e=>e.id===ref.id);
        case 'decor':      return ES.decoratives.some(d=>d.id===ref.id);
        case 'light':      return ES.lights.some(l=>l.id===ref.id);
        case 'standalone': return ES.standaloneTiles.some(t=>t.id===ref.id);
        case 'elevated':   { const [x,z]=ref.id.split(',').map(Number); return ES.elevatedTiles.some(e=>e.x===x&&e.z===z); }
        default: return true;
      }
    });
  });
  ES.groups = ES.groups.filter(g => g.items.length > 0);
  selClear(); rebuildLevel(); _showPropsForSelection();
}

// ── Group selection ───────────────────────────────────────────────────────────
function _groupSelected() {
  if (!ES.selection.length) { _setStatus('Nothing selected to group'); return; }
  _pushUndo();
  const id   = _nextId('grp');
  const name = `Group ${ES.groups.length + 1}`;
  const refs = ES.selection.map(s => ({kind:s.kind, id:s.id}));
  // Each item can only belong to one group — evict from any existing group
  ES.groups.forEach(g => {
    g.items = g.items.filter(r => !refs.some(nr => nr.kind===r.kind && nr.id===r.id));
  });
  ES.groups = ES.groups.filter(g => g.items.length > 0);
  ES.groups.push({ id, name, collapsed: false, items: refs });
  _refreshLayersList();
  _setStatus(`Grouped ${refs.length} item(s) as "${name}" — double-click to rename`);
}

// ── Fly-cam helpers ───────────────────────────────────────────────────────────
function _toggleFlyMode() {
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  } else {
    canvas.requestPointerLock();
  }
}

function _resetIsoCamera() {
  perspYaw   = ISO_YAW;
  perspPitch = ISO_PITCH;
  perspPos.copy(ISO_POS);
  _applyPerspCam();
  _setStatus('Camera reset  ·  Z=fly mode  X=reset');
}

// Called every animation frame — smooth WASD movement while keys are held
function _flyTick() {
  if (!_flyMode) return;
  const spd = 0.15;
  const fwd  = new THREE.Vector3(
    Math.cos(perspPitch)*Math.sin(perspYaw),
    Math.sin(perspPitch),
    Math.cos(perspPitch)*Math.cos(perspYaw)
  ).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).normalize();
  let moved = false;
  if (_heldKeys.has('w')) { perspPos.addScaledVector(fwd,   spd); moved=true; }
  if (_heldKeys.has('s')) { perspPos.addScaledVector(fwd,  -spd); moved=true; }
  if (_heldKeys.has('a')) { perspPos.addScaledVector(right, -spd); moved=true; }
  if (_heldKeys.has('d')) { perspPos.addScaledVector(right,  spd); moved=true; }
  if (_heldKeys.has('q')) { perspPos.y -= spd; moved=true; }
  if (_heldKeys.has('e')) { perspPos.y += spd; moved=true; }
  if (moved) _applyPerspCam();
}

document.addEventListener('pointerlockchange', () => {
  _flyMode = document.pointerLockElement === canvas;
  if (_flyMode) {
    _setStatus('✈ FLY MODE  ·  WASD=move  Q/E=up/down  mouse=look  ·  Z to exit');
  } else {
    _heldKeys.clear();
    canvas.style.cursor = ES.tool==='select' ? 'default' : 'crosshair';
    _setStatus('Ready  ·  S=Select  B=Brush  E=Entity  N=Nav  ·  Z=fly  X=reset cam');
  }
});

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
    else if(kind==='brush')    _showBrushProps(ES.brushes.find(b=>b.id===id));
    else if(kind==='entity')   _showEntityProps(ES.entities.find(e=>e.id===id));
    else if(kind==='nav')      _showNavProps(ES.navMesh.find(c=>c.id===id));
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
    else if(s.kind==='brush')    data=ES.brushes.find(b=>b.id===s.id);
    else if(s.kind==='entity')   data=ES.entities.find(e=>e.id===s.id);
    return data?{kind:s.kind,data}:null;
  }).filter(Boolean);
  _showBatchProps(kinds,items,n);
}

// ── Nav cell properties panel ─────────────────────────────────────────────────
function _showNavProps(cell) {
  if (!cell) { propsContent.innerHTML='<p class="hint">Nav cell not found.</p>'; return; }
  const groupOpts = `<option value="">— none —</option>`
    + ES.navGroups.map(g=>`<option value="${g.id}"${g.id===cell.navGroupId?' selected':''}>${_escHtml(g.name)}</option>`).join('');
  propsContent.innerHTML = `
    <div class="prop-heading">Nav Cell</div>
    ${_tr('ID','np-id',cell.id)}
    ${_tn('X','np-x',cell.x)}
    ${_tn('Z','np-z',cell.z)}
    ${_tn('Elevation','np-elev',cell.elevation??0,0.1)}
    ${_tn('Cost','np-cost',cell.cost??1)}
    <div class="prop-row"><label>Group</label><select id="np-group">${groupOpts}</select></div>`;
  document.getElementById('np-id')?.addEventListener('change',e=>{cell.id=e.target.value;rebuildLevel();_refreshLayersList();});
  const bN=(id,f,int)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ cell[f]=int?parseInt(el.value):parseFloat(el.value); rebuildLevel(); }); };
  bN('np-x','x',true); bN('np-z','z',true); bN('np-elev','elevation',false); bN('np-cost','cost',true);
  document.getElementById('np-group')?.addEventListener('change',e=>{
    cell.navGroupId=e.target.value||undefined; _refreshLayersList();
  });
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
    } else if(kind==='brush'){
      html+=bnum('Y Min','bm-ymin','yMin',0.1);
      html+=bnum('Y Max','bm-ymax','yMax',0.1);
    } else if(kind==='entity'){
      html+=bnum('X','bm-ex','x',1)+bnum('Y','bm-ey','y',0.1)+bnum('Z','bm-ez','z',1);
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
    else if(kind==='brush'){ bBN('bm-ymin','yMin'); bBN('bm-ymax','yMax'); }
    else if(kind==='entity'){ bBN('bm-ex','x'); bBN('bm-ey','y'); bBN('bm-ez','z'); }
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

const _escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function _getItemDisplay(kind, id) {
  switch(kind) {
    case 'room':       { const r=ES.rooms.find(r=>r.id===id);           return r ? {icon:'▣',name:r.id,sub:r.type} : null; }
    case 'brush':      { const b=ES.brushes.find(b=>b.id===id);         return b ? {icon:b.brushClass==='trigger'?'◈':'⬛',name:b.id,sub:b.brushClass==='trigger'?`trigger:${b.triggerType||'enter'}`:'brush'} : null; }
    case 'elevated':   return { icon:'▲', name:`(${id})`, sub:'elev' };
    case 'standalone': { const t=ES.standaloneTiles.find(t=>t.id===id); return t ? {icon:'◻',name:t.id,sub:'tile'} : null; }
    case 'decor':      { const d=ES.decoratives.find(d=>d.id===id);     return d ? {icon:'□',name:d.id,sub:'decor'} : null; }
    case 'light':      { const l=ES.lights.find(l=>l.id===id);          return l ? {icon:'✦',name:l.id,sub:'light'} : null; }
    case 'entity':     { const e=ES.entities.find(e=>e.id===id);        return e ? {icon:{decor:'□',light:'✦',spawn:'⊕'}[e.entityType]||'●',name:e.id,sub:e.entityType} : null; }
    case 'nav':        { const c=ES.navMesh.find(c=>c.id===id);         return c ? {icon:'⬡',name:c.id,sub:`cost:${c.cost??1}`} : null; }
    default: return null;
  }
}

function _refreshLayersList() {
  // Build set of keys that belong to a group
  const groupedKeys = new Set();
  ES.groups.forEach(g => g.items.forEach(r => groupedKeys.add(`${r.kind}::${r.id}`)));

  const itemRowHTML = (kind, id, indent) => {
    const d = _getItemDisplay(kind, id); if (!d) return '';
    const style = indent ? ' style="padding-left:18px"' : '';
    return `<div class="layer-item${selContains(kind,id)?' selected':''}" data-kind="${kind}" data-id="${_escHtml(id)}"${style}>
      <span class="layer-icon">${d.icon}</span>
      <span class="layer-name">${_escHtml(d.name)}</span>
      <span class="layer-kind">${_escHtml(d.sub)}</span>
    </div>`;
  };

  let html = '';

  // ── Groups ──
  ES.groups.forEach(g => {
    const anySel = g.items.some(r => selContains(r.kind, r.id));
    html += `<div class="group-header${anySel?' sel':''}" data-group-id="${_escHtml(g.id)}">
      <span class="group-toggle${g.collapsed?' coll':''}">▾</span>
      <span class="group-name">${_escHtml(g.name)}</span>
      <span class="layer-kind">${g.items.length}</span>
      <button class="group-del" title="Ungroup (removes group, keeps items)">×</button>
    </div>`;
    if (!g.collapsed) {
      html += `<div class="group-body">`;
      g.items.forEach(r => { html += itemRowHTML(r.kind, r.id, true); });
      html += `</div>`;
    }
  });

  // ── Ungrouped items ──
  const allItems = [
    ...ES.rooms.map(r=>({kind:'room',id:r.id})),
    ...ES.brushes.map(b=>({kind:'brush',id:b.id})),
    ...ES.entities.map(e=>({kind:'entity',id:e.id})),
    ...ES.elevatedTiles.map(et=>({kind:'elevated',id:`${et.x},${et.z}`})),
    ...ES.standaloneTiles.map(st=>({kind:'standalone',id:st.id})),
    ...ES.decoratives.map(d=>({kind:'decor',id:d.id})),
    ...ES.lights.map(l=>({kind:'light',id:l.id})),
  ];
  allItems.filter(({kind,id})=>!groupedKeys.has(`${kind}::${id}`))
          .forEach(({kind,id})=>{ html += itemRowHTML(kind, id, false); });

  // ── Virtual _navmesh folder ──
  if (ES.navMesh.length || ES.navGroups.length) {
    const anySel = ES.navMesh.some(c=>selContains('nav',c.id));
    html += `<div class="group-header nav-folder-header${anySel?' sel':''}" data-nav-folder="1">
      <span class="group-toggle${_navFolderCollapsed?' coll':''}">▾</span>
      <span class="group-name">_navmesh</span>
      <span class="layer-kind">${ES.navMesh.length}</span>
      <button class="group-del nav-add-grp" title="New nav sub-group">+</button>
    </div>`;
    if (!_navFolderCollapsed) {
      html += `<div class="group-body">`;
      // sub-groups
      ES.navGroups.forEach(g => {
        const gCells = ES.navMesh.filter(c=>c.navGroupId===g.id);
        const gSel   = gCells.some(c=>selContains('nav',c.id));
        html += `<div class="group-header${gSel?' sel':''}" style="padding-left:10px" data-nav-group-id="${_escHtml(g.id)}">
          <span class="group-toggle${g.collapsed?' coll':''}">▾</span>
          <span class="group-name">${_escHtml(g.name)}</span>
          <span class="layer-kind">${gCells.length}</span>
          <button class="group-del" title="Delete nav group">×</button>
        </div>`;
        if (!g.collapsed) {
          html += `<div class="group-body">`;
          gCells.forEach(c=>{ html+=itemRowHTML('nav',c.id,true); });
          html += `</div>`;
        }
      });
      // ungrouped nav cells
      ES.navMesh.filter(c=>!c.navGroupId).forEach(c=>{ html+=itemRowHTML('nav',c.id,true); });
      html += `</div>`;
    }
  }

  layersList.innerHTML = html;

  // ── Bind: item click ──
  layersList.querySelectorAll('.layer-item').forEach(el => {
    el.addEventListener('click', e => {
      const {kind, id} = el.dataset;
      const ctrl = e.ctrlKey||e.metaKey;
      if (ctrl) { selContains(kind,id) ? selRemove(kind,id) : selAdd(kind,id); }
      else       { selSet(kind, id); }
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    });
  });

  // ── Bind: group interactions ──
  layersList.querySelectorAll('.group-header').forEach(headerEl => {
    const gId = headerEl.dataset.groupId;
    const g   = ES.groups.find(g => g.id === gId);
    if (!g) return;

    // Click on header → select all items in group
    headerEl.addEventListener('click', e => {
      if (e.target.classList.contains('group-del') ||
          e.target.classList.contains('group-toggle') ||
          e.target.tagName === 'INPUT') return;
      const ctrl = e.ctrlKey||e.metaKey;
      if (!ctrl) selClear();
      g.items.forEach(r => selAdd(r.kind, r.id));
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
      _setStatus(`"${g.name}" — ${g.items.length} item(s) selected`);
    });

    // Toggle collapse
    headerEl.querySelector('.group-toggle')?.addEventListener('click', e => {
      e.stopPropagation();
      g.collapsed = !g.collapsed;
      _refreshLayersList();
    });

    // Double-click name → inline rename
    headerEl.querySelector('.group-name')?.addEventListener('dblclick', e => {
      e.stopPropagation();
      const span = e.currentTarget;
      const inp  = document.createElement('input');
      inp.className = 'group-name-edit';
      inp.value = g.name;
      span.replaceWith(inp);
      inp.focus(); inp.select();
      const commit = () => { g.name = inp.value.trim() || g.name; _refreshLayersList(); };
      inp.addEventListener('blur', commit);
      inp.addEventListener('keydown', ev => {
        if (ev.key === 'Enter')  { ev.preventDefault(); commit(); }
        if (ev.key === 'Escape') { _refreshLayersList(); }
        ev.stopPropagation();
      });
    });

    // × button → ungroup (keep items, remove group)
    headerEl.querySelector('.group-del')?.addEventListener('click', e => {
      e.stopPropagation();
      _pushUndo();
      ES.groups = ES.groups.filter(gg => gg.id !== gId);
      _refreshLayersList();
      _setStatus(`Ungrouped "${g.name}"`);
    });
  });

  // ── Bind: virtual _navmesh folder ──
  const navFolderEl = layersList.querySelector('[data-nav-folder]');
  if (navFolderEl) {
    navFolderEl.addEventListener('click', e => {
      if (e.target.closest('.nav-add-grp')) {
        e.stopPropagation();
        _pushUndo();
        const id=_nextId('navgrp'), name=`Nav Group ${ES.navGroups.length+1}`;
        ES.navGroups.push({id,name,collapsed:false});
        _refreshLayersList();
        _setStatus(`Nav sub-group "${name}" created`);
        return;
      }
      if (e.target.closest('.group-toggle')) { e.stopPropagation(); _navFolderCollapsed=!_navFolderCollapsed; _refreshLayersList(); return; }
      // Click header → select all nav cells
      const ctrl=e.ctrlKey||e.metaKey;
      if(!ctrl) selClear();
      ES.navMesh.forEach(c=>selAdd('nav',c.id));
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    });
  }

  // ── Bind: nav sub-groups ──
  layersList.querySelectorAll('[data-nav-group-id]').forEach(hEl => {
    const gId=hEl.dataset.navGroupId;
    const g=ES.navGroups.find(g=>g.id===gId); if(!g) return;
    hEl.addEventListener('click', e => {
      if (e.target.classList.contains('group-del')) {
        e.stopPropagation();
        _pushUndo();
        ES.navMesh.forEach(c=>{ if(c.navGroupId===gId) delete c.navGroupId; });
        ES.navGroups=ES.navGroups.filter(g=>g.id!==gId);
        _refreshLayersList(); return;
      }
      if (e.target.closest('.group-toggle')) { e.stopPropagation(); g.collapsed=!g.collapsed; _refreshLayersList(); return; }
      // Double-click rename
      const ctrl=e.ctrlKey||e.metaKey;
      if(!ctrl) selClear();
      ES.navMesh.filter(c=>c.navGroupId===gId).forEach(c=>selAdd('nav',c.id));
      _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    });
    hEl.querySelector('.group-name')?.addEventListener('dblclick', e => {
      e.stopPropagation();
      const span=e.currentTarget;
      const inp=document.createElement('input'); inp.className='group-name-edit'; inp.value=g.name;
      span.replaceWith(inp); inp.focus(); inp.select();
      const commit=()=>{ g.name=inp.value.trim()||g.name; _refreshLayersList(); };
      inp.addEventListener('blur',commit);
      inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ev.preventDefault();commit();} if(ev.key==='Escape')_refreshLayersList(); ev.stopPropagation(); });
    });
  });
}

// ── Status ────────────────────────────────────────────────────────────────────
function _setStatus(msg) { document.getElementById('status-text').textContent=msg; }
function _switchToSelect() {
  ES.tool='select';
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active', b.dataset.tool==='select'));
  canvas.style.cursor='default';
}

// ── Toolbar + keyboard ────────────────────────────────────────────────────────
document.getElementById('tool-buttons').querySelectorAll('.tool-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ES.tool=btn.dataset.tool;
    _setStatus({select:'Select — click / Ctrl+click / drag marquee in any ortho view  ·  drag to move  ·  arrow keys to nudge',brush:'Brush — drag rectangle in TOP view  ·  per-face color/nodraw  ·  class: solid or trigger zone',entity:'Entity — click TOP view to place  ·  type: decor / light / spawn',nav:'Nav Paint — click to add cell  ·  Ctrl+click to remove  ·  Compile Nav to reset from geometry'}[ES.tool]||ES.tool);
    canvas.style.cursor=ES.tool==='select'?'default':'crosshair';
  });
});

window.addEventListener('keydown',e=>{
  // Escape / Enter — modal keyboard handling (runs before input-tag guard so
  // it works even when focus is inside a field in the dialog).
  if (e.key==='Escape' || e.key==='Enter') {
    // Map each modal id → the primary action button id (null = no Enter action)
    const modalMap = [
      { modal:'brush-dialog',      primary:'bd-create'      },
      { modal:'entity-dialog',     primary:'en-create'      },
      { modal:'import-modal',      primary:'btn-do-import'  },
      { modal:'export-modal',      primary:'btn-close-export'},
      { modal:'load-level-modal',   primary: null             },
      { modal:'compile-nav-modal', primary: null             },
    ];
    for (const {modal, primary} of modalMap) {
      const el=document.getElementById(modal);
      if (el && !el.classList.contains('hidden')) {
        e.preventDefault();
        if (e.key==='Enter' && primary) {
          document.getElementById(primary).click();
        } else if (e.key==='Escape') {
          el.classList.add('hidden');
        }
        return;
      }
    }
    // No modal open — Escape clears selection
    if (e.key==='Escape' && ES.selection.length) {
      e.preventDefault();
      selClear(); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
      return;
    }
  }

  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  _heldKeys.add(e.key.toLowerCase());

  // Z — toggle fly mode (pointer lock)
  if(!e.ctrlKey&&e.key.toLowerCase()==='z') { e.preventDefault(); _toggleFlyMode(); return; }

  // X — reset perspective camera to isometric home
  if(!e.ctrlKey&&e.key.toLowerCase()==='x') { _resetIsoCamera(); return; }

  // In fly mode WASD/QE are handled per-frame by _flyTick() — skip other shortcuts
  if(_flyMode) return;

  // Tool shortcuts
  const map={s:'select',b:'brush',e:'entity',n:'nav'};
  if(!e.ctrlKey&&!e.metaKey&&map[e.key.toLowerCase()]) document.querySelector(`[data-tool="${map[e.key.toLowerCase()]}"]`)?.click();
  if(e.key==='Delete'||e.key==='Backspace') _deleteSelected();
  if(e.ctrlKey&&e.key.toLowerCase()==='z') { e.preventDefault(); _undo(); }
  if(e.ctrlKey&&e.key.toLowerCase()==='d') { e.preventDefault(); _duplicateSelection(); }
  if(e.ctrlKey&&e.key.toLowerCase()==='g') { e.preventDefault(); _groupSelected(); }
  if(e.ctrlKey&&e.key.toLowerCase()==='a') {
    e.preventDefault();
    ES.rooms.forEach(r=>selAdd('room',r.id));
    ES.brushes.forEach(b=>selAdd('brush',b.id));
    ES.entities.forEach(e=>selAdd('entity',e.id));
    ES.elevatedTiles.forEach(et=>selAdd('elevated',`${et.x},${et.z}`));
    ES.standaloneTiles.forEach(st=>selAdd('standalone',st.id));
    ES.decoratives.forEach(d=>selAdd('decor',d.id));
    ES.lights.forEach(l=>selAdd('light',l.id));
    _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    _setStatus(`${ES.selection.length} item(s) selected`);
  }

  // Arrow keys — move selection, direction depends on hovered viewport
  // top  (XZ): ←/→ = ±X,  ↑/↓ = ±Z
  // front(XY): ←/→ = ±X,  ↑/↓ = ±Y
  // side (ZY): ←/→ = ±Z,  ↑/↓ = ±Y
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const vp = _lastHoverVP;
    const neg = (e.key==='ArrowLeft'||e.key==='ArrowUp') ? -1 : 1;
    const horiz = (e.key==='ArrowLeft'||e.key==='ArrowRight');
    if (vp==='top') {
      if (horiz) _moveSelection(neg, 0, 0);
      else        _moveSelection(0, neg, 0);
    } else if (vp==='front') {
      if (horiz) _moveSelection(neg, 0, 0);
      else        _moveSelection(0, 0, -neg);
    } else if (vp==='side') {
      if (horiz) _moveSelection(0, neg, 0);
      else        _moveSelection(0, 0, -neg);
    } else {
      // persp / fallback: top behaviour
      if (horiz) _moveSelection(neg, 0, 0);
      else        _moveSelection(0, neg, 0);
    }
  }
});

window.addEventListener('keyup',e=>{ _heldKeys.delete(e.key.toLowerCase()); });

// Dup / delete / group buttons in panel
document.getElementById('btn-group-sel').addEventListener('click', _groupSelected);
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

// (Room and elevated-tile creation removed — use brushes instead; old level data still loads/renders)

// ── Brush dialog ──────────────────────────────────────────────────────────────
const brushDialog = document.getElementById('brush-dialog');
let _pendingBrushBounds = null;

function _openBrushDialog(x0, x1, z0, z1) {
  _pendingBrushBounds = {x0, x1, z0, z1};
  document.getElementById('bd-id').value = _nextId('brush');
  document.getElementById('bd-bounds-text').textContent = `X ${x0}→${x1}  Z ${z0}→${z1}`;
  document.getElementById('bd-ymin').value = '0';
  document.getElementById('bd-ymax').value = '0.3';
  document.getElementById('bd-walkable').checked = true;
  // Reset class to solid
  const bdClass = document.getElementById('bd-class');
  bdClass.value = 'solid';
  document.getElementById('bd-trigger-opts').classList.add('hidden');
  document.getElementById('bd-faces-hint').textContent = '';
  document.getElementById('bd-script-id').value = '';
  document.getElementById('bd-tag').value = '';
  document.getElementById('bd-trigger-color').value = '#4488ff';
  document.getElementById('bd-trigger-type').value = 'enter';
  // Reset face colours to defaults
  const defs={py:'#606060',ny:'#404040',px:'#505050',nx:'#505050',pz:'#505050',nz:'#505050'};
  Object.keys(defs).forEach(fk=>{
    const ci=document.getElementById(`bd-${fk}-col`); if(ci) ci.value=defs[fk];
    const ni=document.getElementById(`bd-${fk}-nd`);  if(ni) ni.checked=(fk==='ny');
  });
  brushDialog.classList.remove('hidden');
}

// Toggle trigger-specific fields when the class selector changes
document.getElementById('bd-class').addEventListener('change', function() {
  const isTrig = this.value === 'trigger';
  document.getElementById('bd-trigger-opts').classList.toggle('hidden', !isTrig);
  document.getElementById('bd-faces-hint').textContent = isTrig ? '(invisible in game)' : '';
  if (isTrig) document.getElementById('bd-walkable').checked = false;
});

document.getElementById('bd-cancel').addEventListener('click', () => {
  brushDialog.classList.add('hidden'); _pendingBrushBounds = null;
});

document.getElementById('bd-create').addEventListener('click', () => {
  if (!_pendingBrushBounds) return;
  const {x0, x1, z0, z1} = _pendingBrushBounds;
  const id         = document.getElementById('bd-id').value || _nextId('brush');
  const yMin       = parseFloat(document.getElementById('bd-ymin').value) || 0;
  const yMax       = parseFloat(document.getElementById('bd-ymax').value) || 0.3;
  const walkable   = document.getElementById('bd-walkable').checked;
  const brushClass = document.getElementById('bd-class').value || 'solid';
  const faces = {};
  FACE_ORDER.forEach(fk => {
    const col = parseInt((document.getElementById(`bd-${fk}-col`)?.value||'#808080').replace('#',''), 16);
    const nd  = document.getElementById(`bd-${fk}-nd`)?.checked || false;
    faces[fk] = { color: col, nodraw: nd };
  });
  const brush = { id, xMin:x0, xMax:x1, zMin:z0, zMax:z1, yMin, yMax, walkable, brushClass, faces };
  if (brushClass === 'trigger') {
    brush.triggerType  = document.getElementById('bd-trigger-type').value || 'enter';
    brush.scriptId     = document.getElementById('bd-script-id').value || '';
    brush.tag          = document.getElementById('bd-tag').value || '';
    brush.triggerColor = parseInt(document.getElementById('bd-trigger-color').value.replace('#',''), 16);
  }
  _pushUndo();
  ES.brushes.push(brush);
  rebuildLevel();
  selSet('brush', brush.id);
  _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  brushDialog.classList.add('hidden'); _pendingBrushBounds = null;
  _switchToSelect();
  _setStatus(`${brushClass==='trigger'?'Trigger zone':'Brush'} "${brush.id}" created  (${x1-x0+1}×${(yMax-yMin).toFixed(2)}×${z1-z0+1})`);
});

// ── Entity dialog ─────────────────────────────────────────────────────────────
const entityDialog = document.getElementById('entity-dialog');
let _pendingEntityPos = null;

function _openEntityDialog(x, z) {
  _pendingEntityPos = {x, z};
  document.getElementById('en-id').value = _nextId('entity');
  document.getElementById('en-x').value = x;
  document.getElementById('en-z').value = z;
  const type = document.getElementById('en-type').value || 'decor';
  _updateEntityDialogType(type);
  entityDialog.classList.remove('hidden');
}

function _updateEntityDialogType(type) {
  document.getElementById('en-decor-opts').classList.toggle('hidden', type !== 'decor');
  document.getElementById('en-light-opts').classList.toggle('hidden', type !== 'light');
  document.getElementById('en-spawn-opts').classList.toggle('hidden', type !== 'spawn');
  document.getElementById('en-y-row').classList.toggle('hidden', type === 'spawn');
  if (type === 'decor') document.getElementById('en-y').value = '0.5';
  if (type === 'light') document.getElementById('en-y').value = '2';
}

document.getElementById('en-type').addEventListener('change', function() {
  _updateEntityDialogType(this.value);
});

document.getElementById('en-cancel').addEventListener('click', () => {
  entityDialog.classList.add('hidden'); _pendingEntityPos = null;
});

document.getElementById('en-create').addEventListener('click', () => {
  if (!_pendingEntityPos) return;
  const {x, z} = _pendingEntityPos;
  const id = document.getElementById('en-id').value || _nextId('entity');
  const entityType = document.getElementById('en-type').value;
  const entity = {id, entityType, x, y: parseFloat(document.getElementById('en-y').value) || 0.5, z};

  if (entityType === 'decor') {
    entity.w = parseFloat(document.getElementById('en-w').value) || 1;
    entity.h = parseFloat(document.getElementById('en-h').value) || 1;
    entity.d = parseFloat(document.getElementById('en-d').value) || 1;
    entity.color = parseInt(document.getElementById('en-dec-color').value.replace('#',''), 16);
  } else if (entityType === 'light') {
    entity.y = parseFloat(document.getElementById('en-y').value) || 2;
    entity.color = parseInt(document.getElementById('en-lgt-color').value.replace('#',''), 16);
    entity.intensity = parseFloat(document.getElementById('en-intensity').value) || 1.5;
    entity.distance  = parseFloat(document.getElementById('en-distance').value) || 10;
  } else if (entityType === 'spawn') {
    entity.y = 0;
    // Only one spawn entity — remove any existing
    ES.entities = ES.entities.filter(e => e.entityType !== 'spawn');
    ES.playerStart = {x, z};
    document.getElementById('meta-spawnx').value = x;
    document.getElementById('meta-spawnz').value = z;
  }

  _pushUndo();
  ES.entities.push(entity);
  rebuildLevel();
  selSet('entity', entity.id);
  _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  entityDialog.classList.add('hidden'); _pendingEntityPos = null;
  _switchToSelect();
  _setStatus(`Entity "${entity.id}" (${entityType}) placed at (${x}, ${z})`);
});

// ── Entity properties panel ───────────────────────────────────────────────────
function _showEntityProps(entity) {
  if (!entity) { propsContent.innerHTML='<p class="hint">Data not found.</p>'; return; }
  const typeOpts = ['decor','light','spawn'].map(v=>`<option value="${v}"${v===entity.entityType?' selected':''}>${v}</option>`).join('');

  let typeHtml = '';
  if (entity.entityType === 'decor') {
    typeHtml = `
      ${_tn('X','ep-x',entity.x)}${_tn('Y','ep-y',entity.y??0.5,0.1)}${_tn('Z','ep-z',entity.z)}
      ${_tn('W','ep-w',entity.w||1,0.1)}${_tn('H','ep-h',entity.h||1,0.1)}${_tn('D','ep-d',entity.d||1,0.1)}
      ${_tcol('Color','ep-color',entity.color)}`;
  } else if (entity.entityType === 'light') {
    typeHtml = `
      ${_tn('X','ep-x',entity.x)}${_tn('Y','ep-y',entity.y??2,0.1)}${_tn('Z','ep-z',entity.z)}
      ${_tcol('Color','ep-color',entity.color)}
      ${_tn('Intensity','ep-int',entity.intensity||1.5,0.1)}${_tn('Distance','ep-dist',entity.distance||10,1)}`;
  } else if (entity.entityType === 'spawn') {
    typeHtml = `${_tn('X','ep-x',entity.x)}${_tn('Z','ep-z',entity.z)}`;
  }

  propsContent.innerHTML = `
    <div class="prop-heading">Entity</div>
    ${_tr('ID','ep-id',entity.id)}
    <div class="prop-row"><label>Type</label><select id="ep-type">${typeOpts}</select></div>
    ${typeHtml}`;

  document.getElementById('ep-id')?.addEventListener('change', e => { entity.id=e.target.value; rebuildLevel(); _refreshLayersList(); });
  document.getElementById('ep-type')?.addEventListener('change', e => { entity.entityType=e.target.value; rebuildLevel(); _showEntityProps(entity); });

  const bN=(id,field)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ entity[field]=parseFloat(el.value); rebuildLevel(); }); };
  const bC=(id,field)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ entity[field]=parseInt(el.value.replace('#',''),16); rebuildLevel(); }); };

  bN('ep-x','x'); bN('ep-y','y'); bN('ep-z','z');
  if (entity.entityType === 'decor') { bN('ep-w','w'); bN('ep-h','h'); bN('ep-d','d'); bC('ep-color','color'); }
  if (entity.entityType === 'light') { bC('ep-color','color'); bN('ep-int','intensity'); bN('ep-dist','distance'); }
  // For spawn: X/Z changes also update ES.playerStart
  if (entity.entityType === 'spawn') {
    document.getElementById('ep-x')?.addEventListener('change', e => {
      ES.playerStart.x = parseFloat(e.target.value)||0;
      document.getElementById('meta-spawnx').value = ES.playerStart.x;
    });
    document.getElementById('ep-z')?.addEventListener('change', e => {
      ES.playerStart.z = parseFloat(e.target.value)||0;
      document.getElementById('meta-spawnz').value = ES.playerStart.z;
    });
  }
}

// ── Brush properties panel ────────────────────────────────────────────────────
function _showBrushProps(brush) {
  if (!brush) { propsContent.innerHTML='<p class="hint">Data not found.</p>'; return; }
  const _hex = c => '#'+((c||0x808080)>>>0).toString(16).padStart(6,'0');
  const isTrigger = brush.brushClass === 'trigger';

  let faceRows = FACE_ORDER.map(fk => {
    const f = (brush.faces||{})[fk] || {};
    const col = _hex(f.color??0x808080);
    const nd  = f.nodraw ? ' checked' : '';
    const isSelFace = _selectedFace?.brushId===brush.id && _selectedFace?.faceKey===fk;
    return `<div class="face-row${isSelFace?' sel-face':''}" data-face="${fk}">
      <span class="face-lbl">${FACE_LABEL[fk]}</span>
      <input type="color" id="bp-${fk}-col" value="${col}"${isTrigger?' disabled':''}>
      <label class="nodraw-lbl"><input type="checkbox" id="bp-${fk}-nd"${nd}${isTrigger?' disabled':''}> ND</label>
    </div>`;
  }).join('');

  const walkChk  = brush.walkable ? ' checked' : '';
  const classOpts = ['solid','trigger'].map(v=>`<option value="${v}"${v===brush.brushClass?' selected':''}>${v}</option>`).join('');

  // Trigger-only section
  const triggerTypeOpts = ['enter','leave','zone','killzone'].map(v=>`<option value="${v}"${v===brush.triggerType?' selected':''}>${v==='enter'?'onEnter':v==='leave'?'onLeave':v==='zone'?'zone (stay)':'killzone'}</option>`).join('');
  const triggerHtml = isTrigger ? `
    <div class="prop-separator"></div>
    <div class="prop-heading">Trigger</div>
    <div class="prop-row"><label>Event</label><select id="bp-trigger-type">${triggerTypeOpts}</select></div>
    ${_tr('Script ID','bp-script-id',brush.scriptId||'')}
    ${_tr('Tag','bp-tag',brush.tag||'')}
    ${_tcol('Color','bp-trigger-color',brush.triggerColor??0x4488ff)}` : '';

  propsContent.innerHTML = `
    <div class="prop-heading">${isTrigger?'Trigger Zone':'Brush'}</div>
    ${_tr('ID','bp-id',brush.id)}
    <div class="prop-row"><label>Class</label><select id="bp-class">${classOpts}</select></div>
    ${_tn('xMin','bp-xmin',brush.xMin)}${_tn('xMax','bp-xmax',brush.xMax)}
    ${_tn('zMin','bp-zmin',brush.zMin)}${_tn('zMax','bp-zmax',brush.zMax)}
    ${_tn('Y Min','bp-ymin',brush.yMin,0.1)}${_tn('Y Max','bp-ymax',brush.yMax,0.1)}
    <div class="prop-row"><label>Walkable</label>
      <label style="display:flex;align-items:center;gap:5px;width:auto">
        <input type="checkbox" id="bp-walkable"${walkChk} style="width:auto">
        <span style="font-size:11px;color:var(--text-dim)">nav mesh</span>
      </label>
    </div>
    ${triggerHtml}
    <div class="prop-separator"></div>
    <div class="prop-heading">Faces${isTrigger?' <span style="font-size:10px;color:var(--text-hint);font-weight:normal">(invisible in game)</span>':''}</div>
    <div class="face-grid">${faceRows}</div>`;

  // Bind fields
  const bN=(id,field)=>{ const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ brush[field]=parseFloat(el.value); rebuildLevel(); _updateHandles(brush.id,'brush'); }); };
  bN('bp-xmin','xMin'); bN('bp-xmax','xMax'); bN('bp-zmin','zMin'); bN('bp-zmax','zMax');
  bN('bp-ymin','yMin'); bN('bp-ymax','yMax');
  document.getElementById('bp-id')?.addEventListener('change', e => { brush.id=e.target.value; rebuildLevel(); _refreshLayersList(); });
  document.getElementById('bp-walkable')?.addEventListener('change', e => { brush.walkable=e.target.checked; });
  document.getElementById('bp-class')?.addEventListener('change', e => { brush.brushClass=e.target.value; rebuildLevel(); _showBrushProps(brush); });

  // Trigger-specific binds
  if (isTrigger) {
    document.getElementById('bp-trigger-type')?.addEventListener('change', e => { brush.triggerType=e.target.value; });
    document.getElementById('bp-script-id')?.addEventListener('change', e => { brush.scriptId=e.target.value; });
    document.getElementById('bp-tag')?.addEventListener('change', e => { brush.tag=e.target.value; });
    document.getElementById('bp-trigger-color')?.addEventListener('change', e => { brush.triggerColor=parseInt(e.target.value.replace('#',''),16); rebuildLevel(); });
  }

  // Bind face color + nodraw (solid only)
  if (!isTrigger) {
    FACE_ORDER.forEach(fk => {
      const colEl = document.getElementById(`bp-${fk}-col`);
      const ndEl  = document.getElementById(`bp-${fk}-nd`);
      if (!brush.faces) brush.faces={};
      if (!brush.faces[fk]) brush.faces[fk]={color:0x808080,nodraw:false};
      colEl?.addEventListener('change', () => { brush.faces[fk].color = parseInt(colEl.value.replace('#',''), 16); rebuildLevel(); });
      ndEl?.addEventListener('change',  () => { brush.faces[fk].nodraw = ndEl.checked; rebuildLevel(); });
    });
    // Face row click → highlight that face
    propsContent.querySelectorAll('.face-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.tagName==='INPUT') return;
        _selectedFace = { brushId: brush.id, faceKey: row.dataset.face };
        _showBrushProps(brush);
      });
    });
  }
}

// ── Nav / Compile toolbar buttons ─────────────────────────────────────────────
document.getElementById('btn-compile-nav').addEventListener('click', () => {
  if (ES.navMesh.length > 0) {
    document.getElementById('compile-nav-modal').classList.remove('hidden');
  } else {
    _pushUndo(); _compileNavMesh('override');
  }
});
document.getElementById('btn-nav-override').addEventListener('click', () => {
  document.getElementById('compile-nav-modal').classList.add('hidden');
  _pushUndo(); _compileNavMesh('override');
});
document.getElementById('btn-nav-new').addEventListener('click', () => {
  document.getElementById('compile-nav-modal').classList.add('hidden');
  _pushUndo(); _compileNavMesh('new');
});
document.getElementById('btn-nav-compile-cancel').addEventListener('click', () => {
  document.getElementById('compile-nav-modal').classList.add('hidden');
});

document.getElementById('btn-nav-toggle').addEventListener('click', function () {
  _showNavMesh = !_showNavMesh;
  this.classList.toggle('nav-active', _showNavMesh);
  if (_showNavMesh && !ES.navMesh.length) _compileNavMesh();
  else _buildNavOverlay();
  _setStatus(_showNavMesh ? `Nav overlay ON — ${ES.navMesh.length} tile(s)` : 'Nav overlay OFF');
});

// ── Metadata ──────────────────────────────────────────────────────────────────
document.getElementById('meta-name').addEventListener('change',e=>ES.levelName=e.target.value);
document.getElementById('meta-id').addEventListener('change',e=>ES.levelId=e.target.value);
document.getElementById('meta-steph').addEventListener('change',e=>ES.stepHeight=parseFloat(e.target.value)||0.3);
document.getElementById('meta-spawnx').addEventListener('change',e=>{ ES.playerStart.x=+e.target.value||0; spawnMesh.position.setX(ES.playerStart.x); spawnEdgeBox.position.setX(ES.playerStart.x); });
document.getElementById('meta-spawnz').addEventListener('change',e=>{ ES.playerStart.z=+e.target.value||0; spawnMesh.position.setZ(ES.playerStart.z); spawnEdgeBox.position.setZ(ES.playerStart.z); });

// ── Export / Import ───────────────────────────────────────────────────────────
function _serialize() {
  // Derive playerStart from spawn entity if present
  const _se=ES.entities.find(e=>e.entityType==='spawn');
  const _ps=_se ? {x:_se.x,z:_se.z} : ES.playerStart;
  const d={id:ES.levelId,name:ES.levelName,stepHeight:ES.stepHeight,playerStart:_ps,
    rooms:ES.rooms,elevatedTiles:ES.elevatedTiles,decoratives:ES.decoratives,lights:ES.lights,
    portals:ES.portals,brushes:ES.brushes,navMesh:ES.navMesh,navGroups:ES.navGroups,
    groups:ES.groups,entities:ES.entities};
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
// ── Load Level button — fetches manifest, lets user pick a level file ────────
document.getElementById('btn-load-level').addEventListener('click', () => {
  const modal   = document.getElementById('load-level-modal');
  const hint    = document.getElementById('load-level-hint');
  const listEl  = document.getElementById('load-level-list');
  listEl.innerHTML = '';
  modal.classList.remove('hidden');
  const entries = (window.LEVEL_MANIFEST && window.LEVEL_MANIFEST.levels) || [];
  if (!entries.length) { hint.textContent = 'No levels found in manifest.'; return; }
  hint.textContent = 'Pick a level to load into the editor:';
  entries.forEach(entry => {
    const btn = document.createElement('button');
    btn.className = 'level-pick-btn';
    btn.textContent = (entry.name || entry.id) + (entry.id ? '  (' + entry.id + ')' : '');
    btn.style.cssText = 'display:block;width:100%;margin:4px 0;padding:6px 10px;text-align:left;cursor:pointer;';
    btn.addEventListener('click', () => {
      hint.textContent = 'Loading ' + entry.file + '…';
      btn.disabled = true;
      const s = document.createElement('script');
      s.src = './levels/' + entry.file;
      s.onload = () => {
        const lvl = window.LEVELS && (window.LEVELS[entry.id] || window.LEVELS[Object.keys(window.LEVELS)[0]]);
        if (!lvl) { hint.textContent = 'No LEVELS entry found in file'; btn.disabled = false; return; }
        _loadLevel(lvl);
        modal.classList.add('hidden');
        _setStatus('Loaded ' + (lvl.name || entry.id));
      };
      s.onerror = () => { hint.textContent = 'Failed to load ' + entry.file; btn.disabled = false; };
      document.head.appendChild(s);
    });
    listEl.appendChild(btn);
  });
});
document.getElementById('btn-cancel-load-level').addEventListener('click',
  () => document.getElementById('load-level-modal').classList.add('hidden'));
document.getElementById('btn-new').addEventListener('click',()=>{
  if(!confirm('Clear current level?')) return;
  ES.rooms=[]; ES.elevatedTiles=[]; ES.decoratives=[]; ES.lights=[]; ES.portals=[]; ES.standaloneTiles=[]; ES.brushes=[]; ES.navMesh=[]; ES.groups=[]; ES.entities=[]; selClear();
  ES.levelId='level_new'; ES.levelName='New Level'; ES.stepHeight=0.3; ES.playerStart={x:0,z:0};
  ['meta-name','meta-id','meta-steph','meta-spawnx','meta-spawnz'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value={['meta-name']:'New Level',['meta-id']:'level_new',['meta-steph']:'0.3',['meta-spawnx']:'0',['meta-spawnz']:'0'}[id]||''; });
  rebuildLevel(); _showPropsForSelection(); _setStatus('New level');
});
function _loadLevel(lvl) {
  ES.levelId=lvl.id||'level1'; ES.levelName=lvl.name||'Imported'; ES.stepHeight=lvl.stepHeight||0.3;
  ES.playerStart=lvl.playerStart||{x:0,z:0}; ES.rooms=lvl.rooms||[]; ES.elevatedTiles=lvl.elevatedTiles||[];
  ES.decoratives=lvl.decoratives||[]; ES.lights=lvl.lights||[]; ES.portals=lvl.portals||[];
  ES.standaloneTiles=[]; ES.brushes=lvl.brushes||[]; ES.groups=lvl.groups||[];
  ES.navGroups=lvl.navGroups||[];
  ES.entities=lvl.entities||[];
  // Load nav mesh — migrate old cells without id/cost
  ES.navMesh=(lvl.navMesh||[]).map(c=>({
    id: c.id || _nextId('nav'),
    x: c.x, z: c.z,
    elevation: c.elevation??0,
    cost: c.cost??1,
    ...(c.navGroupId ? {navGroupId:c.navGroupId} : {}),
  }));
  // Migrate legacy decoratives + lights → entities on first load of old levels
  if (!ES.entities.length && (ES.decoratives.length || ES.lights.length)) {
    ES.decoratives.forEach(d=>{ES.entities.push({id:d.id||_nextId('entity'),entityType:'decor',x:d.x||0,y:d.y??0.5,z:d.z||0,w:d.w||1,h:d.h||1,d:d.d||1,color:d.color||0x606060});});
    ES.lights.forEach(l=>{ES.entities.push({id:l.id||_nextId('entity'),entityType:'light',x:l.x||0,y:l.y??2,z:l.z||0,color:l.color||0xffffff,intensity:l.intensity||1.5,distance:l.distance||10});});
    ES.decoratives=[]; ES.lights=[];
  }
  selClear();
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
  scene.overrideMaterial = isLive ? null : wireframeMat;
  renderer.render(scene,cam);
  scene.overrideMaterial = null;
  if(!isLive) renderer.clearDepth(); // helpers (grid, handles, selection) always on top in ortho
  // Each ortho view only shows handles for its two active axes — hide depth-axis handles per pass
  const _vpHideAxes = {
    top:   ['yMin','yMax',
            'xMinyMin','xMinyMax','xMaxyMin','xMaxyMax',   // XY corners only for Front
            'zMinyMin','zMinyMax','zMaxyMin','zMaxyMax'],  // ZY corners only for Side
    front: ['zMin','zMax',
            'xMinzMin','xMinzMax','xMaxzMin','xMaxzMax',   // XZ corners only for Top
            'zMinyMin','zMinyMax','zMaxyMin','zMaxyMax'],  // ZY corners only for Side
    side:  ['xMin','xMax',
            'xMinzMin','xMinzMax','xMaxzMin','xMaxzMax',   // XZ corners only for Top
            'xMinyMin','xMinyMax','xMaxyMin','xMaxyMax'],  // XY corners only for Front
  };
  const _axesToHide = _vpHideAxes[name] || [];
  const _savedVis = {};
  _axesToHide.forEach(ax=>{ _savedVis[ax]=handleMeshes[ax]?.visible; if(handleMeshes[ax]) handleMeshes[ax].visible=false; });
  renderer.render(helperScene,cam);
  _axesToHide.forEach(ax=>{ if(handleMeshes[ax]) handleMeshes[ax].visible=_savedVis[ax]; });
}
function animate() {
  requestAnimationFrame(animate);
  _flyTick();
  _renderVP('persp',perspCam,true);
  _renderVP('top',  topCam,  false);
  _renderVP('front',frontCam,false);
  _renderVP('side', sideCam, false);
  renderer.setScissorTest(false);
}
animate();

// ── Init ──────────────────────────────────────────────────────────────────────
_setStatus('Ready  ·  S=Select  B=Brush  E=Entity  N=Nav  ·  Z=fly  X=reset cam');
rebuildLevel();

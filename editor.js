/* ── editor.js — Hammer-style Level Editor ────────────────────────────────── */
'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const TILE_SIZE          = 1.0;
const SELECTION_COLOR    = 0xffcc00;  // selection highlight / handle corners
const DEFAULT_FACE_COLOR = 0x808080;  // default brush face / entity colour
const _colorToHex = (c, fallback=DEFAULT_FACE_COLOR) => '#' + ((c||fallback)>>>0).toString(16).padStart(6,'0');
const _round2dp = v => parseFloat(v.toFixed(2));  // snap float to 2 decimal places
// Per-viewport snap settings (tile = cell centres, intersection = grid line crossings).
const _vpSnap = {
  top:   { tile: true, intersection: false, gridDepthTest: false, showBrushEdges: true  },
  front: { tile: true, intersection: false, gridDepthTest: false, showBrushEdges: true  },
  side:  { tile: true, intersection: false, gridDepthTest: false, showBrushEdges: true  },
  persp: { tile: true, intersection: false, gridDepthTest: true,  showBrushEdges: false },
};

// Snap a world coordinate according to the active snap settings for a viewport.
// tile only        → cell centres  (0.5, 1.5, 2.5 …)
// intersection only→ grid crossings (0, 1, 2 …)
// both             → 0.5-unit steps  (0, 0.5, 1, 1.5 …)
// neither          → free (no snap)
function snapGrid(coord, viewport = 'top') {
  const s = _vpSnap[viewport] || _vpSnap.top;
  if (s.tile && s.intersection) return Math.round(coord * 2) / 2;
  if (s.tile)                   return (Math.round(coord / TILE_SIZE - 0.5) + 0.5) * TILE_SIZE;
  if (s.intersection)           return Math.round(coord / TILE_SIZE) * TILE_SIZE;
  return coord;
}
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

function _getEntityByKind(kind, id) {
  if (kind==='room')       return ES.rooms.find(r=>r.id===id)||null;
  if (kind==='standalone') return ES.standaloneTiles.find(t=>t.id===id)||null;
  if (kind==='elevated')   return ES.elevatedTiles.find(e=>e.id===id)||null;
  if (kind==='brush')      return ES.brushes.find(b=>b.id===id)||null;
  if (kind==='entity')     return ES.entities.find(e=>e.id===id)||null;
  if (kind==='nav')        return ES.navMesh.find(c=>c.id===id)||null;
  return null;
}
function _bindNumField(id, obj, field, afterChange=null, asInteger=false) {
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('change', () => { obj[field]=asInteger?parseInt(el.value):parseFloat(el.value); afterChange?.(); });
}
function _bindColorField(id, obj, field, afterChange=null) {
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('change', () => { obj[field]=parseInt(el.value.replace('#',''),16); afterChange?.(); });
}

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

const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x44aadd, wireframe: true });

// ── Grid helpers (helperScene — never wireframed) ─────────────────────────────
// Grid lines pass through integer coordinates — grid intersects at world 0,0,0.
// Each grid is only made visible in the matching viewport to prevent other grids
// projecting edge-on and overwriting the axis lines.
function _makeGridHelper(size, divs, centerColor, lineColor) {
  const g = new THREE.GridHelper(size, divs, centerColor, lineColor);
  [g.material].flat().forEach(m => { m.depthTest = false; m.depthWrite = false; });
  g.renderOrder = 0;
  g.frustumCulled = false;
  return g;
}

const gridTop   = _makeGridHelper(80, 80, 0xaaaaee, 0x555599); // XZ — top view
const gridFront = _makeGridHelper(80, 80, 0x9999dd, 0x4d4d88); // XY — front view
gridFront.rotation.x = Math.PI / 2;
const gridSide  = _makeGridHelper(80, 80, 0x9999dd, 0x4d4d88); // ZY — side view
gridSide.rotation.z = Math.PI / 2;

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
const roomBoundsBox = _makeEdgeBox(SELECTION_COLOR);

// Pool of BoxHelpers for multi-selection outlines
const selBoxPool = [];
function _clearSelBoxPool() {
  selBoxPool.forEach(b => helperScene.remove(b));
  selBoxPool.length = 0;
}
function _addSelOutline(mesh) {
  if (!mesh) return;
  const b = new THREE.BoxHelper(mesh, SELECTION_COLOR);
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
  xMinzMin: SELECTION_COLOR, xMinzMax: SELECTION_COLOR, xMaxzMin: SELECTION_COLOR, xMaxzMax: SELECTION_COLOR,
  xMinyMin: SELECTION_COLOR, xMinyMax: SELECTION_COLOR, xMaxyMin: SELECTION_COLOR, xMaxyMax: SELECTION_COLOR,
  zMinyMin: SELECTION_COLOR, zMinyMax: SELECTION_COLOR, zMaxyMin: SELECTION_COLOR, zMaxyMax: SELECTION_COLOR,
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
function _applyTopCam()   { topCam.position.set(topPanX,100,topPanZ); topCam.up.set(0,0,-1); topCam.lookAt(topPanX,0,topPanZ); }
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
function getViewportRect(viewport) {
  const W=canvas.clientWidth, H=canvas.clientHeight, hw=W/2, hh=H/2;
  return { persp:{x:0,y:hh,w:hw,h:hh}, top:{x:hw,y:0,w:hw,h:hh}, front:{x:hw,y:hh,w:hw,h:hh}, side:{x:0,y:0,w:hw,h:hh} }[viewport];
}
const _camFor = vp => ({ persp:perspCam, top:topCam, front:frontCam, side:sideCam }[vp]);
function getViewportAt(mouseX, mouseY) {
  const W=canvas.clientWidth, H=canvas.clientHeight;
  if (mouseX<W/2&&mouseY>=H/2) return 'persp';
  if (mouseX>=W/2&&mouseY<H/2)  return 'top';
  if (mouseX>=W/2&&mouseY>=H/2) return 'front';
  return 'side';
}
function toClip(viewport, mouseX, mouseY) {
  const r=getViewportRect(viewport);
  return { x:((mouseX-r.x)/r.w)*2-1, y:-((mouseY-r.y)/r.h)*2+1 };
}
// World XZ from top-view click (y=0 plane)
function topToWorld(mouseX, mouseY) {
  const ray=new THREE.Raycaster();
  ray.setFromCamera(toClip('top',mouseX,mouseY), topCam);
  const pt=new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),pt) ? {x:pt.x,z:pt.z} : null;
}
// World XY from front-view click
function frontToWorld(mouseX, mouseY) {
  const r=getViewportRect('front');
  const asp=canvas.clientWidth/canvas.clientHeight;
  const clipX=((mouseX-r.x)/r.w)*2-1, clipY=-((mouseY-r.y)/r.h)*2+1;
  return { x: frontPanX + clipX*orthoZoom*asp, y: frontPanY + clipY*orthoZoom };
}
// World ZY from side-view click (side cam looks from -X; screen-right = world +Z)
function sideToWorld(mouseX, mouseY) {
  const r=getViewportRect('side');
  const asp=canvas.clientWidth/canvas.clientHeight;
  const clipX=((mouseX-r.x)/r.w)*2-1, clipY=-((mouseY-r.y)/r.h)*2+1;
  return { z: sidePanZ + clipX*orthoZoom*asp, y: sidePanY + clipY*orthoZoom };
}
// World Y from mouse position in front or side view (ortho, Y is vertical axis)
function _worldYFromView(mouseX, mouseY, viewport) {
  if (viewport!=='front'&&viewport!=='side') return null;
  const clip=toClip(viewport,mouseX,mouseY);
  return (viewport==='front'?frontPanY:sidePanY)+clip.y*orthoZoom;
}

// Project world pos → CSS coords in a given viewport
function worldToCSS(worldX, worldY, worldZ, viewport) {
  const projected=new THREE.Vector3(worldX,worldY,worldZ).project(_camFor(viewport));
  const r=getViewportRect(viewport);
  return { x:r.x+(projected.x+1)/2*r.w, y:r.y+(1-projected.y)/2*r.h };
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

function _floorTile(x, z, elevation, color, roomId, targetArray) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE-TILE_GAP,TILE_THICKNESS,TILE_SIZE-TILE_GAP), _mat(color));
  mesh.position.set(x, elevation-TILE_THICKNESS/2, z);
  mesh.receiveShadow=true;
  mesh.userData={kind:'tile', roomId, x, z, elevation};
  levelGroup.add(mesh); (targetArray||tileMeshes).push(mesh);
  tmSet(x,z,{kind:'tile',roomId,elevation,walkable:true});
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
  mesh.userData={kind:'elevated',id:et.id,x:et.x,z:et.z,elevation:et.elevation,type:et.type};
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
    return new THREE.MeshLambertMaterial({color:f.color??DEFAULT_FACE_COLOR});
  });
  const mesh=new THREE.Mesh(geo,mats);
  mesh.position.copy(pos);
  mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={kind:'brush',id:brush.id,brushClass:'solid'};
  levelGroup.add(mesh); brushMeshes.push(mesh);

  // EdgesGeometry overlay in helperScene — draws clean box outlines (no diagonal artifacts)
  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x44aadd, depthTest: false })
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
  while (navHitboxGroup.children.length) {
    const o = navHitboxGroup.children[0]; navHitboxGroup.remove(o);
    o.geometry.dispose();
  }
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
  if (kind==='elevated')   return tileMeshes.find(m=>m.userData.kind==='elevated'&&m.userData.id===id)||null;
  return null;
}

// ── Room bounds box + handles ─────────────────────────────────────────────────
function _updateRoomBoundsBox(roomId) {
  const room=ES.rooms.find(r=>r.id===roomId);
  if (!room) { roomBoundsBox.visible=false; return; }
  const x0=room.xMin-0.5,x1=room.xMax+0.5,z0=room.zMin-0.5,z1=room.zMax+0.5;
  const elevation=room.elevation||0, boundsHeight=WALL_HEIGHT+elevation+0.05;
  roomBoundsBox.position.set((x0+x1)/2,boundsHeight/2,(z0+z1)/2);
  roomBoundsBox.scale.set(x1-x0,boundsHeight,z1-z0);
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
function _raycastHandles(mouseX, mouseY, viewport) {
  if (!handlesGroup.visible) return null;
  raycaster.setFromCamera(toClip(viewport,mouseX,mouseY), _camFor(viewport));
  const allowed = _vpHandleAxes[viewport];
  const targets = Object.entries(handleMeshes)
    .filter(([ax, m]) => m.visible && (!allowed || allowed.includes(ax)))
    .map(([, m]) => m);
  const hits = raycaster.intersectObjects(targets);
  return hits.length ? hits[0].object.userData.handleType : null;
}

// Returns userData of first hit; for brushes also includes materialIndex for face ID
function _raycastLevel(mouseX, mouseY, viewport) {
  raycaster.setFromCamera(toClip(viewport,mouseX,mouseY), _camFor(viewport));
  const selectableEnts = entityMeshes.filter(m => m.userData.kind === 'entity');
  const hits=raycaster.intersectObjects([...tileMeshes,...decorMeshes,...lightMeshes,...brushMeshes,...selectableEnts,...navHitboxGroup.children]);
  if (!hits.length) return null;
  const hit=hits[0];
  const userData={...hit.object.userData};
  if (userData.kind==='brush' && hit.face!=null) userData.materialIndex=hit.face.materialIndex;
  return userData;
}

// ── Drag-state ────────────────────────────────────────────────────────────────
let mouseButtons = { left:false, right:false, middle:false };
let lastMouse    = { x:0, y:0 };
let activeViewport     = null;
let _lastHoverViewport = 'top';  // last viewport the mouse was over — drives arrow keys

// Cache outline divs once DOM is ready
const _vpOutlines = {};
['persp','top','front','side'].forEach(n => {
  _vpOutlines[n] = document.getElementById('vp-outline-' + n);
});

function _setVPHighlight(viewport) {
  if (_lastHoverViewport === viewport) return;
  _lastHoverViewport = viewport;
  Object.entries(_vpOutlines).forEach(([name, el]) => {
    if (el) el.classList.toggle('active', name === viewport);
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
// ── Viewport context menu ─────────────────────────────────────────────────────
const _ctxMenu        = document.getElementById('ctx-menu');
const _ctxTitle       = document.getElementById('ctx-title');
const _ctxSnapT       = document.getElementById('ctx-snap-tile');
const _ctxSnapI       = document.getElementById('ctx-snap-intersection');
const _ctxGridDepth   = document.getElementById('ctx-grid-depth');
const _ctxBrushEdges  = document.getElementById('ctx-brush-edges');
const _ctxGridSection = document.getElementById('ctx-grid-section');
const _ctxGridXZ      = document.getElementById('ctx-grid-xz');
const _ctxGridXY      = document.getElementById('ctx-grid-xy');
const _ctxGridZY      = document.getElementById('ctx-grid-zy');
const _vpLabels = { top:'Top (XZ)', front:'Front (XY)', side:'Side (ZY)', persp:'3D' };
let _ctxViewport = null;

// Which grids are visible in the 3D (persp) view
const _perspGridVis = { xz: true, xy: true, zy: true };

function _showCtxMenu(viewport, screenX, screenY) {
  _ctxViewport = viewport;
  _ctxTitle.textContent = (_vpLabels[viewport] || viewport) + ' Options';
  _ctxSnapT.checked       = _vpSnap[viewport].tile;
  _ctxSnapI.checked       = _vpSnap[viewport].intersection;
  _ctxGridDepth.checked   = _vpSnap[viewport].gridDepthTest;
  _ctxBrushEdges.checked  = _vpSnap[viewport].showBrushEdges;
  // Show grid toggles only for the 3D view
  if (viewport === 'persp') {
    _ctxGridXZ.checked = _perspGridVis.xz;
    _ctxGridXY.checked = _perspGridVis.xy;
    _ctxGridZY.checked = _perspGridVis.zy;
    _ctxGridSection.classList.remove('hidden');
  } else {
    _ctxGridSection.classList.add('hidden');
  }
  _ctxMenu.classList.remove('hidden');
  // Keep menu inside the window
  const mw = _ctxMenu.offsetWidth || 200, mh = _ctxMenu.offsetHeight || 120;
  _ctxMenu.style.left = Math.min(screenX, window.innerWidth  - mw - 4) + 'px';
  _ctxMenu.style.top  = Math.min(screenY, window.innerHeight - mh - 4) + 'px';
}
function _hideCtxMenu() { _ctxMenu.classList.add('hidden'); _ctxViewport = null; }

_ctxSnapT.addEventListener('change',      () => { if (_ctxViewport) _vpSnap[_ctxViewport].tile           = _ctxSnapT.checked; });
_ctxSnapI.addEventListener('change',      () => { if (_ctxViewport) _vpSnap[_ctxViewport].intersection   = _ctxSnapI.checked; });
_ctxGridDepth.addEventListener('change',  () => { if (_ctxViewport) _vpSnap[_ctxViewport].gridDepthTest  = _ctxGridDepth.checked; });
_ctxBrushEdges.addEventListener('change', () => { if (_ctxViewport) _vpSnap[_ctxViewport].showBrushEdges = _ctxBrushEdges.checked; });
_ctxGridXZ.addEventListener('change', () => { _perspGridVis.xz = _ctxGridXZ.checked; });
_ctxGridXY.addEventListener('change', () => { _perspGridVis.xy = _ctxGridXY.checked; });
_ctxGridZY.addEventListener('change', () => { _perspGridVis.zy = _ctxGridZY.checked; });

document.addEventListener('mousedown', e => { if (!_ctxMenu.contains(e.target)) _hideCtxMenu(); });
document.addEventListener('keydown',   e => { if (e.key === 'Escape') _hideCtxMenu(); });

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (_dragDistance > DRAG_THRESHOLD) return; // was a drag, not a click
  const viewport = getViewportAt(e.offsetX, e.offsetY);
  if (viewport) _showCtxMenu(viewport, e.clientX, e.clientY);
});

canvas.addEventListener('mousedown', e => {
  const mouseX=e.offsetX, mouseY=e.offsetY;
  activeViewport=getViewportAt(mouseX,mouseY);
  lastMouse={x:mouseX,y:mouseY};
  _dragDistance=0;
  if (e.button===0) { mouseButtons.left=true;  _onLeftDown(mouseX,mouseY,e.ctrlKey||e.metaKey); }
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
    const movementX=e.movementX||0, movementY=e.movementY||0;
    perspYaw  -=movementX*0.002;
    perspPitch=Math.max(-1.4,Math.min(1.4,perspPitch-movementY*0.002));
    _applyPerspCam();
    return;
  }
  const rect=canvas.getBoundingClientRect();
  const mouseX=e.clientX-rect.left, mouseY=e.clientY-rect.top;
  const deltaX=mouseX-lastMouse.x, deltaY=mouseY-lastMouse.y;
  _dragDistance+=Math.abs(deltaX)+Math.abs(deltaY);
  lastMouse={x:mouseX,y:mouseY};
  _onMouseMove(mouseX,mouseY,deltaX,deltaY);
});

window.addEventListener('mouseleave', () => {
  Object.values(_vpOutlines).forEach(el => { if(el) el.classList.remove('active'); });
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const viewport=getViewportAt(e.offsetX,e.offsetY);
  if (viewport==='persp') {
    const dir=new THREE.Vector3(Math.cos(perspPitch)*Math.sin(perspYaw),Math.sin(perspPitch),Math.cos(perspPitch)*Math.cos(perspYaw));
    perspPos.addScaledVector(dir,-e.deltaY*0.05); _applyPerspCam();
  } else setOrthoZoom(orthoZoom+e.deltaY*0.05);
}, {passive:false});

// ── Left-down ─────────────────────────────────────────────────────────────────
function _onLeftDown(mouseX, mouseY, ctrl) {
  const viewport=activeViewport;

  // ── SELECT tool ──
  if (ES.tool==='select') {
    // 1. Resize handle?
    const handleType=_raycastHandles(mouseX,mouseY,viewport);
    if (handleType) {
      const roomSel=ES.selection.find(s=>s.kind==='room');
      if (roomSel) { _dragHandle={type:handleType,kind:'room',obj:ES.rooms.find(r=>r.id===roomSel.id)}; return; }
      const brushSel=ES.selection.find(s=>s.kind==='brush');
      if (brushSel) { _dragHandle={type:handleType,kind:'brush',obj:ES.brushes.find(b=>b.id===brushSel.id)}; return; }
    }

    // 2. Hit any object?
    const userData=_raycastLevel(mouseX,mouseY,viewport);
    if (userData) {
      const { kind, id: rawId, roomId, x, z, materialIndex } = userData;
      let kind2 = (kind==='tile'||kind==='wall') ? (roomId ? 'room' : (userData.kind==='standalone' ? 'standalone' : null)) : kind;
      const id2   = kind2==='room' ? roomId : rawId;
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
      if (viewport==='top')   { const worldPos=topToWorld(mouseX,mouseY);   if(worldPos) _startMoveDrag({x:worldPos.x,y:0,z:worldPos.z}, viewport); }
      if (viewport==='front') { const worldPos=frontToWorld(mouseX,mouseY); if(worldPos) _startMoveDrag({x:worldPos.x,y:worldPos.y,z:0}, viewport); }
      if (viewport==='side')  { const worldPos=sideToWorld(mouseX,mouseY);  if(worldPos) _startMoveDrag({x:0,y:worldPos.y,z:worldPos.z}, viewport); }
      return;
    }

    // 3. Empty space → marquee (or deselect on click)
    if (!ctrl && viewport!=='persp') {
      const worldPos=topToWorld(mouseX,mouseY);
      _dragMarquee={ startCSS:{x:mouseX,y:mouseY}, vpName:viewport, startWorld:worldPos };
    } else if (!ctrl) {
      selClear(); _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    }
    return;
  }

  // ── Other tools ──
  if ((ES.tool==='room'||ES.tool==='brush') && viewport==='top') {
    const worldPos=topToWorld(mouseX,mouseY);
    if (worldPos) {
      ES.drawing=true; ES.drawStart=ES.drawEnd={x:snapGrid(worldPos.x),z:snapGrid(worldPos.z)};
      _showDrawRect(true); _updateDrawRect(); _updatePreviewBox();
    }
    return;
  }
  if (ES.tool==='entity' && viewport==='top') {
    const worldPos=topToWorld(mouseX,mouseY);
    if(worldPos) _openEntityDialog(Math.round(worldPos.x), Math.round(worldPos.z));
    return;
  }
  if (ES.tool==='nav' && viewport==='top') {
    const worldPos=topToWorld(mouseX,mouseY); if(!worldPos) return;
    const tx=Math.round(worldPos.x), tz=Math.round(worldPos.z);
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
function _handleResizeDrag(mouseX, mouseY, viewport) {
  const obj=_dragHandle.obj, handleType=_dragHandle.type;
  if (['xMin','xMax','zMin','zMax','xMinzMin','xMinzMax','xMaxzMin','xMaxzMax'].includes(handleType)) {
    const worldPos=topToWorld(mouseX,mouseY); if (!worldPos) return;
    const snappedX=snapGrid(worldPos.x,'top'), snappedZ=snapGrid(worldPos.z,'top');
    switch (handleType) {
      case 'xMin':     obj.xMin=Math.min(snappedX,obj.xMax-1); break;
      case 'xMax':     obj.xMax=Math.max(snappedX,obj.xMin+1); break;
      case 'zMin':     obj.zMin=Math.min(snappedZ,obj.zMax-1); break;
      case 'zMax':     obj.zMax=Math.max(snappedZ,obj.zMin+1); break;
      case 'xMinzMin': obj.xMin=Math.min(snappedX,obj.xMax-1); obj.zMin=Math.min(snappedZ,obj.zMax-1); break;
      case 'xMinzMax': obj.xMin=Math.min(snappedX,obj.xMax-1); obj.zMax=Math.max(snappedZ,obj.zMin+1); break;
      case 'xMaxzMin': obj.xMax=Math.max(snappedX,obj.xMin+1); obj.zMin=Math.min(snappedZ,obj.zMax-1); break;
      case 'xMaxzMax': obj.xMax=Math.max(snappedX,obj.xMin+1); obj.zMax=Math.max(snappedZ,obj.zMin+1); break;
    }
    _setStatus(`${obj.id}: x[${obj.xMin}→${obj.xMax}]  z[${obj.zMin}→${obj.zMax}]`);
  } else if (['yMin','yMax'].includes(handleType)) {
    const rawY=_worldYFromView(mouseX,mouseY,viewport); if (rawY===null) return;
    const snappedY=_round2dp(rawY);
    if (handleType==='yMin') obj.yMin=Math.min(snappedY,obj.yMax-0.1);
    else                     obj.yMax=Math.max(snappedY,obj.yMin+0.1);
    _setStatus(`${obj.id}: y[${obj.yMin}→${obj.yMax}]`);
  } else if (['xMinyMin','xMinyMax','xMaxyMin','xMaxyMax'].includes(handleType)) {
    const worldPos=frontToWorld(mouseX,mouseY); if (!worldPos) return;
    const snappedX=snapGrid(worldPos.x,'front'), snappedY=_round2dp(worldPos.y);
    switch (handleType) {
      case 'xMinyMin': obj.xMin=Math.min(snappedX,obj.xMax-1); obj.yMin=Math.min(snappedY,obj.yMax-0.1); break;
      case 'xMinyMax': obj.xMin=Math.min(snappedX,obj.xMax-1); obj.yMax=Math.max(snappedY,obj.yMin+0.1); break;
      case 'xMaxyMin': obj.xMax=Math.max(snappedX,obj.xMin+1); obj.yMin=Math.min(snappedY,obj.yMax-0.1); break;
      case 'xMaxyMax': obj.xMax=Math.max(snappedX,obj.xMin+1); obj.yMax=Math.max(snappedY,obj.yMin+0.1); break;
    }
    _setStatus(`${obj.id}: x[${obj.xMin}→${obj.xMax}]  y[${obj.yMin}→${obj.yMax}]`);
  } else if (['zMinyMin','zMinyMax','zMaxyMin','zMaxyMax'].includes(handleType)) {
    const worldPos=sideToWorld(mouseX,mouseY); if (!worldPos) return;
    const snappedZ=snapGrid(worldPos.z,'side'), snappedY=_round2dp(worldPos.y);
    switch (handleType) {
      case 'zMinyMin': obj.zMin=Math.min(snappedZ,obj.zMax-1); obj.yMin=Math.min(snappedY,obj.yMax-0.1); break;
      case 'zMinyMax': obj.zMin=Math.min(snappedZ,obj.zMax-1); obj.yMax=Math.max(snappedY,obj.yMin+0.1); break;
      case 'zMaxyMin': obj.zMax=Math.max(snappedZ,obj.zMin+1); obj.yMin=Math.min(snappedY,obj.yMax-0.1); break;
      case 'zMaxyMax': obj.zMax=Math.max(snappedZ,obj.zMin+1); obj.yMax=Math.max(snappedY,obj.yMin+0.1); break;
    }
    _setStatus(`${obj.id}: z[${obj.zMin}→${obj.zMax}]  y[${obj.yMin}→${obj.yMax}]`);
  }
  rebuildLevel();
}

function _onMouseMove(mouseX, mouseY, deltaX, deltaY) {
  // Use activeViewport (locked on mousedown) when a button is held so drags don't
  // jump viewport mid-gesture.  For plain hover, always compute fresh.
  const hoverViewport = getViewportAt(mouseX, mouseY);
  const viewport = (mouseButtons.left || mouseButtons.middle || mouseButtons.right)
    ? (activeViewport || hoverViewport)
    : hoverViewport;
  _setVPHighlight(hoverViewport);

  if (_dragHandle && mouseButtons.left) { _handleResizeDrag(mouseX, mouseY, viewport); return; }

  // Selection move — use whichever viewport the drag started in
  if (_dragMove && mouseButtons.left && _dragDistance > DRAG_THRESHOLD) {
    const dragViewport = _dragMove.vp;
    if (dragViewport==='top') {
      const worldPos=topToWorld(mouseX,mouseY); if(!worldPos) return;
      _applyMoveDelta(Math.round(worldPos.x-_dragMove.worldStart.x), Math.round(worldPos.z-_dragMove.worldStart.z), 0);
    } else if (dragViewport==='front') {
      const worldPos=frontToWorld(mouseX,mouseY); if(!worldPos) return;
      _applyMoveDelta(Math.round(worldPos.x-_dragMove.worldStart.x), 0, _round2dp(worldPos.y-_dragMove.worldStart.y));
    } else if (dragViewport==='side') {
      const worldPos=sideToWorld(mouseX,mouseY); if(!worldPos) return;
      _applyMoveDelta(0, Math.round(worldPos.z-_dragMove.worldStart.z), _round2dp(worldPos.y-_dragMove.worldStart.y));
    }
    return;
  }

  // Marquee
  if (_dragMarquee && mouseButtons.left && _dragDistance > DRAG_THRESHOLD) {
    _updateMarqueeRect(_dragMarquee.startCSS, {x:mouseX,y:mouseY});
  }

  // Persp right-drag look
  if (mouseButtons.right && viewport==='persp') {
    perspYaw  -=deltaX*0.005;
    perspPitch=Math.max(-1.4,Math.min(1.4,perspPitch-deltaY*0.005));
    _applyPerspCam();
  }

  // Ortho pan — middle-drag or right-drag (non-persp)
  if (mouseButtons.middle || (mouseButtons.right && viewport!=='persp')) {
    const panScale=orthoZoom/(canvas.clientWidth/2)*3;
    if(viewport==='top')   { topPanX-=deltaX*panScale; topPanZ-=deltaY*panScale; _applyTopCam(); }
    if(viewport==='front') { frontPanX-=deltaX*panScale; frontPanY+=deltaY*panScale; _applyFrontCam(); }
    if(viewport==='side')  { sidePanZ-=deltaX*panScale; sidePanY+=deltaY*panScale; _applySideCam(); }
  }

  // Room / brush draw
  if (mouseButtons.left && (ES.tool==='room'||ES.tool==='brush') && ES.drawing && viewport==='top') {
    const worldPos=topToWorld(mouseX,mouseY);
    if (worldPos) { ES.drawEnd={x:snapGrid(worldPos.x),z:snapGrid(worldPos.z)}; _updateDrawRect(); _updatePreviewBox(); }
  }

  // Hover highlight (top view only, non-drag)
  if (viewport==='top'&&!mouseButtons.left) {
    const worldPos=topToWorld(mouseX,mouseY);
    if(worldPos) { hoverMesh.position.set(snapGrid(worldPos.x),0.01,snapGrid(worldPos.z)); hoverMesh.visible=true; }
  } else if(viewport!=='top') hoverMesh.visible=false;

  // Cursor feedback in select mode
  if (ES.tool==='select' && !mouseButtons.left) {
    if (_dragMove) {
      canvas.style.cursor='grabbing';
    } else {
      const handleType=_raycastHandles(mouseX,mouseY,viewport);
      if (handleType) {
        // Corner handles → diagonal resize; edge handles → axis resize
        const isCorner=CORNER_AXES.includes(handleType);
        const isX=(handleType==='xMin'||handleType==='xMax');
        const isY=(handleType==='yMin'||handleType==='yMax');
        canvas.style.cursor = isCorner ? 'nwse-resize' : isY ? 'ns-resize' : isX ? 'ew-resize' : 'ns-resize';
      } else {
        const hitData=_raycastLevel(mouseX,mouseY,viewport);
        canvas.style.cursor = (hitData && hitData.kind && hitData.kind!=='_entityRange') ? 'grab' : 'default';
      }
    }
  } else if (ES.tool==='select' && mouseButtons.left && _dragMove) {
    canvas.style.cursor='grabbing';
  }

  // Coord readout
  if (viewport==='top') {
    const worldPos=topToWorld(mouseX,mouseY);
    if(worldPos) document.getElementById('coord-top').textContent=`X ${worldPos.x.toFixed(1)}  Z ${worldPos.z.toFixed(1)}`;
  }
}

// ── Move drag helpers ─────────────────────────────────────────────────────────
function _startMoveDrag(worldPos, viewport) {
  _pushUndo();
  _dragMove = {
    vp: viewport || 'top',
    worldStart: { x: worldPos.x||0, y: worldPos.y||0, z: worldPos.z||0 },
    origStates: ES.selection.map(s => {
      const ent=_getEntityByKind(s.kind,s.id);
      if (!ent) return {...s, orig:null};
      if (s.kind==='room')       return {...s, orig:{xMin:ent.xMin,xMax:ent.xMax,zMin:ent.zMin,zMax:ent.zMax,yMin:0,yMax:0}};
      if (s.kind==='brush')      return {...s, orig:{xMin:ent.xMin,xMax:ent.xMax,zMin:ent.zMin,zMax:ent.zMax,yMin:ent.yMin,yMax:ent.yMax}};
      if (s.kind==='entity')     return {...s, orig:{x:ent.x,z:ent.z,y:ent.y??0}};
      if (s.kind==='standalone'||s.kind==='nav') return {...s, orig:{x:ent.x,z:ent.z,y:0}};
      return {...s, orig:null};
    }),
  };
}

function _applyMoveDelta(deltaX, deltaZ, deltaY=0) {
  if (!_dragMove) return;
  deltaY = _round2dp(deltaY);
  _dragMove.origStates.forEach(s => {
    if (!s.orig) return;
    const ent=_getEntityByKind(s.kind,s.id); if(!ent) return;
    if (s.kind==='room')       { ent.xMin=s.orig.xMin+deltaX; ent.xMax=s.orig.xMax+deltaX; ent.zMin=s.orig.zMin+deltaZ; ent.zMax=s.orig.zMax+deltaZ; }
    else if (s.kind==='standalone'||s.kind==='nav') { ent.x=s.orig.x+deltaX; ent.z=s.orig.z+deltaZ; }
    else if (s.kind==='brush') { ent.xMin=s.orig.xMin+deltaX; ent.xMax=s.orig.xMax+deltaX; ent.zMin=s.orig.zMin+deltaZ; ent.zMax=s.orig.zMax+deltaZ;
                                 ent.yMin=_round2dp(s.orig.yMin+deltaY); ent.yMax=_round2dp(s.orig.yMax+deltaY); }
    else if (s.kind==='entity') { ent.x=s.orig.x+deltaX; ent.z=s.orig.z+deltaZ; ent.y=_round2dp(s.orig.y+deltaY); }
  });
  rebuildLevel();
  const parts=[`Δx${deltaX>=0?'+':''}${deltaX}`, `Δz${deltaZ>=0?'+':''}${deltaZ}`];
  if(deltaY!==0) parts.push(`Δy${deltaY>=0?'+':''}${deltaY}`);
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

function _finishMarquee(cssStart, cssEnd, viewport, additive) {
  const cam=_camFor(viewport);
  const r=getViewportRect(viewport);
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
  ES.elevatedTiles.forEach(et => { if(inMarquee(et.x,et.elevation,et.z)) push('elevated',et.id); });
  ES.brushes.forEach(b => { const cx=(b.xMin+b.xMax)/2, cy=(b.yMin+b.yMax)/2, cz=(b.zMin+b.zMax)/2; if(inMarquee(cx,cy,cz)) push('brush',b.id); });
  ES.entities.forEach(e => { if(inMarquee(e.x, e.y??0.5, e.z)) push('entity',e.id); });
  ES.navMesh.forEach(c => { if(inMarquee(c.x, c.elevation??0, c.z)) push('nav',c.id); });

  ES.selection=newSel;
  _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
  _setStatus(`${newSel.length} item(s) selected`);
}

// ── Arrow key + Ctrl+D movement / duplication ─────────────────────────────────
function _moveSelection(deltaX, deltaZ, deltaY=0) {
  if (!ES.selection.length) return;
  _pushUndo();
  ES.selection.forEach(s => {
    const ent=_getEntityByKind(s.kind,s.id); if(!ent) return;
    if (s.kind==='room')       { ent.xMin+=deltaX; ent.xMax+=deltaX; ent.zMin+=deltaZ; ent.zMax+=deltaZ; }
    else if (s.kind==='standalone'||s.kind==='nav') { ent.x+=deltaX; ent.z+=deltaZ; }
    else if (s.kind==='brush') { ent.xMin+=deltaX; ent.xMax+=deltaX; ent.zMin+=deltaZ; ent.zMax+=deltaZ; ent.yMin+=deltaY; ent.yMax+=deltaY; }
    else if (s.kind==='entity') { ent.x+=deltaX; ent.z+=deltaZ; ent.y=(ent.y??0)+deltaY; }
  });
  rebuildLevel();
}

function _duplicateSelection() {
  if (!ES.selection.length) return;
  _pushUndo();
  const newSel=[];
  ES.selection.forEach(s => {
    const orig=_getEntityByKind(s.kind,s.id); if(!orig) return;
    const copy=JSON.parse(JSON.stringify(orig));
    if (s.kind==='room')       { copy.id=_nextId('room');   copy.xMin+=2; copy.xMax+=2; ES.rooms.push(copy);          newSel.push({kind:'room',id:copy.id}); }
    else if (s.kind==='standalone') { copy.id=_nextId('tile');   copy.x+=1;             ES.standaloneTiles.push(copy); newSel.push({kind:'standalone',id:copy.id}); }
    else if (s.kind==='brush') { copy.id=_nextId('brush');  copy.xMin+=2; copy.xMax+=2; ES.brushes.push(copy);        newSel.push({kind:'brush',id:copy.id}); }
    else if (s.kind==='entity'){ copy.id=_nextId('entity'); copy.x+=2;                 ES.entities.push(copy);        newSel.push({kind:'entity',id:copy.id}); }
    else if (s.kind==='nav')   { copy.id=_nextId('nav');    copy.x+=1;                 ES.navMesh.push(copy);         newSel.push({kind:'nav',id:copy.id}); }
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
    if(s.kind==='room')            ES.rooms=ES.rooms.filter(r=>r.id!==s.id);
    else if(s.kind==='standalone') ES.standaloneTiles=ES.standaloneTiles.filter(t=>t.id!==s.id);
    else if(s.kind==='elevated') ES.elevatedTiles=ES.elevatedTiles.filter(e=>e.id!==s.id);
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
        case 'standalone': return ES.standaloneTiles.some(t=>t.id===ref.id);
        case 'elevated':   return ES.elevatedTiles.some(e=>e.id===ref.id);
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
    const ent=_getEntityByKind(kind,id);
    if(kind==='brush')   _showBrushProps(ent);
    else if(kind==='entity') _showEntityProps(ent);
    else if(kind==='nav')    _showNavProps(ent);
    else _showProps(kind, ent);
    return;
  }
  // Multi-select → batch editor
  const kinds=[...new Set(ES.selection.map(s=>s.kind))];
  const items=ES.selection.map(s=>{
    const data=_getEntityByKind(s.kind,s.id);
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
  const rebuild=()=>rebuildLevel();
  _bindNumField('np-x',cell,'x',rebuild,true); _bindNumField('np-z',cell,'z',rebuild,true);
  _bindNumField('np-elev',cell,'elevation',rebuild); _bindNumField('np-cost',cell,'cost',rebuild,true);
  document.getElementById('np-group')?.addEventListener('change',e=>{
    cell.navGroupId=e.target.value||undefined; _refreshLayersList();
  });
}

function _getSharedValue(items, field) {
  const vals=items.map(i=>i.data[field]); return vals.every(v=>v===vals[0])?vals[0]:null;
}

function _buildBatchHTML(kinds, items, count) {
  const shared = field => _getSharedValue(items, field);
  const bnum = (l,id,field,step=1) => { const v=shared(field); return `<div class="prop-row"><label>${l}</label><input type="number" id="${id}" value="${v!==null?v:''}" step="${step}" placeholder="${v===null?'mixed':''}"></div>`; };
  const bcol = (l,id,field) => { const v=shared(field); const isMixed=v===null; const hex=isMixed?'#808080':_colorToHex(v,0); return `<div class="prop-row"><label>${l}</label><input type="color" id="${id}" value="${hex}"${isMixed?' title="Mixed — will override all" style="opacity:0.55"':''}></div>`; };
  const bsel = (l,id,field,opts) => { const v=shared(field); return `<div class="prop-row"><label>${l}</label><select id="${id}">${v===null?'<option value="" disabled selected>— mixed —</option>':''}${opts.map(o=>`<option value="${o}"${o===v?' selected':''}>${o}</option>`).join('')}</select></div>`; };

  const sameKind=kinds.length===1, kind=kinds[0];
  let html=`<div class="prop-heading">${count} items${sameKind?' · '+kind:' · mixed'}</div>`;

  if (sameKind) {
    if (kind==='room') {
      html+=bnum('Elevation','bm-elev','elevation',0.3);
      html+=`<div class="prop-row palette-row"><label>Palette</label><div class="palette-list" id="bm-pal"></div><input type="color" id="bm-swatch-pick" style="opacity:0;width:0;height:0;padding:0;border:0;position:absolute"><button class="small-btn" id="bm-addpal">+ Add</button></div>`;
    } else if (kind==='standalone') {
      html+=bnum('Elevation','bm-elev','elevation',0.3);
      html+=bcol('Color','bm-color','color');
    } else if (kind==='elevated') {
      html+=bnum('Elevation','bm-elev','elevation',0.3);
      html+=bsel('Type','bm-type','type',['step','platform']);
    } else if (kind==='nav') {
      const xs=[...new Set(items.map(i=>i.data.x))];
      const zs=[...new Set(items.map(i=>i.data.z))];
      const posHint=xs.length===1&&zs.length===1?`(${xs[0]}, ${zs[0]})`:`${n} positions`;
      html+=`<p class="hint" style="margin:2px 0 6px">${posHint} — move with arrow keys</p>`;
      html+=bnum('Elevation','bm-elev','elevation',0.1);
      html+=bnum('Cost','bm-cost','cost',1);
      const gShared=shared('navGroupId');
      const gMixed=gShared===null&&ES.navGroups.length>0;
      const gOpts=`<option value="">— none —</option>`+ES.navGroups.map(g=>`<option value="${g.id}"${g.id===gShared?' selected':''}>${_escHtml(g.name)}</option>`).join('');
      html+=`<div class="prop-row"><label>Group</label><select id="bm-navgroup">${gMixed?'<option value="" disabled selected>— mixed —</option>':''}${gOpts}</select></div>`;
    } else if (kind==='brush') {
      const walkShared=shared('walkable');
      html+=`<div class="prop-row"><label>Walkable</label><label style="display:flex;align-items:center;gap:5px;width:auto">
        <input type="checkbox" id="bm-walkable"${walkShared===true?' checked':''}${walkShared===null?' data-ind="1"':''} style="width:auto">
        ${walkShared===null?'<span style="font-size:10px;color:var(--text-dim)">mixed</span>':''}</label></div>`;
      html+=`<div class="prop-heading" style="margin-top:8px">Faces <span style="font-size:10px;color:var(--text-hint);font-weight:normal">each change applies to all</span></div>`;
      html+=`<div class="face-grid">`;
      FACE_ORDER.forEach(fk=>{
        const fVals=items.map(i=>i.data.faces?.[fk]?.color??DEFAULT_FACE_COLOR);
        const fShared=fVals.every(v=>v===fVals[0])?fVals[0]:null;
        const fHex=_colorToHex(fShared, DEFAULT_FACE_COLOR);
        const ndVals=items.map(i=>i.data.faces?.[fk]?.nodraw??false);
        const ndShared=ndVals.every(v=>v===ndVals[0])?ndVals[0]:null;
        html+=`<div class="face-row" data-face="${fk}">
          <span class="face-lbl">${FACE_LABEL[fk]}</span>
          <input type="color" id="bm-${fk}-col" value="${fHex}"${fShared===null?' title="Mixed" style="opacity:0.55"':''}>
          <label class="nodraw-lbl"><input type="checkbox" id="bm-${fk}-nd"${ndShared===true?' checked':''}${ndShared===null?' data-ind="1"':''}> ND</label>
        </div>`;
      });
      html+=`</div>`;
    } else if (kind==='entity') {
      const etypes=[...new Set(items.map(i=>i.data.entityType))];
      if (etypes.length===1&&etypes[0]==='decor') {
        html+=bcol('Color','bm-color','color');
        html+=bnum('W','bm-w','w',0.1)+bnum('H','bm-h','h',0.1)+bnum('D','bm-d','d',0.1);
      } else if (etypes.length===1&&etypes[0]==='light') {
        html+=bcol('Color','bm-color','color');
        html+=bnum('Intensity','bm-int','intensity',0.1)+bnum('Distance','bm-dist','distance',1);
      } else {
        html+=`<p class="hint" style="margin-top:4px">Mixed entity types — no shared properties.</p>`;
      }
    }
  } else {
    html+=`<p class="hint" style="margin-top:4px">Mixed types.</p>`;
    const bnum2=(l,id,field,step=1)=>{ const v=shared(field); return `<div class="prop-row"><label>${l}</label><input type="number" id="${id}" value="${v!==null?v:''}" step="${step}" placeholder="${v===null?'mixed':''}"></div>`; };
    if (items.every(i=>i.data.elevation!==undefined)) html+=bnum2('Elevation','bm-elev','elevation',0.3);
  }
  html+=`<p class="hint" style="margin-top:6px;font-size:10px">Changes apply to all ${count} items  ·  Del=delete  Ctrl+D=dup</p>`;
  return html;
}

function _bindBatchHandlers(kinds, items) {
  const bBN    = (id,field) => { const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ const v=parseFloat(el.value); if(isNaN(v))return; _pushUndo(); items.forEach(i=>{i.data[field]=v;}); rebuildLevel(); }); };
  const bBNInt = (id,field) => { const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ const v=Math.round(parseFloat(el.value)); if(isNaN(v))return; _pushUndo(); items.forEach(i=>{i.data[field]=v;}); rebuildLevel(); }); };
  const bBC    = (id,field) => { const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ const v=parseInt(el.value.replace('#',''),16); _pushUndo(); items.forEach(i=>{i.data[field]=v;}); rebuildLevel(); }); };
  const bBS    = (id,field) => { const el=document.getElementById(id); if(!el)return; el.addEventListener('change',()=>{ if(!el.value)return; _pushUndo(); items.forEach(i=>{i.data[field]=el.value;}); rebuildLevel(); }); };

  const sameKind=kinds.length===1, kind=kinds[0];
  if (sameKind) {
    if (kind==='room') {
      bBN('bm-elev','elevation');
      const palEl=document.getElementById('bm-pal');
      const pickEl=document.getElementById('bm-swatch-pick');
      if (palEl&&pickEl) {
        const maxLen=Math.max(...items.map(i=>(i.data.palette||[]).length),0);
        let sw='';
        for (let idx=0;idx<maxLen;idx++) {
          const vals=items.map(i=>(i.data.palette||[])[idx]).filter(v=>v!==undefined);
          const same=vals.length&&vals.every(v=>v===vals[0]);
          const hex=same?_colorToHex(vals[0]):'#404040';
          sw+=`<span class="palette-swatch" style="background:${hex}${!same?';outline:1px dashed #888':''}" data-idx="${idx}" title="${same?'Click to edit':'Mixed — click to unify'}"><span class="swatch-del">✕</span></span>`;
        }
        palEl.innerHTML=sw;
        let _pickIdx=-1;
        pickEl.addEventListener('change',()=>{
          if (_pickIdx<0) return;
          const v=parseInt(pickEl.value.replace('#',''),16);
          _pushUndo();
          items.forEach(i=>{if(!i.data.palette)i.data.palette=[];while(i.data.palette.length<=_pickIdx)i.data.palette.push(DEFAULT_FACE_COLOR);i.data.palette[_pickIdx]=v;});
          rebuildLevel(); _showPropsForSelection();
        });
        palEl.querySelectorAll('.palette-swatch').forEach(sw=>{
          sw.addEventListener('click',e=>{
            if (e.target.classList.contains('swatch-del')) {
              e.stopPropagation();
              const idx=+sw.dataset.idx; _pushUndo();
              items.forEach(i=>{if(i.data.palette)i.data.palette.splice(idx,1);});
              rebuildLevel(); _showPropsForSelection(); return;
            }
            _pickIdx=+sw.dataset.idx;
            const vals=items.map(i=>(i.data.palette||[])[_pickIdx]).filter(v=>v!==undefined);
            pickEl.value=_colorToHex(vals[0]);
            pickEl.click();
          });
        });
        document.getElementById('bm-addpal')?.addEventListener('click',()=>{ _pushUndo(); items.forEach(i=>{if(!i.data.palette)i.data.palette=[];i.data.palette.push(DEFAULT_FACE_COLOR);}); rebuildLevel(); _showPropsForSelection(); });
      }
    } else if (kind==='standalone') { bBN('bm-elev','elevation'); bBC('bm-color','color'); }
    else if (kind==='elevated')     { bBN('bm-elev','elevation'); bBS('bm-type','type'); }
    else if (kind==='nav') {
      bBN('bm-elev','elevation');
      bBNInt('bm-cost','cost');
      document.getElementById('bm-navgroup')?.addEventListener('change',e=>{
        _pushUndo();
        const gid=e.target.value||undefined;
        items.forEach(i=>{ i.data.navGroupId=gid; });
        _refreshLayersList();
      });
    } else if (kind==='brush') {
      const walkEl=document.getElementById('bm-walkable');
      if (walkEl) walkEl.addEventListener('change',()=>{
        _pushUndo(); items.forEach(i=>{i.data.walkable=walkEl.checked;}); rebuildLevel();
      });
      FACE_ORDER.forEach(fk=>{
        const colEl=document.getElementById(`bm-${fk}-col`);
        const ndEl =document.getElementById(`bm-${fk}-nd`);
        colEl?.addEventListener('change',()=>{
          const v=parseInt(colEl.value.replace('#',''),16); _pushUndo();
          items.forEach(i=>{ if(!i.data.faces)i.data.faces={}; if(!i.data.faces[fk])i.data.faces[fk]={color:DEFAULT_FACE_COLOR,nodraw:false}; i.data.faces[fk].color=v; });
          rebuildLevel();
        });
        ndEl?.addEventListener('change',()=>{
          _pushUndo();
          items.forEach(i=>{ if(!i.data.faces)i.data.faces={}; if(!i.data.faces[fk])i.data.faces[fk]={color:DEFAULT_FACE_COLOR,nodraw:false}; i.data.faces[fk].nodraw=ndEl.checked; });
          rebuildLevel();
        });
      });
    } else if (kind==='entity') {
      const etypes=[...new Set(items.map(i=>i.data.entityType))];
      if (etypes.length===1&&etypes[0]==='decor') { bBC('bm-color','color'); bBN('bm-w','w'); bBN('bm-h','h'); bBN('bm-d','d'); }
      else if (etypes.length===1&&etypes[0]==='light') { bBC('bm-color','color'); bBN('bm-int','intensity'); bBN('bm-dist','distance'); }
    }
  } else {
    bBN('bm-elev','elevation');
  }
}

function _showBatchProps(kinds, items, count) {
  propsContent.innerHTML = _buildBatchHTML(kinds, items, count);
  propsContent.querySelectorAll('[data-ind="1"]').forEach(el=>{ el.indeterminate=true; });
  _bindBatchHandlers(kinds, items);
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
  propsContent.innerHTML=html;
  _bindProps(kind,data);
}

function _propRow(label, id, value, type='text', options=null, step=1) {
  let input;
  if      (type==='select') input=`<select id="${id}">${options.map(o=>`<option value="${o}"${o===value?' selected':''}>${o}</option>`).join('')}</select>`;
  else if (type==='color')  input=`<input type="color" id="${id}" value="${_colorToHex(value)}">`;
  else if (type==='number') input=`<input type="number" id="${id}" value="${value||0}" step="${step}">`;
  else                      input=`<input type="text" id="${id}" value="${value||''}">`;
  return `<div class="prop-row"><label>${label}</label>${input}</div>`;
}
const _tr  = (l,id,v)      => _propRow(l, id, v);
const _tn  = (l,id,v,s=1)  => _propRow(l, id, v, 'number', null, s);
const _tsel= (l,id,v,opts) => _propRow(l, id, v, 'select', opts);
const _tcol= (l,id,v)      => _propRow(l, id, v, 'color');
function _palRows(room) {
  if(!room.palette) return '';
  const sw=room.palette.map((c,i)=>{const h=_colorToHex(c,0);return `<span class="palette-swatch" style="background:${h}" data-idx="${i}"><span class="swatch-del">✕</span></span>`;}).join('');
  return `<div class="prop-row palette-row"><label>Palette</label><div class="palette-list" id="pp-pal">${sw}</div><button class="small-btn" id="pp-add">+ Add</button></div>`;
}
function _bindProps(kind,data) {
  const b=(id,field,num,col)=>{ const el=document.getElementById(id); if(!el) return; el.addEventListener('change',()=>{ let v=el.value; if(col) v=parseInt(v.replace('#',''),16); else if(num) v=parseFloat(v); data[field]=v; rebuildLevel(); if(kind==='room'){_updateRoomBoundsBox(data.id);_updateHandles(data.id);} }); };
  if(kind==='room')            { b('pr-id','id'); b('pr-xmin','xMin',true); b('pr-xmax','xMax',true); b('pr-zmin','zMin',true); b('pr-zmax','zMax',true); b('pr-elev','elevation',true); document.getElementById('pp-pal')?.querySelectorAll('.swatch-del').forEach(d=>d.addEventListener('click',e=>{e.stopPropagation();data.palette.splice(+d.parentElement.dataset.idx,1);rebuildLevel();_showProps('room',data);})); document.getElementById('pp-add')?.addEventListener('click',()=>{data.palette.push(DEFAULT_FACE_COLOR);rebuildLevel();_showProps('room',data);}); }
  else if(kind==='elevated')   { b('pe-elev','elevation',true); b('pe-type','type'); }
  else if(kind==='standalone') { b('ps-x','x',true); b('ps-z','z',true); b('ps-elev','elevation',true); b('ps-color','color',false,true); }
}

// ── Layers list ───────────────────────────────────────────────────────────────
const layersList=document.getElementById('layers-list');

const _escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function _getItemDisplay(kind, id) {
  const e=_getEntityByKind(kind,id); if(!e) return null;
  switch(kind) {
    case 'room':       return {icon:'▣',name:e.id,sub:e.type};
    case 'brush':      return {icon:e.brushClass==='trigger'?'◈':'⬛',name:e.id,sub:e.brushClass==='trigger'?`trigger:${e.triggerType||'enter'}`:'brush'};
    case 'elevated':   return {icon:'▲',name:e.id,sub:'elev'};
    case 'standalone': return {icon:'◻',name:e.id,sub:'tile'};
    case 'entity':     return {icon:{decor:'□',light:'✦',spawn:'⊕'}[e.entityType]||'●',name:e.id,sub:e.entityType};
    case 'nav':        return {icon:'⬡',name:e.id,sub:`cost:${e.cost??1}`};
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
    ...ES.elevatedTiles.map(et=>({kind:'elevated',id:et.id})),
    ...ES.standaloneTiles.map(st=>({kind:'standalone',id:st.id})),
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
    ES.elevatedTiles.forEach(et=>selAdd('elevated',et.id));
    ES.standaloneTiles.forEach(st=>selAdd('standalone',st.id));
    _refreshSelBoxes(); _refreshLayersList(); _showPropsForSelection();
    _setStatus(`${ES.selection.length} item(s) selected`);
  }

  // Arrow keys — move selection, direction depends on hovered viewport
  // top  (XZ): ←/→ = ±X,  ↑/↓ = ±Z
  // front(XY): ←/→ = ±X,  ↑/↓ = ±Y
  // side (ZY): ←/→ = ±Z,  ↑/↓ = ±Y
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const viewport = _lastHoverViewport;
    const neg = (e.key==='ArrowLeft'||e.key==='ArrowUp') ? -1 : 1;
    const horiz = (e.key==='ArrowLeft'||e.key==='ArrowRight');
    if (viewport==='top') {
      if (horiz) _moveSelection(neg, 0, 0);
      else        _moveSelection(0, neg, 0);
    } else if (viewport==='front') {
      if (horiz) _moveSelection(neg, 0, 0);
      else        _moveSelection(0, 0, -neg);
    } else if (viewport==='side') {
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

function _toggleLava(mouseX,mouseY) {
  const worldPos=topToWorld(mouseX,mouseY); if(!worldPos) return;
  const tx=Math.round(worldPos.x),tz=Math.round(worldPos.z);
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

// ── SVG draw rect ─────────────────────────────────────────────────────────────
const drawRect=document.getElementById('draw-rect');
function _showDrawRect(visible) { drawRect.setAttribute('visibility',visible?'visible':'hidden'); }
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

  const rebuild=()=>rebuildLevel();
  _bindNumField('ep-x',entity,'x',rebuild); _bindNumField('ep-y',entity,'y',rebuild); _bindNumField('ep-z',entity,'z',rebuild);
  if (entity.entityType === 'decor') { _bindNumField('ep-w',entity,'w',rebuild); _bindNumField('ep-h',entity,'h',rebuild); _bindNumField('ep-d',entity,'d',rebuild); _bindColorField('ep-color',entity,'color',rebuild); }
  if (entity.entityType === 'light') { _bindColorField('ep-color',entity,'color',rebuild); _bindNumField('ep-int',entity,'intensity',rebuild); _bindNumField('ep-dist',entity,'distance',rebuild); }
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
  const isTrigger = brush.brushClass === 'trigger';

  let faceRows = FACE_ORDER.map(fk => {
    const f = (brush.faces||{})[fk] || {};
    const col = _colorToHex(f.color);
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
  const afterBrush=()=>{ rebuildLevel(); _updateHandles(brush.id,'brush'); };
  _bindNumField('bp-xmin',brush,'xMin',afterBrush); _bindNumField('bp-xmax',brush,'xMax',afterBrush);
  _bindNumField('bp-zmin',brush,'zMin',afterBrush); _bindNumField('bp-zmax',brush,'zMax',afterBrush);
  _bindNumField('bp-ymin',brush,'yMin',afterBrush); _bindNumField('bp-ymax',brush,'yMax',afterBrush);
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
      if (!brush.faces[fk]) brush.faces[fk]={color:DEFAULT_FACE_COLOR,nodraw:false};
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
  ES.playerStart=lvl.playerStart||{x:0,z:0}; ES.rooms=lvl.rooms||[];
  ES.elevatedTiles=(lvl.elevatedTiles||[]).map(et=>et.id ? et : {...et, id:_nextId('elev')});
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
  // Migrate legacy decoratives + lights → entities (always, so legacy arrays are always empty after load)
  if (ES.decoratives.length || ES.lights.length) {
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

function _renderVP(viewportName, camera, isLive) {
  const r=getViewportRect(viewportName), W=canvas.clientWidth, H=canvas.clientHeight;
  const bly=H-r.y-r.h;
  renderer.setViewport(r.x,bly,r.w,r.h); renderer.setScissor(r.x,bly,r.w,r.h); renderer.setScissorTest(true);
  renderer.clear(true,true,true);
  scene.overrideMaterial = isLive ? null : wireframeMat;
  renderer.render(scene,camera);
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
  const _axesToHide = _vpHideAxes[viewportName] || [];
  const _savedVis = {};
  _axesToHide.forEach(ax=>{ _savedVis[ax]=handleMeshes[ax]?.visible; if(handleMeshes[ax]) handleMeshes[ax].visible=false; });
  // Each ortho view only shows its own grid to prevent other grids projecting
  // edge-on and overdrawing the axis lines. Persp respects per-grid toggles.
  const _gridVis = viewportName === 'persp'
    ? [_perspGridVis.xz, _perspGridVis.xy, _perspGridVis.zy]
    : ({ top:[true,false,false], front:[false,true,false], side:[false,false,true] }[viewportName] || [true,true,true]);
  [gridTop,gridFront,gridSide].forEach((g,i)=>{ g.visible=_gridVis[i]; });
  // Apply per-viewport grid depth-test setting (on = grid respects solid geometry).
  const _grids = [gridTop,gridFront,gridSide];
  const _gdt = _vpSnap[viewportName]?.gridDepthTest ?? false;
  if (_gdt) _grids.forEach(g=>{ [g.material].flat().forEach(m=>{ m.depthTest=true; }); });
  const _showEdges = _vpSnap[viewportName]?.showBrushEdges ?? true;
  brushEdgeGroup.visible = _showEdges;
  renderer.render(helperScene,camera);
  brushEdgeGroup.visible = true;
  if (_gdt) _grids.forEach(g=>{ [g.material].flat().forEach(m=>{ m.depthTest=false; }); });
  [gridTop,gridFront,gridSide].forEach(g=>{ g.visible=true; });
  _axesToHide.forEach(ax=>{ if(handleMeshes[ax]) handleMeshes[ax].visible=_savedVis[ax]; });
}
// ── 3D-viewport axis label projection ────────────────────────────────────────
// Cache DOM references once so we don't query the DOM every frame.
const _ax3d = {
  px: document.getElementById('ax-3d-px'),
  nx: document.getElementById('ax-3d-nx'),
  pz: document.getElementById('ax-3d-pz'),
  nz: document.getElementById('ax-3d-nz'),
};
// World points that represent each axis direction (far enough to be stable).
const _ax3dPts = {
  px: new THREE.Vector3( 9, 0,  0),
  nx: new THREE.Vector3(-9, 0,  0),
  pz: new THREE.Vector3( 0, 0,  9),
  nz: new THREE.Vector3( 0, 0, -9),
};
const _ax3dTmp = new THREE.Vector3();

function _updateAxisLabels3D() {
  const r = getViewportRect('persp');   // {x, y, w, h} in CSS pixels (y=top-down)
  // Margin so labels don't clip at the very edge of the viewport
  const M = 12;
  const xMin = r.x + M, xMax = r.x + r.w - M;
  const yMin = r.y + M, yMax = r.y + r.h - M;

  for (const key in _ax3d) {
    // Project world point through perspCam to NDC [-1,1]
    _ax3dTmp.copy(_ax3dPts[key]).project(perspCam);
    // Convert NDC → CSS pixel coords within the BL viewport
    const cssX = r.x + (_ax3dTmp.x + 1) / 2 * r.w;
    const cssY = r.y + (1 - _ax3dTmp.y) / 2 * r.h;
    // Clamp to stay inside the viewport
    const clampedX = Math.max(xMin, Math.min(xMax, cssX));
    const clampedY = Math.max(yMin, Math.min(yMax, cssY));
    _ax3d[key].style.left = clampedX + 'px';
    _ax3d[key].style.top  = clampedY + 'px';
    // Shift label so its centre sits on the projected point
    _ax3d[key].style.transform = 'translate(-50%, -50%)';
  }
}

function animate() {
  requestAnimationFrame(animate);
  _flyTick();
  _renderVP('persp',perspCam,true);
  _renderVP('top',  topCam,  false);
  _renderVP('front',frontCam,false);
  _renderVP('side', sideCam, false);
  renderer.setScissorTest(false);
  _updateAxisLabels3D();
}
animate();

// ── Init ──────────────────────────────────────────────────────────────────────
_setStatus('Ready  ·  S=Select  B=Brush  E=Entity  N=Nav  ·  Z=fly  X=reset cam');
rebuildLevel();

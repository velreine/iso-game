/* ── editor.js — Hammer-style Level Editor ────────────────────────────────── */
'use strict';

// ── Constants (mirror game.js) ──────────────────────────────────────────────
const TILE_SIZE      = 1.0;
const TILE_THICKNESS = 0.22;
const TILE_GAP       = 0.06;
const STEP_H         = 0.3;
const WALL_HEIGHT    = 0.9;
const WALL_THICK     = 0.12;
const WALL_Y         = WALL_HEIGHT / 2;

// ── Editor State ────────────────────────────────────────────────────────────
const ES = {
  // Level metadata
  levelId:     'level1',
  levelName:   'New Level',
  stepHeight:  0.3,
  playerStart: { x: 0, z: 0 },

  // Content
  rooms:        [],
  elevatedTiles:[],
  decoratives:  [],
  lights:       [],
  portals:      [],

  // Editor mode
  tool:         'select',
  selectedKind: null,   // 'room' | 'elevated' | 'decor' | 'light' | 'spawn' | null
  selectedId:   null,

  // Draw state (room tool)
  drawing:      false,
  drawStart:    null,  // {x,z} world
  drawEnd:      null,

  // Undo stack
  undoStack:    [],
};

// ── Three.js setup ──────────────────────────────────────────────────────────
const canvas    = document.getElementById('vp-canvas');
const renderer  = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d14);

// Level geometry container — rebuilt on changes
const levelGroup = new THREE.Group();
scene.add(levelGroup);

// ── Materials ───────────────────────────────────────────────────────────────
const wireframeMat = new THREE.MeshBasicMaterial({
  color: 0x3a3a6a,
  wireframe: true,
});
const gridHelper = new THREE.GridHelper(80, 80, 0x2a2a4a, 0x1e1e34);
scene.add(gridHelper);

// Spawn marker (sphere)
const spawnGeo  = new THREE.SphereGeometry(0.25, 8, 8);
const spawnMat  = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
const spawnMesh = new THREE.Mesh(spawnGeo, spawnMat);
spawnMesh.position.set(0, 0.4, 0);
scene.add(spawnMesh);

// Selection outline (BoxHelper)
const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffcc00);
selBox.visible = false;
scene.add(selBox);

// Hover highlight plane
const hoverGeo  = new THREE.PlaneGeometry(TILE_SIZE - TILE_GAP, TILE_SIZE - TILE_GAP);
const hoverMat  = new THREE.MeshBasicMaterial({
  color: 0x00ff88, transparent: true, opacity: 0.25, depthWrite: false,
});
const hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
hoverMesh.rotation.x = -Math.PI / 2;
hoverMesh.visible = false;
scene.add(hoverMesh);

// ── Lighting ────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 40, 20);
sun.castShadow = true;
scene.add(sun);

// ── Cameras ─────────────────────────────────────────────────────────────────
// Perspective (bottom-left quadrant)
const perspCam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
perspCam.position.set(-14, 18, -14);
perspCam.lookAt(0, 0, 0);

// Top-down orthographic (top-right quadrant) — +X right, +Z north (up)
const topCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
topCam.position.set(0, 100, 0);
topCam.lookAt(0, 0, 0);
topCam.up.set(0, 0, -1);

// Front orthographic (bottom-right) — shows XY
const frontCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
frontCam.position.set(0, 10, 100);
frontCam.lookAt(0, 10, 0);

// Side orthographic (top-left) — shows ZY, +Z right
const sideCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
sideCam.position.set(-100, 10, 0);
sideCam.lookAt(0, 10, 0);

// Named viewport config
const VIEWPORTS = [
  { name: 'persp',  cam: perspCam,  corner: 'BL' },
  { name: 'top',    cam: topCam,    corner: 'TR' },
  { name: 'front',  cam: frontCam,  corner: 'BR' },
  { name: 'side',   cam: sideCam,   corner: 'TL' },
];

// Ortho cameras share a zoom level
let orthoZoom = 20; // half-size in world units

function setOrthoZoom(z) {
  orthoZoom = Math.max(4, Math.min(80, z));
  [topCam, frontCam, sideCam].forEach(c => {
    const asp = c === topCam ? _topAspect() : _sideAspect();
    c.left   = -orthoZoom * asp;
    c.right  =  orthoZoom * asp;
    c.top    =  orthoZoom;
    c.bottom = -orthoZoom;
    c.updateProjectionMatrix();
  });
}

function _topAspect() {
  const vw = canvas.clientWidth;
  const vh = canvas.clientHeight;
  return (vw / 2) / (vh / 2);
}
function _sideAspect() { return _topAspect(); }

// ── Viewport geometry helpers ───────────────────────────────────────────────
function getViewportRect(name) {
  const W = canvas.clientWidth,  H = canvas.clientHeight;
  const hw = W / 2, hh = H / 2;
  switch (name) {
    case 'persp':  return { x: 0,   y: hh,  w: hw, h: hh }; // BL
    case 'top':    return { x: hw,  y: 0,   w: hw, h: hh }; // TR
    case 'front':  return { x: hw,  y: hh,  w: hw, h: hh }; // BR
    case 'side':   return { x: 0,   y: 0,   w: hw, h: hh }; // TL
  }
}

// Returns which viewport a canvas-space point belongs to (or null)
function getViewportAtCSS(cx, cy) {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const hw = W / 2, hh = H / 2;
  if (cx < hw && cy >= hh) return 'persp';
  if (cx >= hw && cy < hh)  return 'top';
  if (cx >= hw && cy >= hh) return 'front';
  if (cx < hw && cy < hh)   return 'side';
  return null;
}

// Convert CSS mouse position to clip-space [-1,1] for a given named viewport
function toClip(name, cx, cy) {
  const r = getViewportRect(name);
  return {
    x: ((cx - r.x) / r.w) * 2 - 1,
    y: -((cy - r.y) / r.h) * 2 + 1,
  };
}

// Unproject a TOP viewport CSS click to XZ world coordinates (y=0 plane)
function topScreenToWorld(cx, cy) {
  const clip  = toClip('top', cx, cy);
  const ray   = new THREE.Raycaster();
  ray.setFromCamera(clip, topCam);
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const pt    = new THREE.Vector3();
  ray.ray.intersectPlane(plane, pt);
  return pt ? { x: pt.x, z: pt.z } : null;
}

// ── Tile map (for editor) ───────────────────────────────────────────────────
// tileMap[x][z] = { kind, roomId, elevation, walkable }
let tileMap = {};

function tmSet(x, z, data) {
  if (!tileMap[x]) tileMap[x] = {};
  tileMap[x][z] = data;
}
function tmGet(x, z) {
  return tileMap[x] ? tileMap[x][z] : undefined;
}
function tmDel(x, z) {
  if (tileMap[x]) delete tileMap[x][z];
}

// ── Rebuild level geometry from ES ─────────────────────────────────────────
let tileMeshes  = [];
let wallMeshes  = [];
let decorMeshes = [];
let lightHelpers = [];

function rebuildLevel() {
  // Clear previous geometry
  while (levelGroup.children.length > 0) {
    const obj = levelGroup.children[0];
    levelGroup.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
  }
  tileMeshes   = [];
  wallMeshes   = [];
  decorMeshes  = [];
  lightHelpers = [];
  tileMap = {};

  // Build rooms
  ES.rooms.forEach(room => {
    if (room.type === 'ramp') _buildRampRoom(room);
    else                      _buildRoom(room);
  });

  // Build elevated tiles
  ES.elevatedTiles.forEach(et => _buildElevatedTile(et));

  // Build walls
  _buildWalls();

  // Build decoratives
  ES.decoratives.forEach(d => _buildDecorMesh(d));

  // Build light helpers
  ES.lights.forEach(l => _buildLightHelper(l));

  // Spawn marker
  spawnMesh.position.set(ES.playerStart.x, 0.4, ES.playerStart.z);

  // Update selection box
  _refreshSelBox();
  _refreshLayersList();
}

// ── Room builders ───────────────────────────────────────────────────────────
function _tileMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function _placeFloorTile(x, z, elev, color, roomId) {
  const geo  = new THREE.BoxGeometry(TILE_SIZE - TILE_GAP, TILE_THICKNESS, TILE_SIZE - TILE_GAP);
  const mat  = _tileMat(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, elev - TILE_THICKNESS / 2, z);
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'tile', roomId, x, z, elevation: elev };
  levelGroup.add(mesh);
  tileMeshes.push(mesh);
  tmSet(x, z, { kind: 'tile', roomId, elevation: elev, walkable: true });
  return mesh;
}

function _randColor(palette) {
  return palette[Math.floor(Math.random() * palette.length)];
}

function _buildRoom(room) {
  const elev = room.elevation || 0;
  for (let x = room.xMin; x <= room.xMax; x++) {
    for (let z = room.zMin; z <= room.zMax; z++) {
      const c = _randColor(room.palette || [0x505050]);
      if (room.lavaCoords) {
        const isLava = room.lavaCoords.some(([lx,lz]) => lx === x && lz === z);
        if (isLava) {
          const lc = _randColor(room.lavaPalette || [0xff3300]);
          _placeFloorTile(x, z, elev, lc, room.id);
          continue;
        }
      }
      _placeFloorTile(x, z, elev, c, room.id);
    }
  }
}

function _buildRampRoom(room) {
  const axis  = room.elevationAxis || 'x';
  const steps = axis === 'z'
    ? (room.zMax - room.zMin + 1)
    : (room.xMax - room.xMin + 1);
  for (let step = 0; step < steps; step++) {
    const elev = (room.elevationStart || STEP_H) + STEP_H * step;
    const x0   = axis === 'z' ? room.xMin       : room.xMin + step;
    const x1   = axis === 'z' ? room.xMax       : x0;
    const z0   = axis === 'z' ? room.zMin + step : room.zMin;
    const z1   = axis === 'z' ? z0               : room.zMax;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const c = _randColor(room.palette || [0x707058]);
        _placeFloorTile(x, z, elev, c, room.id);
      }
    }
  }
}

function _buildElevatedTile(et) {
  // Use a tall box that goes from floor to elevation (solid cliff face)
  const geo  = new THREE.BoxGeometry(
    TILE_SIZE - TILE_GAP,
    et.elevation + TILE_THICKNESS,
    TILE_SIZE - TILE_GAP
  );
  const col  = et.type === 'platform' ? 0x3a4868 : 0x485070;
  const mat  = new THREE.MeshLambertMaterial({ color: col });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(et.x, (et.elevation + TILE_THICKNESS) / 2 - TILE_THICKNESS / 2, et.z);
  mesh.receiveShadow = true;
  mesh.castShadow    = true;
  mesh.userData = { kind: 'elevated', x: et.x, z: et.z, elevation: et.elevation, type: et.type };
  levelGroup.add(mesh);
  tileMeshes.push(mesh);
  tmSet(et.x, et.z, { kind: 'elevated', elevation: et.elevation, walkable: true });
}

// ── Wall builder ─────────────────────────────────────────────────────────────
function _buildWalls() {
  const DIRS = [
    { dx:  0, dz: -1, side: 'south', px: 0,                    pz: -0.5 + WALL_THICK/2, rx: 0,           rz: 0          },
    { dx:  0, dz:  1, side: 'north', px: 0,                    pz:  0.5 - WALL_THICK/2, rx: 0,           rz: 0          },
    { dx: -1, dz:  0, side: 'west',  px: -0.5 + WALL_THICK/2,  pz: 0,                   rx: Math.PI/2,   rz: Math.PI/2  },
    { dx:  1, dz:  0, side: 'east',  px:  0.5 - WALL_THICK/2,  pz: 0,                   rx: Math.PI/2,   rz: -Math.PI/2 },
  ];

  for (const xKey in tileMap) {
    for (const zKey in tileMap[xKey]) {
      const x    = parseInt(xKey);
      const z    = parseInt(zKey);
      const cell = tileMap[x][z];
      if (!cell) continue;
      const elev = cell.elevation || 0;

      DIRS.forEach(dir => {
        const nx   = x + dir.dx;
        const nz   = z + dir.dz;
        const nbr  = tmGet(nx, nz);
        if (nbr !== undefined) return; // neighbour exists — no wall needed
        // Find room for color
        const room = ES.rooms.find(r => {
          if (r.type === 'ramp') return false;
          return x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax;
        });
        const wallColor = room ? (room.doorColor || room.palette?.[0] || 0x505050) : 0x505050;

        const geo  = new THREE.BoxGeometry(TILE_SIZE - TILE_GAP, WALL_HEIGHT, WALL_THICK);
        const mat  = new THREE.MeshLambertMaterial({ color: wallColor });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          x + dir.px,
          elev + WALL_Y,
          z + dir.pz
        );
        if (dir.side === 'west' || dir.side === 'east') {
          mesh.rotation.y = Math.PI / 2;
        }
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        mesh.userData = { kind: 'wall' };
        levelGroup.add(mesh);
        wallMeshes.push(mesh);
      });
    }
  }
}

// ── Decorative mesh builder ──────────────────────────────────────────────────
function _buildDecorMesh(def) {
  const geo  = new THREE.BoxGeometry(def.w || 1, def.h || 1, def.d || 1);
  const mat  = new THREE.MeshLambertMaterial({ color: def.color || 0x606060 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(def.x || 0, def.y || 0.5, def.z || 0);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'decor', id: def.id, w: def.w, h: def.h, d: def.d };
  levelGroup.add(mesh);
  decorMeshes.push(mesh);
  return mesh;
}

// ── Light helper ────────────────────────────────────────────────────────────
function _buildLightHelper(def) {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 6, 6),
    new THREE.MeshBasicMaterial({ color: def.color || 0xffffff })
  );
  sphere.position.set(def.x || 0, def.y || 2, def.z || 0);
  sphere.userData = { kind: 'light', id: def.id };
  levelGroup.add(sphere);
  lightHelpers.push(sphere);

  // Wire sphere to show range
  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(def.distance || 5, 10, 6),
    new THREE.MeshBasicMaterial({ color: def.color || 0xffffff, wireframe: true, opacity: 0.12, transparent: true })
  );
  wire.position.copy(sphere.position);
  levelGroup.add(wire);
  lightHelpers.push(wire);

  return sphere;
}

// ── Selection box ────────────────────────────────────────────────────────────
function _refreshSelBox() {
  if (!ES.selectedKind || !ES.selectedId) { selBox.visible = false; return; }
  const mesh = _findMeshById(ES.selectedKind, ES.selectedId);
  if (!mesh) { selBox.visible = false; return; }
  selBox.setFromObject(mesh);
  selBox.visible = true;
}

function _findMeshById(kind, id) {
  if (kind === 'decor')  return decorMeshes.find(m => m.userData.id === id) || null;
  if (kind === 'light')  return lightHelpers.find(m => m.userData.id === id && m.userData.kind === 'light') || null;
  if (kind === 'room') {
    // Select centroid tile mesh from the room
    return tileMeshes.find(m => m.userData.roomId === id) || null;
  }
  return null;
}

// ── Camera Controls ─────────────────────────────────────────────────────────

// Perspective camera — free-fly
let perspYaw = -Math.PI * 0.75, perspPitch = -0.7;
let perspPos  = new THREE.Vector3(-14, 18, -14);
const perspKeys = {};

function _applyPerspCam() {
  const dir = new THREE.Vector3(
    Math.cos(perspPitch) * Math.sin(perspYaw),
    Math.sin(perspPitch),
    Math.cos(perspPitch) * Math.cos(perspYaw)
  );
  perspCam.position.copy(perspPos);
  perspCam.lookAt(perspPos.clone().add(dir));
}
_applyPerspCam();

// Ortho pan offsets
let topPanX = 0, topPanZ = 0;
let frontPanX = 0, frontPanY = 10;
let sidePanZ = 0, sidePanY = 10;

function _applyTopCam() {
  topCam.position.set(topPanX, 100, topPanZ);
  topCam.lookAt(topPanX, 0, topPanZ);
  topCam.up.set(0, 0, -1);
}
function _applyFrontCam() {
  frontCam.position.set(frontPanX, frontPanY, 100);
  frontCam.lookAt(frontPanX, frontPanY, 0);
}
function _applySideCam() {
  sideCam.position.set(-100, sidePanY, sidePanZ);
  sideCam.lookAt(0, sidePanY, sidePanZ);
}
_applyTopCam(); _applyFrontCam(); _applySideCam();

// ── Mouse state ─────────────────────────────────────────────────────────────
let mouseButtons = { left: false, right: false, middle: false };
let lastMouse = { x: 0, y: 0 };
let activeVP = null; // viewport name during drag

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  const cx = e.offsetX, cy = e.offsetY;
  activeVP = getViewportAtCSS(cx, cy);
  lastMouse = { x: cx, y: cy };
  if (e.button === 0) { mouseButtons.left   = true; _onLeftDown(cx, cy); }
  if (e.button === 1) { mouseButtons.middle = true; e.preventDefault(); }
  if (e.button === 2) { mouseButtons.right  = true; }
});

window.addEventListener('mouseup', e => {
  const cx = e.offsetX !== undefined ? e.offsetX : lastMouse.x;
  const cy = e.offsetY !== undefined ? e.offsetY : lastMouse.y;
  if (e.button === 0) { mouseButtons.left   = false; _onLeftUp(cx, cy); }
  if (e.button === 1) { mouseButtons.middle = false; }
  if (e.button === 2) { mouseButtons.right  = false; }
});

window.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const cx   = e.clientX - rect.left;
  const cy   = e.clientY - rect.top;
  const dx   = cx - lastMouse.x;
  const dy   = cy - lastMouse.y;
  lastMouse  = { x: cx, y: cy };

  _onMouseMove(cx, cy, dx, dy);
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const vp = getViewportAtCSS(e.offsetX, e.offsetY);
  if (vp === 'persp') {
    // Dolly forward/back
    const dir = new THREE.Vector3(
      Math.cos(perspPitch) * Math.sin(perspYaw),
      Math.sin(perspPitch),
      Math.cos(perspPitch) * Math.cos(perspYaw)
    );
    perspPos.addScaledVector(dir, -e.deltaY * 0.05);
    _applyPerspCam();
  } else {
    // Ortho zoom
    setOrthoZoom(orthoZoom + e.deltaY * 0.05);
    _applyTopCam(); _applyFrontCam(); _applySideCam();
  }
}, { passive: false });

function _onMouseMove(cx, cy, dx, dy) {
  const vp = activeVP || getViewportAtCSS(cx, cy);

  // Right-drag in persp → look
  if (mouseButtons.right && vp === 'persp') {
    perspYaw   -= dx * 0.005;
    perspPitch  = Math.max(-1.4, Math.min(1.4, perspPitch - dy * 0.005));
    _applyPerspCam();
  }

  // Middle-drag → pan the ortho camera
  if (mouseButtons.middle) {
    const panSpeed = orthoZoom / (canvas.clientWidth / 2);
    if (vp === 'top') {
      topPanX -= dx * panSpeed;
      topPanZ += dy * panSpeed;  // screen-y maps to +Z (because up = (0,0,-1))
      _applyTopCam();
    } else if (vp === 'front') {
      frontPanX -= dx * panSpeed;
      frontPanY += dy * panSpeed;
      _applyFrontCam();
    } else if (vp === 'side') {
      sidePanZ += dx * panSpeed;
      sidePanY += dy * panSpeed;
      _applySideCam();
    }
  }

  // Room draw preview
  if (mouseButtons.left && ES.tool === 'room' && ES.drawing && vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      ES.drawEnd = { x: Math.round(wp.x), z: Math.round(wp.z) };
      _updateDrawRect();
    }
  }

  // Hover highlight (top view only, tile tools)
  if (vp === 'top' && !mouseButtons.left) {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      const tx = Math.round(wp.x), tz = Math.round(wp.z);
      hoverMesh.position.set(tx, 0.01, tz);
      hoverMesh.visible = true;
    }
  } else if (vp !== 'top') {
    hoverMesh.visible = false;
  }

  // Coordinate readouts
  _updateCoordReadouts(cx, cy);
}

function _onLeftDown(cx, cy) {
  const vp = getViewportAtCSS(cx, cy);

  if (ES.tool === 'room' && vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      ES.drawing  = true;
      ES.drawStart = { x: Math.round(wp.x), z: Math.round(wp.z) };
      ES.drawEnd   = { ...ES.drawStart };
      _showDrawRect(true);
      _updateDrawRect();
    }
    return;
  }

  if (ES.tool === 'lava' && vp === 'top') {
    _toggleLavaTile(cx, cy);
    return;
  }

  if (ES.tool === 'elevated' && vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      const tx = Math.round(wp.x), tz = Math.round(wp.z);
      _openElevDialog(tx, tz);
    }
    return;
  }

  if (ES.tool === 'decor' && vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      const tx = Math.round(wp.x), tz = Math.round(wp.z);
      _placeDecor(tx, tz);
    }
    return;
  }

  if (ES.tool === 'light' && vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      const tx = Math.round(wp.x), tz = Math.round(wp.z);
      _placeLight(tx, tz);
    }
    return;
  }

  if (ES.tool === 'spawn' && vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) {
      ES.playerStart = { x: Math.round(wp.x), z: Math.round(wp.z) };
      spawnMesh.position.set(ES.playerStart.x, 0.4, ES.playerStart.z);
      document.getElementById('meta-spawnx').value = ES.playerStart.x;
      document.getElementById('meta-spawnz').value = ES.playerStart.z;
      _setStatus(`Spawn set → (${ES.playerStart.x}, ${ES.playerStart.z})`);
    }
    return;
  }

  if (ES.tool === 'select') {
    _doSelectRaycast(cx, cy, vp);
  }
}

function _onLeftUp(cx, cy) {
  if (ES.tool === 'room' && ES.drawing) {
    ES.drawing = false;
    _showDrawRect(false);
    if (ES.drawStart && ES.drawEnd) {
      const x0 = Math.min(ES.drawStart.x, ES.drawEnd.x);
      const x1 = Math.max(ES.drawStart.x, ES.drawEnd.x);
      const z0 = Math.min(ES.drawStart.z, ES.drawEnd.z);
      const z1 = Math.max(ES.drawStart.z, ES.drawEnd.z);
      if (x1 >= x0 && z1 >= z0) {
        _openRoomDialog(x0, x1, z0, z1);
      }
    }
  }
}

// ── SVG draw rect ────────────────────────────────────────────────────────────
const drawRect = document.getElementById('draw-rect');
const viewportsEl = document.getElementById('viewports');

function _showDrawRect(show) {
  drawRect.setAttribute('visibility', show ? 'visible' : 'hidden');
}

function _updateDrawRect() {
  if (!ES.drawStart || !ES.drawEnd) return;
  const x0 = Math.min(ES.drawStart.x, ES.drawEnd.x);
  const x1 = Math.max(ES.drawStart.x, ES.drawEnd.x);
  const z0 = Math.min(ES.drawStart.z, ES.drawEnd.z);
  const z1 = Math.max(ES.drawStart.z, ES.drawEnd.z);
  // Convert world corners to CSS pixels via top camera
  const corners = [
    _worldToTopCSS(x0 - 0.5, z0 - 0.5),
    _worldToTopCSS(x1 + 0.5, z1 + 0.5),
  ];
  if (!corners[0] || !corners[1]) return;
  const rx = Math.min(corners[0].x, corners[1].x);
  const ry = Math.min(corners[0].y, corners[1].y);
  const rw = Math.abs(corners[1].x - corners[0].x);
  const rh = Math.abs(corners[1].y - corners[0].y);
  drawRect.setAttribute('x', rx);
  drawRect.setAttribute('y', ry);
  drawRect.setAttribute('width',  rw);
  drawRect.setAttribute('height', rh);
}

// World (x,z) → CSS coordinates of the top viewport
function _worldToTopCSS(x, z) {
  const v = new THREE.Vector3(x, 0, z);
  v.project(topCam);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const hw = W / 2, hh = H / 2;
  // top viewport occupies top-right quadrant: x:[hw,W], y:[0,hh]
  return {
    x: hw + (v.x + 1) / 2 * hw,
    y:      (1 - v.y) / 2 * hh,
  };
}

// ── Coordinate readouts ──────────────────────────────────────────────────────
const coordTop   = document.getElementById('coord-top');
const coordFront = document.getElementById('coord-front');
const coordSide  = document.getElementById('coord-side');

function _updateCoordReadouts(cx, cy) {
  const vp = getViewportAtCSS(cx, cy);
  if (vp === 'top') {
    const wp = topScreenToWorld(cx, cy);
    if (wp) coordTop.textContent = `X ${wp.x.toFixed(1)}  Z ${wp.z.toFixed(1)}`;
  }
}

// ── Raycast select ───────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();

function _doSelectRaycast(cx, cy, vp) {
  const cam = vp === 'persp' ? perspCam
            : vp === 'top'   ? topCam
            : vp === 'front' ? frontCam
            : sideCam;
  const clip = toClip(vp, cx, cy);
  raycaster.setFromCamera(clip, cam);

  const targets = [...tileMeshes, ...decorMeshes, ...lightHelpers];
  const hits    = raycaster.intersectObjects(targets);
  if (!hits.length) {
    ES.selectedKind = null;
    ES.selectedId   = null;
    selBox.visible  = false;
    _showProps(null, null);
    _refreshLayersList();
    return;
  }
  const h = hits[0];
  const ud = h.object.userData;
  if (ud.kind === 'decor') {
    _selectDecor(ud.id);
  } else if (ud.kind === 'light') {
    _selectLight(ud.id);
  } else if (ud.kind === 'tile' || ud.kind === 'elevated') {
    // Select the room this tile belongs to
    if (ud.roomId) _selectRoom(ud.roomId);
    else if (ud.kind === 'elevated') _selectElevated(ud.x, ud.z);
  }
}

// ── Select helpers ───────────────────────────────────────────────────────────
function _selectRoom(id) {
  ES.selectedKind = 'room'; ES.selectedId = id;
  const room = ES.rooms.find(r => r.id === id);
  _showProps('room', room);
  _refreshLayersList();
  _refreshSelBox();
}
function _selectDecor(id) {
  ES.selectedKind = 'decor'; ES.selectedId = id;
  const def = ES.decoratives.find(d => d.id === id);
  _showProps('decor', def);
  _refreshLayersList();
  _refreshSelBox();
}
function _selectLight(id) {
  ES.selectedKind = 'light'; ES.selectedId = id;
  const def = ES.lights.find(l => l.id === id);
  _showProps('light', def);
  _refreshLayersList();
  _refreshSelBox();
}
function _selectElevated(x, z) {
  const key = `${x},${z}`;
  ES.selectedKind = 'elevated'; ES.selectedId = key;
  const et = ES.elevatedTiles.find(e => e.x === x && e.z === z);
  _showProps('elevated', et);
  _refreshLayersList();
  _refreshSelBox();
}

// ── Lava toggle ──────────────────────────────────────────────────────────────
function _toggleLavaTile(cx, cy) {
  const wp = topScreenToWorld(cx, cy);
  if (!wp) return;
  const tx = Math.round(wp.x), tz = Math.round(wp.z);
  // Find the room this tile belongs to
  const room = ES.rooms.find(r =>
    r.type !== 'ramp' && tx >= r.xMin && tx <= r.xMax && tz >= r.zMin && tz <= r.zMax
  );
  if (!room) { _setStatus('No room at cursor'); return; }
  if (!room.lavaCoords) room.lavaCoords = [];
  if (!room.lavaPalette) room.lavaPalette = [0xff3300, 0xff4400, 0xff5500, 0xee4400];
  const idx = room.lavaCoords.findIndex(([lx,lz]) => lx === tx && lz === tz);
  if (idx >= 0) {
    room.lavaCoords.splice(idx, 1);
    _setStatus(`Lava removed at (${tx}, ${tz})`);
  } else {
    room.lavaCoords.push([tx, tz]);
    _setStatus(`Lava painted at (${tx}, ${tz})`);
  }
  rebuildLevel();
}

// ── Place decor / light ──────────────────────────────────────────────────────
let _idCounter = 1000;
function _nextId(prefix) { return `${prefix}_${++_idCounter}`; }

function _placeDecor(x, z) {
  const id = _nextId('decor');
  ES.decoratives.push({ id, type: 'box', x, y: 0.5, z, w: 1, h: 1, d: 1, color: 0x808080, castShadow: true });
  rebuildLevel();
  _selectDecor(id);
  _setStatus(`Decor placed at (${x}, ${z})`);
}

function _placeLight(x, z) {
  const id = _nextId('light');
  ES.lights.push({ id, color: 0xffffff, intensity: 1.5, distance: 10, x, y: 2, z });
  rebuildLevel();
  _selectLight(id);
  _setStatus(`Light placed at (${x}, ${z})`);
}

// ── Property panel ───────────────────────────────────────────────────────────
const propsContent = document.getElementById('props-content');

function _showProps(kind, data) {
  if (!kind || !data) {
    propsContent.innerHTML = '<p class="hint">Nothing selected.</p>';
    return;
  }
  let html = '';
  if (kind === 'room') {
    html = `
      <div class="prop-heading">Room</div>
      ${_textRow('ID',   'pr-id',   data.id)}
      ${_textRow('Type', 'pr-type', data.type)}
      ${_numRow('xMin','pr-xmin',data.xMin)}
      ${_numRow('xMax','pr-xmax',data.xMax)}
      ${_numRow('zMin','pr-zmin',data.zMin)}
      ${_numRow('zMax','pr-zmax',data.zMax)}
      ${_numRow('Elevation','pr-elev',data.elevation||0,0.3)}
      ${_paletteRows(data)}
    `;
  } else if (kind === 'elevated') {
    html = `
      <div class="prop-heading">Elevated Tile</div>
      ${_numRow('Elevation','pe-elev',data.elevation,0.3)}
      ${_selectRow('Type','pe-type',data.type,['step','platform'])}
    `;
  } else if (kind === 'decor') {
    html = `
      <div class="prop-heading">Decorative</div>
      ${_textRow('ID','pd-id',data.id)}
      ${_numRow('X','pd-x',data.x)}
      ${_numRow('Y','pd-y',data.y)}
      ${_numRow('Z','pd-z',data.z)}
      ${_numRow('W','pd-w',data.w,0.1)}
      ${_numRow('H','pd-h',data.h,0.1)}
      ${_numRow('D','pd-d',data.d,0.1)}
      ${_colorRow('Color','pd-color',data.color)}
    `;
  } else if (kind === 'light') {
    html = `
      <div class="prop-heading">Light</div>
      ${_textRow('ID','pl-id',data.id)}
      ${_numRow('X','pl-x',data.x)}
      ${_numRow('Y','pl-y',data.y)}
      ${_numRow('Z','pl-z',data.z)}
      ${_numRow('Intensity','pl-int',data.intensity,0.1)}
      ${_numRow('Distance','pl-dist',data.distance,1)}
      ${_colorRow('Color','pl-color',data.color)}
    `;
  }
  propsContent.innerHTML = html;
  _bindPropInputs(kind, data);
}

function _textRow(label, id, val) {
  return `<div class="prop-row"><label>${label}</label><input type="text" id="${id}" value="${val || ''}"></div>`;
}
function _numRow(label, id, val, step=1) {
  return `<div class="prop-row"><label>${label}</label><input type="number" id="${id}" value="${val||0}" step="${step}"></div>`;
}
function _selectRow(label, id, val, options) {
  const opts = options.map(o => `<option value="${o}"${o===val?' selected':''}>${o}</option>`).join('');
  return `<div class="prop-row"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}
function _colorRow(label, id, val) {
  const hex = '#' + ((val || 0x808080) >>> 0).toString(16).padStart(6, '0');
  return `<div class="prop-row"><label>${label}</label><input type="color" id="${id}" value="${hex}"></div>`;
}
function _paletteRows(room) {
  if (!room.palette) return '';
  const swatches = room.palette.map((c,i) => {
    const hex = '#' + c.toString(16).padStart(6,'0');
    return `<span class="palette-swatch" style="background:${hex}" data-idx="${i}" title="${hex}">
      <span class="swatch-del">✕</span>
    </span>`;
  }).join('');
  return `<div class="prop-row palette-row">
    <label>Palette</label>
    <div class="palette-list" id="pp-palette">${swatches}</div>
    <button class="small-btn" id="pp-add-color">+ Add</button>
  </div>`;
}

function _bindPropInputs(kind, data) {
  const bind = (id, field, isNum, isColor, obj) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      let v = el.value;
      if (isColor) v = parseInt(v.replace('#',''), 16);
      else if (isNum) v = parseFloat(v);
      if (obj) obj[field] = v; else data[field] = v;
      rebuildLevel();
      _refreshSelBox();
    });
  };

  if (kind === 'room') {
    bind('pr-id',   'id',        false, false);
    bind('pr-xmin', 'xMin',      true);
    bind('pr-xmax', 'xMax',      true);
    bind('pr-zmin', 'zMin',      true);
    bind('pr-zmax', 'zMax',      true);
    bind('pr-elev', 'elevation', true);

    // Palette swatches
    const plist = document.getElementById('pp-palette');
    if (plist) {
      plist.querySelectorAll('.swatch-del').forEach(del => {
        del.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(del.parentElement.dataset.idx);
          data.palette.splice(idx, 1);
          rebuildLevel(); _showProps('room', data);
        });
      });
    }
    const addBtn = document.getElementById('pp-add-color');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        data.palette.push(0x808080);
        rebuildLevel(); _showProps('room', data);
      });
    }
  } else if (kind === 'elevated') {
    bind('pe-elev', 'elevation', true);
    bind('pe-type', 'type',      false);
  } else if (kind === 'decor') {
    bind('pd-id',    'id',    false);
    bind('pd-x',     'x',     true);
    bind('pd-y',     'y',     true);
    bind('pd-z',     'z',     true);
    bind('pd-w',     'w',     true);
    bind('pd-h',     'h',     true);
    bind('pd-d',     'd',     true);
    bind('pd-color', 'color', false, true);
  } else if (kind === 'light') {
    bind('pl-id',   'id',        false);
    bind('pl-x',    'x',         true);
    bind('pl-y',    'y',         true);
    bind('pl-z',    'z',         true);
    bind('pl-int',  'intensity', true);
    bind('pl-dist', 'distance',  true);
    bind('pl-color','color',     false, true);
  }
}

// ── Layers list ──────────────────────────────────────────────────────────────
const layersList = document.getElementById('layers-list');

function _refreshLayersList() {
  const rows = [];
  ES.rooms.forEach(r => {
    const sel = ES.selectedKind === 'room' && ES.selectedId === r.id;
    rows.push(`<div class="layer-item${sel?' selected':''}" data-kind="room" data-id="${r.id}">
      <span class="layer-icon">▣</span>
      <span class="layer-name">${r.id}</span>
      <span class="layer-kind">${r.type}</span>
    </div>`);
  });
  ES.elevatedTiles.forEach(et => {
    const key = `${et.x},${et.z}`;
    const sel = ES.selectedKind === 'elevated' && ES.selectedId === key;
    rows.push(`<div class="layer-item${sel?' selected':''}" data-kind="elevated" data-x="${et.x}" data-z="${et.z}">
      <span class="layer-icon">▲</span>
      <span class="layer-name">(${et.x},${et.z})</span>
      <span class="layer-kind">${et.type}</span>
    </div>`);
  });
  ES.decoratives.forEach(d => {
    const sel = ES.selectedKind === 'decor' && ES.selectedId === d.id;
    rows.push(`<div class="layer-item${sel?' selected':''}" data-kind="decor" data-id="${d.id}">
      <span class="layer-icon">□</span>
      <span class="layer-name">${d.id}</span>
      <span class="layer-kind">decor</span>
    </div>`);
  });
  ES.lights.forEach(l => {
    const sel = ES.selectedKind === 'light' && ES.selectedId === l.id;
    rows.push(`<div class="layer-item${sel?' selected':''}" data-kind="light" data-id="${l.id}">
      <span class="layer-icon">✦</span>
      <span class="layer-name">${l.id}</span>
      <span class="layer-kind">light</span>
    </div>`);
  });

  layersList.innerHTML = rows.join('');
  layersList.querySelectorAll('.layer-item').forEach(el => {
    el.addEventListener('click', () => {
      const kind = el.dataset.kind;
      if (kind === 'room')     _selectRoom(el.dataset.id);
      else if (kind === 'decor') _selectDecor(el.dataset.id);
      else if (kind === 'light') _selectLight(el.dataset.id);
      else if (kind === 'elevated') {
        _selectElevated(parseInt(el.dataset.x), parseInt(el.dataset.z));
      }
    });
  });
}

// ── Status bar ───────────────────────────────────────────────────────────────
function _setStatus(msg) {
  document.getElementById('status-text').textContent = msg;
}

// ── Tool switching ───────────────────────────────────────────────────────────
document.getElementById('tool-buttons').querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ES.tool = btn.dataset.tool;
    _setStatus(_toolHint(ES.tool));
    canvas.style.cursor = ES.tool === 'select' ? 'default' : 'crosshair';
  });
});

function _toolHint(tool) {
  return {
    select:   'Select — click any object to select it',
    room:     'Room — drag in the TOP view to define bounds',
    elevated: 'Elevated — click a tile in TOP view',
    lava:     'Lava — click to toggle lava on tiles',
    decor:    'Decor — click in TOP view to place a box',
    light:    'Light — click in TOP view to place a light',
    spawn:    'Spawn — click in TOP view to set player start',
  }[tool] || tool;
}

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const map = { s:'select', r:'room', e:'elevated', v:'lava', d:'decor', l:'light', p:'spawn' };
  if (map[e.key.toLowerCase()]) {
    document.querySelector(`[data-tool="${map[e.key.toLowerCase()]}"]`)?.click();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    _deleteSelected();
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    _undo();
  }

  // WASD move perspective camera
  const speed = 0.4;
  const dir = new THREE.Vector3(
    Math.cos(perspPitch) * Math.sin(perspYaw),
    0,
    Math.cos(perspPitch) * Math.cos(perspYaw)
  ).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
  if (e.key.toLowerCase() === 'w') perspPos.addScaledVector(dir, speed);
  if (e.key.toLowerCase() === 's') perspPos.addScaledVector(dir, -speed);
  if (e.key.toLowerCase() === 'a') perspPos.addScaledVector(right, -speed);
  if (e.key.toLowerCase() === 'd') perspPos.addScaledVector(right, speed);
  if (e.key === 'q') perspPos.y -= speed;
  if (e.key === 'e') perspPos.y += speed;
  _applyPerspCam();
});

// ── Delete / Undo ─────────────────────────────────────────────────────────────
function _deleteSelected() {
  const { selectedKind: k, selectedId: id } = ES;
  if (!k || !id) return;
  _pushUndo();
  if (k === 'room') {
    ES.rooms = ES.rooms.filter(r => r.id !== id);
  } else if (k === 'decor') {
    ES.decoratives = ES.decoratives.filter(d => d.id !== id);
  } else if (k === 'light') {
    ES.lights = ES.lights.filter(l => l.id !== id);
  } else if (k === 'elevated') {
    const [x,z] = id.split(',').map(Number);
    ES.elevatedTiles = ES.elevatedTiles.filter(et => !(et.x===x && et.z===z));
  }
  ES.selectedKind = null; ES.selectedId = null;
  rebuildLevel();
  _showProps(null, null);
}

function _pushUndo() {
  ES.undoStack.push(JSON.stringify({
    rooms: ES.rooms,
    elevatedTiles: ES.elevatedTiles,
    decoratives: ES.decoratives,
    lights: ES.lights,
    portals: ES.portals,
    playerStart: ES.playerStart,
  }));
  if (ES.undoStack.length > 50) ES.undoStack.shift();
}

function _undo() {
  if (!ES.undoStack.length) return;
  const snap = JSON.parse(ES.undoStack.pop());
  Object.assign(ES, snap);
  ES.selectedKind = null; ES.selectedId = null;
  rebuildLevel();
  _showProps(null, null);
  _setStatus('Undo');
}

// Duplicate selected
document.getElementById('btn-dup-obj').addEventListener('click', () => {
  const { selectedKind: k, selectedId: id } = ES;
  if (!k || !id) return;
  _pushUndo();
  if (k === 'room') {
    const room = JSON.parse(JSON.stringify(ES.rooms.find(r => r.id === id)));
    if (!room) return;
    room.id = _nextId('room');
    room.xMin += 2; room.xMax += 2;
    ES.rooms.push(room);
    rebuildLevel(); _selectRoom(room.id);
  } else if (k === 'decor') {
    const def = JSON.parse(JSON.stringify(ES.decoratives.find(d => d.id === id)));
    if (!def) return;
    def.id = _nextId('decor');
    def.x += 2;
    ES.decoratives.push(def);
    rebuildLevel(); _selectDecor(def.id);
  } else if (k === 'light') {
    const def = JSON.parse(JSON.stringify(ES.lights.find(l => l.id === id)));
    if (!def) return;
    def.id = _nextId('light');
    def.x += 2;
    ES.lights.push(def);
    rebuildLevel(); _selectLight(def.id);
  }
});

document.getElementById('btn-del-obj').addEventListener('click', _deleteSelected);

// ── Room creation dialog ─────────────────────────────────────────────────────
const roomDialog   = document.getElementById('room-dialog');
const rdType       = document.getElementById('rd-type');
const rdRampOpts   = document.getElementById('rd-ramp-opts');
const rdCorridorOpts = document.getElementById('rd-corridor-opts');

rdType.addEventListener('change', () => {
  rdRampOpts.classList.toggle('hidden',     rdType.value !== 'ramp');
  rdCorridorOpts.classList.toggle('hidden', rdType.value !== 'corridor');
});

let _pendingRoomBounds = null;

function _openRoomDialog(x0, x1, z0, z1) {
  _pendingRoomBounds = { x0, x1, z0, z1 };
  document.getElementById('rd-bounds-text').textContent =
    `X ${x0}→${x1}  Z ${z0}→${z1}`;
  document.getElementById('rd-id').value = _nextId('room');
  roomDialog.classList.remove('hidden');
}

document.getElementById('rd-cancel').addEventListener('click', () => {
  roomDialog.classList.add('hidden');
  _pendingRoomBounds = null;
});

document.getElementById('rd-create').addEventListener('click', () => {
  if (!_pendingRoomBounds) return;
  const { x0, x1, z0, z1 } = _pendingRoomBounds;
  const type = rdType.value;
  const room = {
    id:       document.getElementById('rd-id').value || _nextId('room'),
    type,
    tileType: document.getElementById('rd-tiletype').value || type,
    xMin: x0, xMax: x1, zMin: z0, zMax: z1,
    elevation: parseFloat(document.getElementById('rd-elevation').value) || 0,
    palette:  _getRdPalette(),
  };
  if (type === 'corridor') {
    room.doorColor = parseInt(document.getElementById('rd-doorcolor').value.replace('#',''), 16);
  }
  if (type === 'ramp') {
    room.elevationAxis  = document.getElementById('rd-rampaxis').value;
    room.elevationStart = parseFloat(document.getElementById('rd-rampstart').value) || 0.3;
  }
  _pushUndo();
  ES.rooms.push(room);
  rebuildLevel();
  _selectRoom(room.id);
  roomDialog.classList.add('hidden');
  _pendingRoomBounds = null;
  _setStatus(`Room "${room.id}" created`);
});

// Palette editor inside room dialog
const rdPaletteList = document.getElementById('rd-palette-list');
let _rdPalette = [0x505060, 0x585868, 0x4a4a5a];

function _renderRdPalette() {
  rdPaletteList.innerHTML = _rdPalette.map((c,i) => {
    const hex = '#' + c.toString(16).padStart(6,'0');
    return `<span class="palette-swatch" style="background:${hex}" data-idx="${i}">
      <span class="swatch-del">✕</span>
    </span>`;
  }).join('');
  rdPaletteList.querySelectorAll('.swatch-del').forEach(del => {
    del.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(del.parentElement.dataset.idx);
      _rdPalette.splice(idx, 1);
      _renderRdPalette();
    });
  });
}
_renderRdPalette();

document.getElementById('rd-add-color').addEventListener('click', () => {
  _rdPalette.push(0x808080);
  _renderRdPalette();
});

function _getRdPalette() {
  return [..._rdPalette];
}

// ── Elevated tile dialog ─────────────────────────────────────────────────────
const elevDialog = document.getElementById('elev-dialog');
let _pendingElevCoord = null;

function _openElevDialog(x, z) {
  _pendingElevCoord = { x, z };
  elevDialog.classList.remove('hidden');
}

document.getElementById('ed-cancel').addEventListener('click', () => {
  elevDialog.classList.add('hidden');
  _pendingElevCoord = null;
});

document.getElementById('ed-ok').addEventListener('click', () => {
  if (!_pendingElevCoord) return;
  const { x, z } = _pendingElevCoord;
  const elev = parseFloat(document.getElementById('ed-elev').value) || 0.3;
  const type = document.getElementById('ed-type').value;
  // Remove any existing elevated tile at this coord
  ES.elevatedTiles = ES.elevatedTiles.filter(et => !(et.x === x && et.z === z));
  _pushUndo();
  ES.elevatedTiles.push({ x, z, elevation: elev, type });
  rebuildLevel();
  _selectElevated(x, z);
  elevDialog.classList.add('hidden');
  _pendingElevCoord = null;
  _setStatus(`Elevated tile at (${x}, ${z}) elevation=${elev}`);
});

// ── Level metadata inputs ────────────────────────────────────────────────────
document.getElementById('meta-name').addEventListener('change', e => {
  ES.levelName = e.target.value;
});
document.getElementById('meta-id').addEventListener('change', e => {
  ES.levelId = e.target.value;
});
document.getElementById('meta-steph').addEventListener('change', e => {
  ES.stepHeight = parseFloat(e.target.value) || 0.3;
});
document.getElementById('meta-spawnx').addEventListener('change', e => {
  ES.playerStart.x = parseInt(e.target.value) || 0;
  spawnMesh.position.setX(ES.playerStart.x);
});
document.getElementById('meta-spawnz').addEventListener('change', e => {
  ES.playerStart.z = parseInt(e.target.value) || 0;
  spawnMesh.position.setZ(ES.playerStart.z);
});

// ── Export ───────────────────────────────────────────────────────────────────
function _serializeLevel() {
  const d = {
    id:          ES.levelId,
    name:        ES.levelName,
    stepHeight:  ES.stepHeight,
    playerStart: { x: ES.playerStart.x, z: ES.playerStart.z },
    rooms:       ES.rooms,
    elevatedTiles: ES.elevatedTiles,
    decoratives: ES.decoratives,
    lights:      ES.lights,
    portals:     ES.portals,
  };
  const lines = [
    `// ─── ${d.name} ───────────────────────────────────────────────────────────────`,
    `(function () {`,
    `  window.LEVELS = window.LEVELS || {};`,
    `  window.LEVELS[${JSON.stringify(d.id)}] = ${JSON.stringify(d, null, 2)};`,
    `}());`,
  ];
  return lines.join('\n');
}

document.getElementById('btn-export').addEventListener('click', () => {
  const txt = _serializeLevel();
  document.getElementById('export-text').value = txt;
  document.getElementById('export-modal').classList.remove('hidden');
});

document.getElementById('btn-copy-export').addEventListener('click', () => {
  const ta = document.getElementById('export-text');
  ta.select();
  document.execCommand('copy');
  _setStatus('Copied to clipboard');
});

document.getElementById('btn-dl-export').addEventListener('click', () => {
  const txt = document.getElementById('export-text').value;
  const blob = new Blob([txt], { type: 'text/javascript' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = ES.levelId + '.js';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-close-export').addEventListener('click', () => {
  document.getElementById('export-modal').classList.add('hidden');
});

// ── Import ───────────────────────────────────────────────────────────────────
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-modal').classList.remove('hidden');
});
document.getElementById('btn-cancel-import').addEventListener('click', () => {
  document.getElementById('import-modal').classList.add('hidden');
});
document.getElementById('btn-do-import').addEventListener('click', () => {
  const code = document.getElementById('import-text').value.trim();
  if (!code) return;
  try {
    // Execute in isolated scope
    const backup = window.LEVELS;
    window.LEVELS = {};
    // eslint-disable-next-line no-new-func
    new Function(code)();
    const keys = Object.keys(window.LEVELS);
    if (!keys.length) throw new Error('No LEVELS found in pasted code');
    const lvl = window.LEVELS[keys[0]];
    _loadFromLevelData(lvl);
    window.LEVELS = backup;
    document.getElementById('import-modal').classList.add('hidden');
    _setStatus(`Imported level "${lvl.name || lvl.id}"`);
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

function _loadFromLevelData(lvl) {
  ES.levelId     = lvl.id     || 'level1';
  ES.levelName   = lvl.name   || 'Imported';
  ES.stepHeight  = lvl.stepHeight || 0.3;
  ES.playerStart = lvl.playerStart || { x: 0, z: 0 };
  ES.rooms       = lvl.rooms       || [];
  ES.elevatedTiles = lvl.elevatedTiles || [];
  ES.decoratives = lvl.decoratives || [];
  ES.lights      = lvl.lights      || [];
  ES.portals     = lvl.portals     || [];
  ES.selectedKind = null; ES.selectedId = null;

  document.getElementById('meta-name').value   = ES.levelName;
  document.getElementById('meta-id').value     = ES.levelId;
  document.getElementById('meta-steph').value  = ES.stepHeight;
  document.getElementById('meta-spawnx').value = ES.playerStart.x;
  document.getElementById('meta-spawnz').value = ES.playerStart.z;

  rebuildLevel();
  _showProps(null, null);
}

// ── Load level1 preset ───────────────────────────────────────────────────────
document.getElementById('btn-load-lvl1').addEventListener('click', () => {
  if (!window.LEVELS || !window.LEVELS.level1) {
    _setStatus('level1.js not loaded');
    return;
  }
  _loadFromLevelData(window.LEVELS.level1);
  _setStatus('Loaded level1');
});

// ── New level ────────────────────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', () => {
  if (!confirm('Clear current level and start fresh?')) return;
  ES.levelId   = 'level_new';
  ES.levelName = 'New Level';
  ES.stepHeight = 0.3;
  ES.playerStart = { x: 0, z: 0 };
  ES.rooms = []; ES.elevatedTiles = []; ES.decoratives = []; ES.lights = []; ES.portals = [];
  ES.selectedKind = null; ES.selectedId = null;
  document.getElementById('meta-name').value   = ES.levelName;
  document.getElementById('meta-id').value     = ES.levelId;
  document.getElementById('meta-spawnx').value = 0;
  document.getElementById('meta-spawnz').value = 0;
  rebuildLevel();
  _showProps(null, null);
  _setStatus('New level');
});

// ── Render loop ──────────────────────────────────────────────────────────────
function _resize() {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  renderer.setSize(W, H, false);
  perspCam.aspect = (W / 2) / (H / 2);
  perspCam.updateProjectionMatrix();
  setOrthoZoom(orthoZoom); // recalc ortho aspect
  _applyTopCam(); _applyFrontCam(); _applySideCam();
}

new ResizeObserver(_resize).observe(canvas.parentElement);
_resize();

function _renderViewport(vp, useLive) {
  const r  = getViewportRect(vp.name);
  const W  = canvas.clientWidth, H = canvas.clientHeight;
  // Three.js setViewport/setScissor use bottom-left origin, but our rects are top-left
  const bl_y = H - r.y - r.h;
  renderer.setViewport(r.x, bl_y, r.w, r.h);
  renderer.setScissor( r.x, bl_y, r.w, r.h);
  renderer.setScissorTest(true);

  if (!useLive) {
    scene.overrideMaterial = wireframeMat;
  } else {
    scene.overrideMaterial = null;
  }
  renderer.render(scene, vp.cam);
}

function animate() {
  requestAnimationFrame(animate);

  // Perspective (live materials) — bottom-left
  _renderViewport({ name: 'persp', cam: perspCam }, true);
  // Top (wireframe) — top-right
  _renderViewport({ name: 'top',   cam: topCam   }, false);
  // Front (wireframe) — bottom-right
  _renderViewport({ name: 'front', cam: frontCam }, false);
  // Side (wireframe) — top-left
  _renderViewport({ name: 'side',  cam: sideCam  }, false);

  scene.overrideMaterial = null;
  renderer.setScissorTest(false);
}
animate();

// ── Initial state ─────────────────────────────────────────────────────────────
_setStatus('Ready — use Room tool to draw in the TOP view (top-right)');
rebuildLevel();

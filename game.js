'use strict';

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.FogExp2(0x0d1117, 0.032);

// ─── Constants (fixed) ────────────────────────────────────────────────────────
const CAM_HEIGHT        = 18;
const CAM_RADIUS        = 18 * Math.SQRT2;
const DEFAULT_CAM_ANGLE = Math.PI / 4;
const GRID_HALF         = 8;
const TILE_THICKNESS    = 0.22;
const TILE_GAP          = 0.06;
const PLAYER_SIZE       = 0.65;

// ─── Tunable game settings (adjustable via the settings menu) ─────────────────
let viewSize            = 10;     // orthographic frustum half-size
let moveDelay           = 0.13;   // seconds between tile steps
let jumpSpeed           = 7.5;    // initial upward velocity
let gravity             = 22;     // downward acceleration
let camFollowSpeed      = 8;      // camera position lerp rate
let cornerSlidingEnabled  = true;  // auto-slide along obstacles
let hoverRaycastEnabled   = true;  // mouse hover raycast + tile highlight
let debugRayEnabled       = false; // draw the raycast ray + list all hits
let clickToMoveEnabled    = true;  // left-click to pathfind to a tile
let showPathViz           = true;  // show planned path in red
let showDestViz           = true;  // show target tile in green
let showExploreViz        = true;  // show A* explored tiles in blue
let pathfindDelay         = 30;    // ms pause between each A* step (0 = instant)

// Default values — used by the settings menu reset buttons
const DEFAULTS = {
  viewSize:        10,
  moveDelay:       130,   // stored as ms for the UI (game uses seconds)
  jumpSpeed:       7.5,
  gravity:         22,
  camFollowSpeed:  8,
  fogDensity:      0.032,
  cornerSliding:   true,
  showFps:         true,
  showCompass:     true,
  showRay:         true,
  showAxes:        false,
  hoverRaycast:    true,
  debugRay:        false,
  clickToMove:     true,
  showPathViz:     true,
  showDestViz:     true,
  showExploreViz:  true,
  pathDelay:       30,
};

// ─── Camera ───────────────────────────────────────────────────────────────────
let aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -viewSize * aspect, viewSize * aspect,
   viewSize,         -viewSize,
  0.1, 500
);
camera.position.set(CAM_HEIGHT, CAM_HEIGHT, CAM_HEIGHT);
camera.lookAt(0, 0, 0);

let cameraRotStep   = 0;
let targetCamAngle  = DEFAULT_CAM_ANGLE;
let currentCamAngle = DEFAULT_CAM_ANGLE;

// Camera pan state — right-click drag moves the focus point; X resets it
let camFocusX = 0;   // world X the camera orbits around (0 = follow player)
let camFocusZ = 0;   // world Z the camera orbits around
let isPanMode = false;        // true once the camera has been dragged away
let isRightDragging = false;  // true while right mouse button is held
let lastDragX = 0, lastDragY = 0;

// ─── Renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x8090b0, 1.0));

const sun = new THREE.DirectionalLight(0xffe8c0, 1.4);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left   = -35;
sun.shadow.camera.right  =  35;
sun.shadow.camera.top    =  35;
sun.shadow.camera.bottom = -35;
sun.shadow.camera.near   =  0.5;
sun.shadow.camera.far    =  100;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x4060a0, 0.3);
fillLight.position.set(-10, 8, -10);
scene.add(fillLight);

// Lava area warm point light — pulsed in the animation loop
const lavaLight = new THREE.PointLight(0xff5500, 2.0, 10);
lavaLight.position.set(6, 1.5, 6);
scene.add(lavaLight);

// ─── Tile Map ─────────────────────────────────────────────────────────────────
//
// tileMap[x][z] = {
//   walkable : boolean  — false blocks all movement onto this tile
//   type     : string   — 'stone' | 'lava'
//   mesh     : THREE.Mesh
// }
//
const tileMap = {};

const STONE_COLORS = [
  0x52525c, 0x4a4a58, 0x585862, 0x4e4e5a,
  0x545460, 0x5e5e68, 0x484852, 0x56565e,
  0x606068, 0x4c4c56,
];

const LAVA_COLORS = [
  0xff3300, 0xff4400, 0xff5500, 0xff6600,
  0xff8800, 0xffaa00, 0xdd2200, 0xee4400,
];

// Lava blob — a hand-placed cluster in the positive corner of the grid.
// All lava tiles have walkable: false.
const LAVA_COORDS = new Set([
                  '5,3', '6,3',
        '4,4',   '5,4', '6,4', '7,4',
'3,5',  '4,5',   '5,5', '6,5', '7,5',
        '4,6',   '5,6', '6,6', '7,6',
                  '5,7', '6,7', '7,7',
]);

// ─── Multi-room layout ────────────────────────────────────────────────────────
//   Room 1   — existing 17×17 grid,   x: −8..8,  z: −8..8
//   Corridor — 3 tiles wide, 5 deep,  x: −1..1,  z:  9..13
//   Room 2   — 11×11 grid,            x: −5..5,  z: 14..24
//
const ROOM2_X_MIN = -5, ROOM2_X_MAX = 5;
const ROOM2_Z_MIN = 14, ROOM2_Z_MAX = 24;
const CORR_X_MIN  = -1, CORR_X_MAX  = 1;
const CORR_Z_MIN  =  9, CORR_Z_MAX  = 13;

const ROOM2_COLORS = [
  0x374258, 0x2e3a55, 0x3a4260, 0x2c3850,
  0x404560, 0x363e58, 0x344060, 0x3c4055,
];
const DOOR_COLOR = 0x6a6040;   // warm threshold tiles at corridor ends

// ─── Dais (raised platform) in Room 2 ────────────────────────────────────────
// Layout inside Room 2 (x: −5..5, z: 14..24):
//   Stairs north  x: −1..1,  z: 15..16  (2 steps ascending into Room 2)
//   Platform      x: −2..2,  z: 17..21  (elevation 0.9)
//   Stairs south  x: −1..1,  z: 22..23  (2 steps descending)
//
const _STEP_H = 0.3;   // height per stair step (and platform = 3 × _STEP_H)

const DAIS_ELEVATIONS = {};   // "x,z" → world-Y of tile top surface
// North stairs
for (let x = -1; x <= 1; x++) {
  DAIS_ELEVATIONS[`${x},15`] = _STEP_H;
  DAIS_ELEVATIONS[`${x},16`] = _STEP_H * 2;
}
// Platform
for (let x = -2; x <= 2; x++) {
  for (let z = 17; z <= 21; z++) {
    DAIS_ELEVATIONS[`${x},${z}`] = _STEP_H * 3;
  }
}
// South stairs
for (let x = -1; x <= 1; x++) {
  DAIS_ELEVATIONS[`${x},22`] = _STEP_H * 2;
  DAIS_ELEVATIONS[`${x},23`] = _STEP_H;
}

// Only allow movement between tiles whose top surfaces differ by at most one step
const MAX_STEP_HEIGHT = _STEP_H + 0.02;

const DAIS_STEP_COLORS = [0x485070, 0x455068, 0x4a5272];
const DAIS_PLAT_COLORS = [0x3a4868, 0x384562, 0x3c4a6c];

// Cache BoxGeometry per distinct elevation so we don't recreate identical geometry
const _daisGeomCache = {};
function _getDaisGeom(elev) {
  if (!_daisGeomCache[elev]) {
    // Height fills from y = −TILE_THICKNESS/2 (below ground) up to y = elev (top surface)
    _daisGeomCache[elev] = new THREE.BoxGeometry(1 - TILE_GAP, elev + TILE_THICKNESS, 1 - TILE_GAP);
  }
  return _daisGeomCache[elev];
}

// Wall config — walls are generated on every walkable-tile edge bordering empty space
const WALL_HEIGHT    = 0.9;
const WALL_FADE_NEAR = 2.5;   // distance (world units) where walls begin fading
const WALL_FADE_FAR  = 4.5;   // distance where walls are fully opaque
const WALL_MIN_OPC   = 0.12;  // minimum opacity when player is right at a wall

const wallData = [];           // { mesh, x, z } — filled at build time, read each frame

const tileGeom  = new THREE.BoxGeometry(1 - TILE_GAP, TILE_THICKNESS, 1 - TILE_GAP);
const tileMeshes = [];  // flat list used by the hover raycaster

for (let x = -GRID_HALF; x <= GRID_HALF; x++) {
  tileMap[x] = {};
  for (let z = -GRID_HALF; z <= GRID_HALF; z++) {
    const isLava = LAVA_COORDS.has(`${x},${z}`);

    const color = isLava
      ? LAVA_COLORS[Math.floor(Math.random() * LAVA_COLORS.length)]
      : STONE_COLORS[Math.floor(Math.random() * STONE_COLORS.length)];

    const mat = new THREE.MeshLambertMaterial({ color });
    if (isLava) {
      // Lava tiles emit a warm glow
      mat.emissive.setHex(0x441100);
      mat.emissiveIntensity = 0.6;
    }

    const tile = new THREE.Mesh(tileGeom, mat);
    tile.position.set(x, -TILE_THICKNESS / 2, z);
    tile.receiveShadow = !isLava;
    scene.add(tile);
    tileMeshes.push(tile);

    tileMap[x][z] = {
      walkable : !isLava,   // ← metadata: lava tiles block movement
      type     : isLava ? 'lava' : 'stone',
      mesh     : tile,
    };
  }
}

// ─── Corridor tiles ──────────────────────────────────────────────────────────
for (let x = CORR_X_MIN; x <= CORR_X_MAX; x++) {
  if (!tileMap[x]) tileMap[x] = {};
  for (let z = CORR_Z_MIN; z <= CORR_Z_MAX; z++) {
    const isDoor = (z === CORR_Z_MIN || z === CORR_Z_MAX);
    const color  = isDoor
      ? DOOR_COLOR
      : STONE_COLORS[Math.floor(Math.random() * STONE_COLORS.length)];
    const mat = new THREE.MeshLambertMaterial({ color });
    if (isDoor) { mat.emissive.setHex(0x151005); mat.emissiveIntensity = 0.5; }
    const tile = new THREE.Mesh(tileGeom, mat);
    tile.position.set(x, -TILE_THICKNESS / 2, z);
    tile.receiveShadow = true;
    scene.add(tile);
    tileMeshes.push(tile);
    tileMap[x][z] = { walkable: true, type: isDoor ? 'door' : 'stone', mesh: tile };
  }
}

// ─── Room 2 tiles ─────────────────────────────────────────────────────────────
// Dais tiles are skipped here and generated separately with elevation geometry.
for (let x = ROOM2_X_MIN; x <= ROOM2_X_MAX; x++) {
  if (!tileMap[x]) tileMap[x] = {};
  for (let z = ROOM2_Z_MIN; z <= ROOM2_Z_MAX; z++) {
    if (DAIS_ELEVATIONS[`${x},${z}`] !== undefined) continue;   // handled below
    const color = ROOM2_COLORS[Math.floor(Math.random() * ROOM2_COLORS.length)];
    const mat   = new THREE.MeshLambertMaterial({ color });
    const tile  = new THREE.Mesh(tileGeom, mat);
    tile.position.set(x, -TILE_THICKNESS / 2, z);
    tile.receiveShadow = true;
    scene.add(tile);
    tileMeshes.push(tile);
    tileMap[x][z] = { walkable: true, type: 'stone2', mesh: tile };
  }
}

// ─── Dais tiles (elevated stair + platform geometry) ─────────────────────────
for (const [key, elev] of Object.entries(DAIS_ELEVATIONS)) {
  const [x, z] = key.split(',').map(Number);
  const isPlatform = elev >= _STEP_H * 3 - 0.01;
  const palette    = isPlatform ? DAIS_PLAT_COLORS : DAIS_STEP_COLORS;
  const color      = palette[Math.floor(Math.random() * palette.length)];
  const mat        = new THREE.MeshLambertMaterial({ color });
  const geom       = _getDaisGeom(elev);
  const tile       = new THREE.Mesh(geom, mat);
  // Center Y: bottom = −TILE_THICKNESS/2, top = elev
  tile.position.set(x, (elev - TILE_THICKNESS) / 2, z);
  tile.receiveShadow = true;
  scene.add(tile);
  tileMeshes.push(tile);
  if (!tileMap[x]) tileMap[x] = {};
  tileMap[x][z] = { walkable: true, type: isPlatform ? 'platform' : 'step',
                    elevation: elev, mesh: tile };
}

// ─── Altar ────────────────────────────────────────────────────────────────────
// A dark stone slab resting at the centre of the dais platform.
const altarMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.45, 0.85),
  new THREE.MeshLambertMaterial({ color: 0x2a2a2a, emissive: 0x111111, emissiveIntensity: 0.3 })
);
altarMesh.position.set(0, _STEP_H * 3 + 0.225, 19);
altarMesh.castShadow = true;
scene.add(altarMesh);

// The altar occupies tile (0,19) — mark it unwalkable so hover and pathfinding
// don't treat the space under the slab as navigable.
if (tileMap[0]?.[19]) tileMap[0][19].walkable = false;

// Soft blue-purple ambient light hovering above the altar — pulsed in animate()
const daisLight = new THREE.PointLight(0x7070ff, 1.5, 10);
daisLight.position.set(0, _STEP_H * 3 + 2.2, 19);
scene.add(daisLight);

// ─── Walls ────────────────────────────────────────────────────────────────────
// For every walkable tile, check each of the 4 cardinal neighbours. If there is
// no tile there at all (undefined in tileMap) place a wall segment on that edge.
// Tiles adjacent to lava (which has its own visible floor mesh) are skipped
// naturally because lava cells ARE defined in tileMap.
//
const wallGeomNS = new THREE.BoxGeometry(1 - TILE_GAP, WALL_HEIGHT, 0.1);
const wallGeomEW = new THREE.BoxGeometry(0.1, WALL_HEIGHT, 1 - TILE_GAP);
const _WALL_DIRS = [
  { dx:  0, dz: -1, geom: wallGeomNS, ox:  0,    oz: -0.5 },  // North
  { dx:  0, dz:  1, geom: wallGeomNS, ox:  0,    oz:  0.5 },  // South
  { dx: -1, dz:  0, geom: wallGeomEW, ox: -0.5,  oz:  0   },  // West
  { dx:  1, dz:  0, geom: wallGeomEW, ox:  0.5,  oz:  0   },  // East
];

for (const xStr of Object.keys(tileMap)) {
  const x = Number(xStr);
  for (const zStr of Object.keys(tileMap[x])) {
    const z = Number(zStr);
    if (!tileMap[x][z].walkable) continue;
    for (const dir of _WALL_DIRS) {
      const nx = x + dir.dx, nz = z + dir.dz;
      if (tileMap[nx]?.[nz] !== undefined) continue;   // neighbour tile exists — no wall
      const wallMat = new THREE.MeshLambertMaterial({
        color: 0x58606e, transparent: true, opacity: 1.0,
      });
      const wall = new THREE.Mesh(dir.geom, wallMat);
      wall.position.set(x + dir.ox, WALL_HEIGHT / 2, z + dir.oz);
      wall.castShadow = true;
      scene.add(wall);
      wallData.push({ mesh: wall, x: x + dir.ox, z: z + dir.oz });
    }
  }
}

// ─── Door pillars ─────────────────────────────────────────────────────────────
// Decorative stone columns flank each end of the corridor, marking the
// transitions between rooms. Two pillars per opening = four total.
const pillarGeom = new THREE.BoxGeometry(0.28, 1.8, 0.28);
const pillarMat  = new THREE.MeshLambertMaterial({ color: 0x706858 });
[
  [-1.5,  8.5], [1.5,  8.5],   // Room 1 → Corridor
  [-1.5, 13.5], [1.5, 13.5],   // Corridor → Room 2
].forEach(([px, pz]) => {
  const pillar = new THREE.Mesh(pillarGeom, pillarMat);
  pillar.position.set(px, 0.9, pz);
  pillar.castShadow = true;
  scene.add(pillar);
});

// ─── Player ───────────────────────────────────────────────────────────────────
const playerMesh = new THREE.Mesh(
  new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
  new THREE.MeshLambertMaterial({ color: 0x4a8fe2 })
);
playerMesh.castShadow = true;
playerMesh.position.set(0, PLAYER_SIZE / 2, 0);
scene.add(playerMesh);

// Small white eye shows the player's facing direction
const eyeMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.16, 0.08),
  new THREE.MeshLambertMaterial({ color: 0xeef0ff })
);
eyeMesh.position.set(0, 0.06, -(PLAYER_SIZE / 2 + 0.02));
playerMesh.add(eyeMesh);

// Red ray projected from the eye in the player's local forward (−Z) direction.
// Attached to playerMesh so it rotates with the player automatically.
const rayArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 0.06, -(PLAYER_SIZE / 2 + 0.02)),
  12,       // length
  0xff2222,
  0.4,      // head length
  0.14      // head width
);
playerMesh.add(rayArrow);

// Soft drop shadow that scales / fades while jumping
const shadowBlob = new THREE.Mesh(
  new THREE.PlaneGeometry(0.6, 0.6),
  new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false,
  })
);
shadowBlob.rotation.x = -Math.PI / 2;
shadowBlob.position.y =  0.002;
scene.add(shadowBlob);

// ─── Axes helper (X=red, Y=green, Z=blue) ────────────────────────────────────
// Placed at world origin; arms extend 4 units along each axis.
// Hidden by default — toggle via Settings → Visual → Show Axes.
const axesHelper = new THREE.AxesHelper(4);
axesHelper.visible = false;
scene.add(axesHelper);

// Canvas-texture sprites for X / Y / Z labels at the tip of each arm.
// Attached to axesHelper so they show/hide with it automatically.
(function addAxisLabels() {
  const specs = [
    { text: 'X', color: '#ff4444', pos: [4.6, 0,   0  ] },
    { text: 'Y', color: '#44dd44', pos: [0,   4.6, 0  ] },
    { text: 'Z', color: '#4499ff', pos: [0,   0,   4.6] },
  ];
  specs.forEach(({ text, color, pos }) => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    cx.font = 'bold 44px Arial';
    cx.fillStyle = color;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, 32, 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })
    );
    sprite.scale.set(0.7, 0.7, 1);
    sprite.position.set(...pos);
    axesHelper.add(sprite);
  });
})();

// ─── Mouse hover raycast ─────────────────────────────────────────────────────
// A single re-positioned plane highlights whichever tile the cursor is over.
const hoverHighlight = new THREE.Mesh(
  new THREE.PlaneGeometry(0.92, 0.92),
  new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.25,
    depthWrite: false, side: THREE.DoubleSide,
  })
);
hoverHighlight.rotation.x = -Math.PI / 2;
hoverHighlight.position.y = 0.005;
hoverHighlight.visible = false;
hoverHighlight.material.depthTest = false;
hoverHighlight.renderOrder = 5;      // always on top of pathfinding layers
scene.add(hoverHighlight);

// ─── Debug raycast visualisation ──────────────────────────────────────────────
// Toggled via Settings → Visual → Debug Raycast.
// Draws a cyan line from the ray origin to the selected hit point, places a
// green sphere at the hit, and prints a per-hit breakdown in a HUD overlay.

// Cyan line: two mutable vertices updated every frame
const _dbgRayPts = [new THREE.Vector3(), new THREE.Vector3()];
const _dbgRayGeo = new THREE.BufferGeometry().setFromPoints(_dbgRayPts);
const debugRayLine = new THREE.Line(
  _dbgRayGeo,
  new THREE.LineBasicMaterial({ color: 0x00ffee, depthTest: false })
);
debugRayLine.renderOrder = 12;
debugRayLine.visible = false;
scene.add(debugRayLine);

// Green sphere at the intersection point
const debugHitMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0x00ff88, depthTest: false })
);
debugHitMarker.renderOrder = 13;
debugHitMarker.visible = false;
scene.add(debugHitMarker);

// ─── Pathfinding visualisation layers ────────────────────────────────────────
// Three InstancedMesh objects share the same flat plane geometry; each instance
// is positioned at a tile. depthTest:false + renderOrder keeps them stacked
// cleanly above the tile geometry regardless of small Y differences.
const _pfDummy = new THREE.Object3D();
_pfDummy.rotation.x = -Math.PI / 2;   // lay plane flat on the ground

function _setTileInstance(mesh, idx, x, z) {
  _pfDummy.position.set(x, 0.005, z);
  _pfDummy.updateMatrix();
  mesh.setMatrixAt(idx, _pfDummy.matrix);
}

const MAX_TILES = 500;   // covers Room 1 (289) + corridor (15) + Room 2 (121)

function _makeLayer(color, maxN, order) {
  const m = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.88, 0.88),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.5,
      depthWrite: false, depthTest: false,
    }),
    maxN
  );
  m.count = 0;
  m.visible = false;
  m.renderOrder = order;
  scene.add(m);
  return m;
}

const exploredLayer = _makeLayer(0x2255ff, MAX_TILES, 1);   // blue — A* explored
const pathLayer     = _makeLayer(0xff2222, MAX_TILES, 2);   // red  — planned path
const destLayer     = _makeLayer(0x22ff55, 1,         4);   // green — destination

const raycaster   = new THREE.Raycaster();
const mouse       = new THREE.Vector2(Infinity, Infinity);
let   hoveredTile = null;   // { x, z, type, walkable } or null

// Right-click drag → camera pan
renderer.domElement.addEventListener('mousedown', e => {
  if (e.button === 2) {
    isRightDragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    renderer.domElement.style.cursor = 'grabbing';
  }
});
window.addEventListener('mouseup', e => {
  if (e.button === 2) {
    isRightDragging = false;
    renderer.domElement.style.cursor = isPanMode ? 'grab' : 'default';
  }
});
// Suppress context menu so right-click doesn't open the browser menu
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

// ── Zoom helper ──────────────────────────────────────────────────────────────
const zoomInfoEl = document.getElementById('zoom-info');
function setZoom(newSize) {
  newSize  = Math.max(6, Math.min(18, newSize));
  viewSize = newSize;
  camera.left   = -viewSize * aspect;
  camera.right  =  viewSize * aspect;
  camera.top    =  viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  zoomInfoEl.textContent = `zoom ${viewSize.toFixed(1)}`;
}
setZoom(viewSize);   // initialise display

// Scroll-wheel zoom — adjusts viewSize directly without opening Settings
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  const dir = e.deltaY > 0 ? 1 : -1;   // +1 = zoom out, −1 = zoom in
  setZoom(viewSize + dir * 0.8);
}, { passive: false });

window.addEventListener('mousemove', e => {
  // Always update the normalised mouse position for hover raycasting
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  // Pan camera when right mouse is held
  if (isRightDragging) {
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;
    lastDragX = e.clientX;
    lastDragY = e.clientY;

    if (dx !== 0 || dy !== 0) {
      // Convert pixel delta → world units (orthographic projection)
      const worldPerPxH = (viewSize * 2 * aspect) / window.innerWidth;
      const worldPerPxV = (viewSize * 2) / window.innerHeight;
      const sx = Math.sin(currentCamAngle);
      const cx = Math.cos(currentCamAngle);

      // Map-style: scene moves WITH the drag
      //  • screen-right  = camera local-X = (sx,  0, -cx)
      //  • screen-down   = camera local-Y↓ = (cx,  0,  sx)
      camFocusX += -dx * worldPerPxH * sx + dy * worldPerPxV * cx;
      camFocusZ +=  dx * worldPerPxH * cx + dy * worldPerPxV * sx;
      isPanMode = true;
    }
  }
});
// Clear hover when cursor leaves the window
window.addEventListener('mouseleave', () => {
  mouse.set(Infinity, Infinity);
  isRightDragging = false;
});

// Left-click → click-to-move (uses the already-computed hoveredTile)
renderer.domElement.addEventListener('click', e => {
  if (!clickToMoveEnabled || isPaused || !hoveredTile || !hoveredTile.walkable) return;
  if (e.button !== 0) return;
  // Don't trigger if this click was the end of a right-drag
  if (isRightDragging) return;
  startPathfind(hoveredTile.x, hoveredTile.z);
});

// ─── Compass (bottom-left) ────────────────────────────────────────────────────
const CS  = 72;
const compassCanvas = document.createElement('canvas');
compassCanvas.width = compassCanvas.height = CS;
Object.assign(compassCanvas.style, {
  position: 'absolute', bottom: '20px', left: '20px',
  pointerEvents: 'none', userSelect: 'none',
});
document.body.appendChild(compassCanvas);
const ctx2d = compassCanvas.getContext('2d');
const CC    = CS / 2;

function drawCompass() {
  ctx2d.clearRect(0, 0, CS, CS);

  // Background disc
  ctx2d.fillStyle   = 'rgba(0,0,0,0.45)';
  ctx2d.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx2d.lineWidth   = 1;
  ctx2d.beginPath();
  ctx2d.arc(CC, CC, CC - 1, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.stroke();

  // The ring (N/E/S/W labels + tick marks) rotates with the camera
  ctx2d.save();
  ctx2d.translate(CC, CC);
  ctx2d.rotate(cameraRotStep * (Math.PI / 2));

  // Tick marks at 45° intervals
  ctx2d.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx2d.lineWidth   = 1;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx2d.beginPath();
    ctx2d.moveTo(Math.sin(a) * (CC - 6), -Math.cos(a) * (CC - 6));
    ctx2d.lineTo(Math.sin(a) * (CC - 2), -Math.cos(a) * (CC - 2));
    ctx2d.stroke();
  }

  // Cardinal labels — N is red
  ctx2d.font         = 'bold 11px monospace';
  ctx2d.textAlign    = 'center';
  ctx2d.textBaseline = 'middle';
  const labelR = CC - 13;
  for (const [lbl, a] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]]) {
    ctx2d.fillStyle = lbl === 'N' ? '#ff5555' : 'rgba(255,255,255,0.65)';
    ctx2d.fillText(lbl, Math.sin(a) * labelR, -Math.cos(a) * labelR);
  }

  ctx2d.restore();

  // Fixed white triangle = constant "screen up" pointer
  ctx2d.fillStyle = 'rgba(255,255,255,0.85)';
  ctx2d.beginPath();
  ctx2d.moveTo(CC,     4);
  ctx2d.lineTo(CC - 4, 14);
  ctx2d.lineTo(CC + 4, 14);
  ctx2d.closePath();
  ctx2d.fill();
}

// ─── Input ────────────────────────────────────────────────────────────────────
const held = new Set();

window.addEventListener('keydown', e => {
  const managed = new Set([
    'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
    'KeyW','KeyA','KeyS','KeyD',
    'KeyZ','KeyC','KeyX','Space','KeyP','Escape',
  ]);
  if (managed.has(e.code)) e.preventDefault();

  if (!e.repeat) {
    // Pause toggle (P) — only when settings menu is closed
    if (e.code === 'KeyP' && !settingsVisible) {
      setPaused(!isPaused);
      return;
    }

    // Settings menu (Escape)
    if (e.code === 'Escape') {
      settingsVisible ? closeSettings() : openSettings();
      return;
    }

    // Ignore all game input while paused or in menu
    if (isPaused) return;

    // Camera rotation — fires once per keypress
    if (e.code === 'KeyC') {
      cameraRotStep  = (cameraRotStep + 1) % 4;
      targetCamAngle = DEFAULT_CAM_ANGLE - cameraRotStep * (Math.PI / 2);
    }
    if (e.code === 'KeyZ') {
      cameraRotStep  = (cameraRotStep + 3) % 4;
      targetCamAngle = DEFAULT_CAM_ANGLE - cameraRotStep * (Math.PI / 2);
    }
    if (e.code === 'KeyX') {
      cameraRotStep  = 0;
      targetCamAngle = DEFAULT_CAM_ANGLE;
      isPanMode      = false;   // camera will smoothly re-center on player
      setZoom(DEFAULTS.viewSize);
    }

    // Jump — only when grounded
    if (e.code === 'Space' && isGrounded) {
      jumpVelocity = jumpSpeed;
      isGrounded   = false;
    }
  }

  held.add(e.code);
});

window.addEventListener('keyup', e => held.delete(e.code));

// ─── Player State ─────────────────────────────────────────────────────────────
const grid    = { x: 0, z: 0 };
let moveCooldown = 0;
let jumpVelocity = 0;
let isGrounded   = true;
let playerJumpY  = 0;
let playerBaseY  = 0;   // world-Y of the current tile's top surface (follows tile elevation)

const coordsEl   = document.getElementById('coords');
const tileInfoEl = document.getElementById('tile-info');
const fpsEl         = document.getElementById('fps');
const orientationEl = document.getElementById('orientation');
const hoverInfoEl    = document.getElementById('hover-info');
const debugRayInfoEl = document.getElementById('debug-ray-info');
const panIndicatorEl = document.getElementById('pan-indicator');
let fpsAccum  = 0;
let fpsFrames = 0;

// ─── Version Overlay ──────────────────────────────────────────────────────────
const versionEl = document.getElementById('version');
fetch('./version.txt')
  .then(r => r.text())
  .then(v => { versionEl.textContent = `v${v.trim()}`; })
  .catch(() => {});

// Returns true if the tile at (x, z) exists and is walkable.
// No bounds check — multi-room map uses tileMap presence as the authority.
function isWalkable(x, z) {
  return tileMap[x]?.[z]?.walkable === true;
}

// ── tryMove (hoisted so pathfinding can call it) ──────────────────────────────
function tryMove(tx, tz, faceDx, faceDz) {
  if (!isWalkable(tx, tz)) return false;
  // Prevent cliff teleports — only allow moves where elevation differs by ≤ one step.
  // This forces staircase use and stops the player jumping off (or onto) the platform edges.
  const fromElev = tileMap[grid.x]?.[grid.z]?.elevation || 0;
  const toElev   = tileMap[tx]?.[tz]?.elevation   || 0;
  if (Math.abs(toElev - fromElev) > MAX_STEP_HEIGHT) return false;
  grid.x = tx;
  grid.z = tz;
  playerMesh.rotation.y = Math.atan2(-faceDx, -faceDz);
  coordsEl.textContent  = `${grid.x}, ${grid.z}`;
  const tile = tileMap[tx]?.[tz];
  tileInfoEl.textContent = tile ? `tile: ${tile.type}  walkable: ${tile.walkable}` : '';
  return true;
}

// ─── Pathfinding ──────────────────────────────────────────────────────────────
let pfState      = 'idle';   // 'idle' | 'searching' | 'following'
let pfToken      = 0;        // increment to cancel any in-flight async search
let pfPath       = [];       // [{x,z}] steps remaining to walk
let pfStepIdx    = 0;        // index into pfPath of the next step to take
let pfGoal       = null;     // {x,z} destination tile
const pfExplored = new Set();// string keys of A*-explored tiles this run

// ── Visualisation helpers ─────────────────────────────────────────────────────
function _vizExplored() {
  if (!showExploreViz || pfExplored.size === 0) {
    exploredLayer.count = 0; exploredLayer.visible = false; return;
  }
  let i = 0;
  for (const k of pfExplored) {
    const [x, z] = k.split(',').map(Number);
    _setTileInstance(exploredLayer, i++, x, z);
  }
  exploredLayer.count = i;
  exploredLayer.instanceMatrix.needsUpdate = true;
  exploredLayer.visible = true;
}

function _vizPath() {
  const rem = pfPath.slice(pfStepIdx);
  if (!showPathViz || rem.length === 0) {
    pathLayer.count = 0; pathLayer.visible = false; return;
  }
  rem.forEach((p, i) => _setTileInstance(pathLayer, i, p.x, p.z));
  pathLayer.count = rem.length;
  pathLayer.instanceMatrix.needsUpdate = true;
  pathLayer.visible = true;
}

function _vizDest() {
  if (!showDestViz || !pfGoal) {
    destLayer.count = 0; destLayer.visible = false; return;
  }
  _setTileInstance(destLayer, 0, pfGoal.x, pfGoal.z);
  destLayer.count = 1;
  destLayer.instanceMatrix.needsUpdate = true;
  destLayer.visible = true;
}

function _clearAllViz() {
  pfExplored.clear();
  exploredLayer.count = 0; exploredLayer.visible = false;
  pathLayer.count     = 0; pathLayer.visible     = false;
  destLayer.count     = 0; destLayer.visible     = false;
}

// ── A* min-heap priority queue ────────────────────────────────────────────────
class MinHeap {
  constructor() { this._d = []; }
  get size() { return this._d.length; }
  push(n) { this._d.push(n); this._up(this._d.length - 1); }
  pop()  {
    const top = this._d[0], last = this._d.pop();
    if (this._d.length) { this._d[0] = last; this._dn(0); }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[p].f <= this._d[i].f) break;
      [this._d[p], this._d[i]] = [this._d[i], this._d[p]]; i = p;
    }
  }
  _dn(i) {
    const n = this._d.length;
    for (;;) {
      let m = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this._d[l].f < this._d[m].f) m = l;
      if (r < n && this._d[r].f < this._d[m].f) m = r;
      if (m === i) break;
      [this._d[m], this._d[i]] = [this._d[i], this._d[m]]; i = m;
    }
  }
}

// Chebyshev heuristic (admissible for 8-direction grid movement)
function _h(ax, az, bx, bz) {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

const _DIRS8 = [
  [-1,-1],[0,-1],[1,-1],
  [-1, 0],       [1, 0],
  [-1, 1],[0, 1],[1, 1],
];

async function _aStar(sx, sz, gx, gz, token) {
  const heap     = new MinHeap();
  const cameFrom = new Map();
  const gScore   = new Map();
  const closed   = new Set();
  const startKey = `${sx},${sz}`;
  const goalKey  = `${gx},${gz}`;

  gScore.set(startKey, 0);
  heap.push({ x: sx, z: sz, f: _h(sx, sz, gx, gz) });
  pfExplored.clear();

  while (heap.size > 0) {
    if (pfToken !== token) return null;   // cancelled

    const cur = heap.pop();
    const key = `${cur.x},${cur.z}`;
    if (closed.has(key)) continue;
    closed.add(key);

    // Visualise explored set (skip render update when delay is 0 for speed)
    pfExplored.add(key);
    if (pathfindDelay > 0) {
      _vizExplored();
      await new Promise(r => setTimeout(r, pathfindDelay));
      if (pfToken !== token) return null;
    }

    if (key === goalKey) {
      // Reconstruct path (excludes start tile)
      const path = [];
      let k = key;
      while (k !== startKey) {
        const [px, pz] = k.split(',').map(Number);
        path.unshift({ x: px, z: pz });
        k = cameFrom.get(k);
      }
      return path;
    }

    for (const [dx, dz] of _DIRS8) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!isWalkable(nx, nz)) continue;
      // Respect elevation cliff limit so pathfinder uses stairs, not edges
      const curElev = tileMap[cur.x]?.[cur.z]?.elevation || 0;
      const nxElev  = tileMap[nx]?.[nz]?.elevation  || 0;
      if (Math.abs(nxElev - curElev) > MAX_STEP_HEIGHT) continue;
      const nk = `${nx},${nz}`;
      if (closed.has(nk)) continue;
      const cost = (dx !== 0 && dz !== 0) ? Math.SQRT2 : 1;
      const ng   = (gScore.get(key) ?? 0) + cost;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, key);
        gScore.set(nk, ng);
        heap.push({ x: nx, z: nz, f: ng + _h(nx, nz, gx, gz) });
      }
    }
  }
  return null;  // no path exists
}

// ── Public entry point ────────────────────────────────────────────────────────
async function startPathfind(gx, gz) {
  pfToken++;
  const myToken = pfToken;
  pfGoal    = { x: gx, z: gz };
  pfPath    = [];
  pfStepIdx = 0;
  pfState   = 'searching';

  _vizDest();
  _vizPath();
  pfExplored.clear();
  exploredLayer.count = 0; exploredLayer.visible = false;

  const path = await _aStar(grid.x, grid.z, gx, gz, myToken);
  if (pfToken !== myToken) return;   // another search started

  if (path && path.length > 0) {
    pfPath    = path;
    pfStepIdx = 0;
    pfState   = 'following';
    _vizExplored();   // show final explored set
    _vizPath();
  } else {
    pfState = 'idle';
    pfGoal  = null;
    _vizExplored();   // keep explored for debugging
    _vizPath();
    _vizDest();
  }
}

function cancelPathfind() {
  pfToken++;
  pfState = 'idle';
  pfGoal  = null;
  pfPath  = [];
  pfStepIdx = 0;
  _clearAllViz();
}

function processInput(dt) {
  if (isPaused) return;
  moveCooldown -= dt;
  if (moveCooldown > 0) return;

  // ── Auto-follow path ──────────────────────────────────────────────────────
  if (pfState === 'following') {
    // Any manual key press cancels the path
    const anyMove = held.has('ArrowUp')   || held.has('ArrowDown')  ||
                    held.has('ArrowLeft') || held.has('ArrowRight') ||
                    held.has('KeyW')      || held.has('KeyA')       ||
                    held.has('KeyS')      || held.has('KeyD');
    if (anyMove) {
      cancelPathfind();
      // fall through to keyboard input below
    } else {
      if (pfStepIdx < pfPath.length) {
        const next = pfPath[pfStepIdx];
        const dx = next.x - grid.x;
        const dz = next.z - grid.z;
        if (tryMove(next.x, next.z, dx, dz)) {
          pfStepIdx++;
          _vizPath();
        } else {
          cancelPathfind();   // path blocked mid-follow
        }
        if (pfStepIdx >= pfPath.length) {
          // Reached goal
          pfState = 'idle';
          pfGoal  = null;
          _clearAllViz();
        }
      }
      moveCooldown = moveDelay;
      return;
    }
  }

  // ── Keyboard movement ─────────────────────────────────────────────────────
  const ix = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0)
           - (held.has('ArrowLeft')  || held.has('KeyA') ? 1 : 0);
  const iz = (held.has('ArrowDown')  || held.has('KeyS') ? 1 : 0)
           - (held.has('ArrowUp')    || held.has('KeyW') ? 1 : 0);

  if (ix === 0 && iz === 0) return;

  // ── Camera-relative world movement ───────────────────────────────────────
  //
  // For an iso orthographic camera at XZ angle α, Three.js lookAt gives:
  //   camera local +X (screen right) projected to XZ = ( sin α,  0, −cos α )
  //   camera local +Y (screen up)    projected to XZ = (−cos α,  0, −sin α )
  //
  // World displacement = ix · screen_right + (−iz) · screen_up
  //   (−iz because iz=+1 means screen-down = opposite of screen-up)
  //
  // This naturally produces all 8 directions — single keys give the four
  // diagonal world moves; two keys combine to give the four cardinal moves.
  //
  const α    = targetCamAngle;  // snapped angle → always ±√2/2 for sin/cos
  const rawX =  ix * Math.sin(α) + iz * Math.cos(α);
  const rawZ = -ix * Math.cos(α) + iz * Math.sin(α);

  const dx = Math.round(rawX);  // −1, 0, or +1
  const dz = Math.round(rawZ);

  if (dx === 0 && dz === 0) return;

  const nx = grid.x + dx;
  const nz = grid.z + dz;

  const moved = tryMove(nx, nz, dx, dz);

  if (!moved) {
    let slid = false;
    if (dx !== 0 && dz !== 0 && cornerSlidingEnabled) {
      slid = tryMove(grid.x + dx, grid.z, dx,  0)
          || tryMove(grid.x,    grid.z + dz,  0, dz);
    }
    if (!slid) {
      const tile = tileMap[nx]?.[nz];
      if (tile && !tile.walkable) {
        tileInfoEl.textContent = `tile: ${tile.type}  walkable: ${tile.walkable}  ← blocked`;
      }
    }
  }

  moveCooldown = moveDelay;
}

// ─── Animation Loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t  = clock.getElapsedTime();

  // ── FPS counter ───────────────────────────────────────────────────────────
  fpsAccum  += dt;
  fpsFrames += 1;
  if (fpsAccum >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`;
    fpsAccum  = 0;
    fpsFrames = 0;
  }

  processInput(dt);

  // ── Jump physics ──────────────────────────────────────────────────────────
  if (!isGrounded) {
    jumpVelocity -= gravity * dt;
    playerJumpY  += jumpVelocity * dt;
    if (playerJumpY <= 0) {
      playerJumpY  = 0;
      jumpVelocity = 0;
      isGrounded   = true;
    }
  }

  // ── Player position ───────────────────────────────────────────────────────
  const lerpK = 1 - Math.exp(-dt * 20);
  playerMesh.position.x += (grid.x - playerMesh.position.x) * lerpK;
  playerMesh.position.z += (grid.z - playerMesh.position.z) * lerpK;

  // Smoothly track the elevation of the current tile
  const curTileElev = tileMap[grid.x]?.[grid.z]?.elevation || 0;
  playerBaseY += (curTileElev - playerBaseY) * lerpK;

  // Idle bob only when on the ground; suppress during jump
  const bob = isGrounded ? Math.sin(t * 2.5) * 0.03 : 0;
  playerMesh.position.y = PLAYER_SIZE / 2 + playerJumpY + bob + playerBaseY;

  // Shadow shrinks / fades as player rises; sits on the tile surface
  const shadowS = Math.max(0.15, 1 - playerJumpY * 0.18);
  shadowBlob.scale.set(shadowS, 1, shadowS);
  shadowBlob.material.opacity = 0.25 * shadowS;
  shadowBlob.position.x = playerMesh.position.x;
  shadowBlob.position.z = playerMesh.position.z;
  shadowBlob.position.y = playerBaseY + 0.002;

  // ── Lava glow pulse ───────────────────────────────────────────────────────
  lavaLight.intensity = 1.8 + Math.sin(t * 2.8) * 0.6;

  // ── Dais light pulse ──────────────────────────────────────────────────────
  daisLight.intensity = 1.2 + Math.sin(t * 1.5) * 0.4;

  // ── Wall transparency — fade walls near the player so they never occlude ──
  {
    const px = playerMesh.position.x, pz = playerMesh.position.z;
    for (const wd of wallData) {
      const dist = Math.sqrt((wd.x - px) ** 2 + (wd.z - pz) ** 2);
      const t2 = Math.max(0, Math.min(1,
        (dist - WALL_FADE_NEAR) / (WALL_FADE_FAR - WALL_FADE_NEAR)));
      wd.mesh.material.opacity = WALL_MIN_OPC + t2 * (1 - WALL_MIN_OPC);
    }
  }

  // ── Camera smooth orbit ───────────────────────────────────────────────────
  let diff = targetCamAngle - currentCamAngle;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  currentCamAngle += diff * (1 - Math.exp(-dt * 8));

  // When not panned, smoothly re-centre the focus on the player
  const camK = 1 - Math.exp(-dt * camFollowSpeed);
  if (!isPanMode) {
    camFocusX += (playerMesh.position.x - camFocusX) * camK;
    camFocusZ += (playerMesh.position.z - camFocusZ) * camK;
  }

  const tgtCamX = camFocusX + CAM_RADIUS * Math.cos(currentCamAngle);
  const tgtCamZ = camFocusZ + CAM_RADIUS * Math.sin(currentCamAngle);
  camera.position.x += (tgtCamX - camera.position.x) * camK;
  camera.position.y  = CAM_HEIGHT;
  camera.position.z += (tgtCamZ - camera.position.z) * camK;
  camera.lookAt(camFocusX, 0, camFocusZ);

  // ── Mouse hover raycast ───────────────────────────────────────────────────
  if (hoverRaycastEnabled) {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(tileMeshes);
    if (hits.length > 0) {
      // Pick the hit whose tile has the highest elevation; break ties by the
      // highest intersection-point Y. This is more robust than ray-distance
      // ordering because an isometric ray can be geometrically closer to a
      // floor tile at a lower Z than to the elevated step tile that is visually
      // in front of it. Elevation-first selection always picks the topmost tile.
      const best = hits.reduce((a, b) => {
        const ae = tileMap[Math.round(a.object.position.x)]?.[Math.round(a.object.position.z)]?.elevation || 0;
        const be = tileMap[Math.round(b.object.position.x)]?.[Math.round(b.object.position.z)]?.elevation || 0;
        if (be !== ae) return be > ae ? b : a;
        return b.point.y > a.point.y ? b : a;
      }, hits[0]);
      const m  = best.object;
      const tx = Math.round(m.position.x);
      const tz = Math.round(m.position.z);
      const td = tileMap[tx]?.[tz];
      hoveredTile = td ? { x: tx, z: tz, type: td.type, walkable: td.walkable } : null;

      // Reposition highlight and pulse opacity
      hoverHighlight.position.x = tx;
      hoverHighlight.position.z = tz;
      hoverHighlight.material.color.setHex(td?.type === 'lava' ? 0xff8844 : 0xffffff);
      hoverHighlight.material.opacity = 0.18 + Math.sin(t * 5) * 0.07;
      hoverHighlight.visible = true;

      if (hoveredTile) {
        hoverInfoEl.textContent =
          `hover  [${tx}, ${tz}]  ${hoveredTile.type}  walkable: ${hoveredTile.walkable}`;
        hoverInfoEl.style.display = '';
      }

      // ── Debug raycast overlay ─────────────────────────────────────────────
      if (debugRayEnabled) {
        // Cyan ray line: from ray origin to best hit point
        const ray = raycaster.ray;
        const dbgPos = _dbgRayGeo.attributes.position;
        dbgPos.setXYZ(0, ray.origin.x, ray.origin.y, ray.origin.z);
        dbgPos.setXYZ(1, best.point.x,  best.point.y,  best.point.z);
        dbgPos.needsUpdate = true;
        debugRayLine.visible = true;
        // Green sphere at intersection
        debugHitMarker.position.copy(best.point);
        debugHitMarker.visible = true;
        // HUD: list every hit with full tile metadata
        const hitLines = hits.map((h, i) => {
          const hx   = Math.round(h.object.position.x);
          const hz   = Math.round(h.object.position.z);
          const tile = tileMap[hx]?.[hz];
          const he   = (tile?.elevation || 0).toFixed(2);
          const hy   = h.point.y.toFixed(3);
          const type = tile?.type     ?? 'unknown';
          const walk = tile?.walkable ? 'yes' : 'no';
          const mark = (h === best)   ? ' ◀' : '';
          return `  [${i}] (${hx},${hz})  type:${type}  walkable:${walk}  elev:${he}  hitY:${hy}${mark}`;
        });
        debugRayInfoEl.textContent = `ray hits: ${hits.length}\n${hitLines.join('\n')}`;
        debugRayInfoEl.style.display = '';
      } else {
        debugRayLine.visible = false;
        debugHitMarker.visible = false;
        debugRayInfoEl.style.display = 'none';
      }
    } else {
      hoveredTile = null;
      hoverHighlight.visible = false;
      hoverInfoEl.style.display = 'none';
      debugRayLine.visible = false;
      debugHitMarker.visible = false;
      debugRayInfoEl.style.display = 'none';
    }
  } else {
    hoveredTile = null;
    hoverHighlight.visible = false;
    hoverInfoEl.style.display = 'none';
    debugRayLine.visible = false;
    debugHitMarker.visible = false;
    debugRayInfoEl.style.display = 'none';
  }

  // ── Pan indicator ─────────────────────────────────────────────────────────
  if (isPanMode) {
    panIndicatorEl.style.display = '';
    renderer.domElement.style.cursor = isRightDragging ? 'grabbing' : 'grab';
  } else {
    panIndicatorEl.style.display = 'none';
    if (!isRightDragging) renderer.domElement.style.cursor = 'default';
  }

  // ── Orientation readout (only when axes helper is visible) ───────────────
  if (axesHelper.visible) {
    const yawDeg   = (((currentCamAngle * 180 / Math.PI) % 360) + 360) % 360;
    const pitchDeg = Math.atan2(CAM_HEIGHT, CAM_RADIUS) * 180 / Math.PI;
    orientationEl.textContent =
      `yaw   ${yawDeg.toFixed(1)}°\npitch ${pitchDeg.toFixed(1)}°\nroll  0.0°`;
    orientationEl.style.display = '';
  } else {
    orientationEl.style.display = 'none';
  }

  drawCompass();
  renderer.render(scene, camera);
}

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  aspect = window.innerWidth / window.innerHeight;
  camera.left  = -viewSize * aspect;
  camera.right =  viewSize * aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Pause & Settings Menu ────────────────────────────────────────────────────
let isPaused       = false;
let settingsVisible = false;

const pauseOverlay    = document.getElementById('pause-overlay');
const settingsOverlay = document.getElementById('settings-overlay');

function setPaused(val) {
  isPaused = val;
  pauseOverlay.classList.toggle('hidden', !isPaused);
}

function openSettings() {
  isPaused        = true;
  settingsVisible = true;
  pauseOverlay.classList.add('hidden');
  settingsOverlay.classList.remove('hidden');
  syncMenuToState();
}

function closeSettings() {
  settingsVisible = false;
  isPaused        = false;
  settingsOverlay.classList.add('hidden');
}

// ── Slider ↔ number input sync ───────────────────────────────────────────────
function linkControls(sliderId, inputId, min, max) {
  const slider = document.getElementById(sliderId);
  const input  = document.getElementById(inputId);
  slider.addEventListener('input', () => { input.value = slider.value; });
  input.addEventListener('input',  () => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) slider.value = Math.max(min, Math.min(max, v));
  });
}

function setControls(sliderId, inputId, value) {
  const rounded = Math.round(value * 10000) / 10000;  // avoid float noise
  document.getElementById(sliderId).value = rounded;
  document.getElementById(inputId).value  = rounded;
}

// Populate all controls with the live game state
function syncMenuToState() {
  setControls('s-move-delay',  'n-move-delay',  Math.round(moveDelay * 1000));
  document.getElementById('s-corner-sliding').checked = cornerSlidingEnabled;
  setControls('s-jump-speed',  'n-jump-speed',  jumpSpeed);
  setControls('s-gravity',     'n-gravity',     gravity);
  setControls('s-cam-speed',   'n-cam-speed',   camFollowSpeed);
  setControls('s-zoom',        'n-zoom',        viewSize);
  setControls('s-fog',         'n-fog',         scene.fog.density);
  document.getElementById('s-show-fps').checked     = fpsEl.style.display     !== 'none';
  document.getElementById('s-show-compass').checked = compassCanvas.style.display !== 'none';
  document.getElementById('s-show-ray').checked     = rayArrow.visible;
  document.getElementById('s-show-axes').checked        = axesHelper.visible;
  document.getElementById('s-hover-raycast').checked    = hoverRaycastEnabled;
  document.getElementById('s-debug-ray').checked        = debugRayEnabled;
  document.getElementById('s-click-to-move').checked    = clickToMoveEnabled;
  document.getElementById('s-show-path').checked        = showPathViz;
  document.getElementById('s-show-dest').checked        = showDestViz;
  document.getElementById('s-show-explore').checked     = showExploreViz;
  setControls('s-path-delay', 'n-path-delay', pathfindDelay);
}

// Wire slider ↔ input pairs
linkControls('s-move-delay', 'n-move-delay', 50,   300);
linkControls('s-jump-speed', 'n-jump-speed', 3,    15);
linkControls('s-gravity',    'n-gravity',    10,   40);
linkControls('s-cam-speed',  'n-cam-speed',  2,    20);
linkControls('s-zoom',       'n-zoom',       6,    18);
linkControls('s-fog',        'n-fog',        0,    0.08);
linkControls('s-path-delay', 'n-path-delay', 0,    500);

// Apply a single default value to its control(s)
function applyDefault(key) {
  switch (key) {
    case 'moveDelay':      setControls('s-move-delay', 'n-move-delay', DEFAULTS.moveDelay); break;
    case 'jumpSpeed':      setControls('s-jump-speed', 'n-jump-speed', DEFAULTS.jumpSpeed); break;
    case 'gravity':        setControls('s-gravity',    'n-gravity',    DEFAULTS.gravity); break;
    case 'camFollowSpeed': setControls('s-cam-speed',  'n-cam-speed',  DEFAULTS.camFollowSpeed); break;
    case 'viewSize':       setControls('s-zoom',       'n-zoom',       DEFAULTS.viewSize); break;
    case 'fogDensity':     setControls('s-fog',        'n-fog',        DEFAULTS.fogDensity); break;
    case 'cornerSliding':  document.getElementById('s-corner-sliding').checked = DEFAULTS.cornerSliding; break;
    case 'showFps':        document.getElementById('s-show-fps').checked       = DEFAULTS.showFps; break;
    case 'showCompass':    document.getElementById('s-show-compass').checked   = DEFAULTS.showCompass; break;
    case 'showRay':        document.getElementById('s-show-ray').checked       = DEFAULTS.showRay; break;
    case 'showAxes':       document.getElementById('s-show-axes').checked      = DEFAULTS.showAxes; break;
    case 'hoverRaycast':   document.getElementById('s-hover-raycast').checked  = DEFAULTS.hoverRaycast; break;
    case 'debugRay':       document.getElementById('s-debug-ray').checked      = DEFAULTS.debugRay; break;
    case 'clickToMove':    document.getElementById('s-click-to-move').checked  = DEFAULTS.clickToMove; break;
    case 'showPathViz':    document.getElementById('s-show-path').checked      = DEFAULTS.showPathViz; break;
    case 'showDestViz':    document.getElementById('s-show-dest').checked      = DEFAULTS.showDestViz; break;
    case 'showExploreViz': document.getElementById('s-show-explore').checked   = DEFAULTS.showExploreViz; break;
    case 'pathDelay':      setControls('s-path-delay', 'n-path-delay', DEFAULTS.pathDelay); break;
  }
}

// Restore all settings controls to their defaults
function resetAllDefaults() {
  Object.keys(DEFAULTS).forEach(applyDefault);
}

// Delegated handler for individual per-row reset buttons
document.getElementById('settings-panel').addEventListener('click', e => {
  const btn = e.target.closest('.btn-reset');
  if (btn) applyDefault(btn.dataset.reset);
});

document.getElementById('btn-reset-all').addEventListener('click', resetAllDefaults);

// Save & Apply
document.getElementById('btn-save').addEventListener('click', () => {
  moveDelay            = parseFloat(document.getElementById('n-move-delay').value) / 1000;
  cornerSlidingEnabled = document.getElementById('s-corner-sliding').checked;
  jumpSpeed            = parseFloat(document.getElementById('n-jump-speed').value);
  gravity              = parseFloat(document.getElementById('n-gravity').value);
  camFollowSpeed       = parseFloat(document.getElementById('n-cam-speed').value);

  setZoom(parseFloat(document.getElementById('n-zoom').value));

  scene.fog.density           = parseFloat(document.getElementById('n-fog').value);
  fpsEl.style.display         = document.getElementById('s-show-fps').checked     ? '' : 'none';
  compassCanvas.style.display = document.getElementById('s-show-compass').checked ? '' : 'none';
  rayArrow.visible            = document.getElementById('s-show-ray').checked;
  axesHelper.visible          = document.getElementById('s-show-axes').checked;
  hoverRaycastEnabled         = document.getElementById('s-hover-raycast').checked;
  debugRayEnabled             = document.getElementById('s-debug-ray').checked;
  clickToMoveEnabled          = document.getElementById('s-click-to-move').checked;
  showPathViz                 = document.getElementById('s-show-path').checked;
  showDestViz                 = document.getElementById('s-show-dest').checked;
  showExploreViz              = document.getElementById('s-show-explore').checked;
  pathfindDelay               = parseFloat(document.getElementById('n-path-delay').value);
  // Immediately refresh any active visualisation to reflect toggle changes
  _vizPath(); _vizDest(); _vizExplored();

  closeSettings();
});

document.getElementById('btn-close').addEventListener('click', closeSettings);

animate();

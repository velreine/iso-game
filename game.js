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
let cornerSlidingEnabled = true;  // auto-slide along obstacles

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
sun.shadow.camera.left   = -25;
sun.shadow.camera.right  =  25;
sun.shadow.camera.top    =  25;
sun.shadow.camera.bottom = -25;
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

const tileGeom = new THREE.BoxGeometry(1 - TILE_GAP, TILE_THICKNESS, 1 - TILE_GAP);

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

    tileMap[x][z] = {
      walkable : !isLava,   // ← metadata: lava tiles block movement
      type     : isLava ? 'lava' : 'stone',
      mesh     : tile,
    };
  }
}

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

const coordsEl   = document.getElementById('coords');
const tileInfoEl = document.getElementById('tile-info');
const fpsEl      = document.getElementById('fps');
let fpsAccum  = 0;
let fpsFrames = 0;

// ─── Version Overlay ──────────────────────────────────────────────────────────
const versionEl = document.getElementById('version');
fetch('./version.txt')
  .then(r => r.text())
  .then(v => { versionEl.textContent = `v${v.trim()}`; })
  .catch(() => {});

// Returns true if the tile at (x, z) exists and is walkable
function isWalkable(x, z) {
  if (Math.abs(x) > GRID_HALF || Math.abs(z) > GRID_HALF) return false;
  return tileMap[x]?.[z]?.walkable !== false;
}

function processInput(dt) {
  if (isPaused) return;
  moveCooldown -= dt;
  if (moveCooldown > 0) return;

  // Read all four directions simultaneously — allows diagonals
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

  // ── Attempt a single step and update all state if successful ─────────────
  function tryMove(tx, tz, faceDx, faceDz) {
    if (!isWalkable(tx, tz)) return false;
    grid.x = tx;
    grid.z = tz;
    playerMesh.rotation.y = Math.atan2(-faceDx, -faceDz);  // face movement direction
    coordsEl.textContent  = `${grid.x}, ${grid.z}`;
    const tile = tileMap[tx]?.[tz];
    tileInfoEl.textContent = tile ? `tile: ${tile.type}  walkable: ${tile.walkable}` : '';
    return true;
  }

  const nx = grid.x + dx;
  const nz = grid.z + dz;

  const moved = tryMove(nx, nz, dx, dz);

  if (!moved) {
    let slid = false;
    if (dx !== 0 && dz !== 0 && cornerSlidingEnabled) {
      // ── Corner slide ───────────────────────────────────────────────────
      slid = tryMove(grid.x + dx, grid.z,    dx,  0)
          || tryMove(grid.x,    grid.z + dz,   0, dz);
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

  // Idle bob only when on the ground; suppress during jump
  const bob = isGrounded ? Math.sin(t * 2.5) * 0.03 : 0;
  playerMesh.position.y = PLAYER_SIZE / 2 + playerJumpY + bob;

  // Shadow shrinks / fades as player rises
  const shadowS = Math.max(0.15, 1 - playerJumpY * 0.18);
  shadowBlob.scale.set(shadowS, 1, shadowS);
  shadowBlob.material.opacity = 0.25 * shadowS;
  shadowBlob.position.x = playerMesh.position.x;
  shadowBlob.position.z = playerMesh.position.z;

  // ── Lava glow pulse ───────────────────────────────────────────────────────
  lavaLight.intensity = 1.8 + Math.sin(t * 2.8) * 0.6;

  // ── Camera smooth orbit ───────────────────────────────────────────────────
  let diff = targetCamAngle - currentCamAngle;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  currentCamAngle += diff * (1 - Math.exp(-dt * 8));

  const camK    = 1 - Math.exp(-dt * camFollowSpeed);
  const tgtCamX = playerMesh.position.x + CAM_RADIUS * Math.cos(currentCamAngle);
  const tgtCamZ = playerMesh.position.z + CAM_RADIUS * Math.sin(currentCamAngle);
  camera.position.x += (tgtCamX - camera.position.x) * camK;
  camera.position.y  = CAM_HEIGHT;
  camera.position.z += (tgtCamZ - camera.position.z) * camK;
  camera.lookAt(playerMesh.position.x, 0, playerMesh.position.z);

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
}

// Wire slider ↔ input pairs
linkControls('s-move-delay', 'n-move-delay', 50,   300);
linkControls('s-jump-speed', 'n-jump-speed', 3,    15);
linkControls('s-gravity',    'n-gravity',    10,   40);
linkControls('s-cam-speed',  'n-cam-speed',  2,    20);
linkControls('s-zoom',       'n-zoom',       6,    18);
linkControls('s-fog',        'n-fog',        0,    0.08);

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

  const newViewSize = parseFloat(document.getElementById('n-zoom').value);
  if (newViewSize !== viewSize) {
    viewSize         = newViewSize;
    camera.left      = -viewSize * aspect;
    camera.right     =  viewSize * aspect;
    camera.top       =  viewSize;
    camera.bottom    = -viewSize;
    camera.updateProjectionMatrix();
  }

  scene.fog.density           = parseFloat(document.getElementById('n-fog').value);
  fpsEl.style.display         = document.getElementById('s-show-fps').checked     ? '' : 'none';
  compassCanvas.style.display = document.getElementById('s-show-compass').checked ? '' : 'none';
  rayArrow.visible            = document.getElementById('s-show-ray').checked;

  closeSettings();
});

document.getElementById('btn-close').addEventListener('click', closeSettings);

animate();

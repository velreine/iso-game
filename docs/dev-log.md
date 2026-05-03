# Isometric Game — Development Log

A step-by-step record of every feature added to the game, with the most important code highlighted at each stage.

---

## Table of Contents

1. [Stage 1 — Scene, Camera & Stone Terrain](#stage-1)
2. [Stage 2 — Player Cube, Arrow Key Movement & Docker](#stage-2)
3. [Stage 3 — WASD, Camera Rotation, Compass & Eye Ray](#stage-3)
4. [Stage 4 — Camera-Relative 8-Dir Movement, Jump & Lava Tiles](#stage-4)
5. [Stage 5 — FPS Counter & Player Facing Fix](#stage-5)
6. [Stage 6 — Corner Sliding & Version Overlay](#stage-6)
7. [Stage 7 — Pause Menu & Settings Panel](#stage-7)
8. [Stage 8 — Axes Helper, Labels & Orientation HUD](#stage-8)
9. [Stage 9 — Mouse Hover Raycast & Tile Highlight](#stage-9)
10. [Stage 10 — Camera Pan (Right-Click Drag)](#stage-10)
11. [Stage 11 — Click-to-Move with A\* Pathfinding](#stage-11)
12. [Stage 12 — Multi-Room Map, Walls & Wall Transparency](#stage-12)
13. [Stage 13 — Tile Elevation, Dais & Staircase](#stage-13)
14. [Stage 14 — Scroll Zoom, Debug Raycast & Zoom HUD](#stage-14)
15. [Stage 15 — Room 3 & Ramp Connection](#stage-15)
19. [Stage 19 — Editor Load Level & Manifest Discovery (v1.6.0)](#stage-19)
20. [Stage 20 — Navmesh Navigation Fix (v1.6.2)](#stage-20)
21. [Stage 21 — Viewport Axis Orientation Labels (v1.6.3)](#stage-21)
22. [Stage 22 — Per-Viewport Show Brush Edges Toggle (v1.6.4)](#stage-22)
23. [Stage 23 — editor.js Refactor: Constants, Legacy Removal, Split Batch Props (v1.6.5)](#stage-23)
24. [Stage 24 — editor.js Refactor: Entity Lookup, Prop-Row Unification, Color Helper, Binding Helpers (v1.6.6)](#stage-24)
25. [Stage 25 — editor.js Refactor: Precision Helper, Shared-Value Helper, Extract Resize Drag (v1.6.7)](#stage-25)
26. [Stage 26 — editor.js Refactor: Rename Abbreviations to Full Names (v1.6.8)](#stage-26)

---

<a name="stage-1"></a>
## Stage 1 — Scene, Camera & Stone Terrain

![Stage 1 — Isometric stone grid](screenshots/stage1-terrain.png)

### Goal
Stand up a Three.js scene with a proper isometric orthographic camera and a hand-laid stone floor.

---

### Isometric Camera

The defining choice of the whole project. An **orthographic** camera removes perspective foreshortening so tiles stay the same size across the entire grid. Positioning it at equal distances on all three world axes `(18, 18, 18)` produces the classic 45° isometric angle.

```js
const VIEW_SIZE = 10;
let aspect = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  -VIEW_SIZE * aspect,  VIEW_SIZE * aspect,  // left / right
   VIEW_SIZE,          -VIEW_SIZE,           // top / bottom
  0.1, 500                                   // near / far
);

camera.position.set(18, 18, 18);  // equal on all axes → true iso
camera.lookAt(0, 0, 0);
```

The frustum size is kept constant while `aspect` is recomputed on every window resize, so the scene stays centred on any screen.

---

### Stone Tile Terrain

Each tile is a `BoxGeometry` slightly smaller than `1 × 1` to leave a thin gap that reads as grout lines. Ten slightly-different grey tones are sampled at random so the floor looks hand-laid rather than tiled.

```js
const TILE_GAP    = 0.06;
const STONE_COLORS = [
  0x52525c, 0x4a4a58, 0x585862, 0x4e4e5a,
  0x545460, 0x5e5e68, 0x484852, 0x56565e,
  0x606068, 0x4c4c56,
];

const tileGeom = new THREE.BoxGeometry(1 - TILE_GAP, 0.22, 1 - TILE_GAP);

for (let x = -GRID_HALF; x <= GRID_HALF; x++) {
  for (let z = -GRID_HALF; z <= GRID_HALF; z++) {
    const color = STONE_COLORS[Math.floor(Math.random() * STONE_COLORS.length)];
    const tile  = new THREE.Mesh(tileGeom, new THREE.MeshLambertMaterial({ color }));
    tile.position.set(x, -TILE_THICKNESS / 2, z);
    tile.receiveShadow = true;
    scene.add(tile);
  }
}
```

---

### Lighting Setup

Three lights are layered to give the scene depth without looking washed out.

| Light | Type | Purpose |
|---|---|---|
| Ambient `0x8090b0` | `AmbientLight` | Cool blue fill, prevents pure-black shadows |
| Sun `0xffe8c0` | `DirectionalLight` + shadows | Warm key light with 2 k shadow map |
| Fill `0x4060a0` | `DirectionalLight` | Soft counter-light from the opposite corner |

```js
scene.add(new THREE.AmbientLight(0x8090b0, 1.0));

const sun = new THREE.DirectionalLight(0xffe8c0, 1.4);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
```

---

<a name="stage-2"></a>
## Stage 2 — Player Cube, Arrow Key Movement & Docker

![Stage 2 — Player on the grid](screenshots/stage2-player.png)

### Goal
Add a movable player cube and ship the whole thing as a Docker container served by nginx.

---

### Player Cube

The player is a `0.65 × 0.65 × 0.65` blue box. A small white "eye" child mesh is attached to its front face so the facing direction is always visible.

```js
const PLAYER_SIZE = 0.65;

const playerMesh = new THREE.Mesh(
  new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
  new THREE.MeshLambertMaterial({ color: 0x4a8fe2 })
);
playerMesh.position.set(0, PLAYER_SIZE / 2, 0);  // sit on top of tiles
scene.add(playerMesh);

// White eye — attached to playerMesh so it inherits rotation
const eyeMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.16, 0.08),
  new THREE.MeshLambertMaterial({ color: 0xeef0ff })
);
eyeMesh.position.set(0, 0.06, -(PLAYER_SIZE / 2 + 0.02));  // front face
playerMesh.add(eyeMesh);
```

---

### Grid-Based Movement

Logical position (`grid.x / grid.z`) is kept separate from visual position (`playerMesh.position`). The logical position snaps to integers; the visual position exponentially lerps toward it each frame, giving smooth gliding without any animation library.

```js
const grid = { x: 0, z: 0 };

// Exponential lerp — frame-rate independent
const lerpK = 1 - Math.exp(-dt * 20);
playerMesh.position.x += (grid.x - playerMesh.position.x) * lerpK;
playerMesh.position.z += (grid.z - playerMesh.position.z) * lerpK;
```

A `moveCooldown` timer prevents the player from stepping every single frame when a key is held:

```js
let moveCooldown = 0;
const MOVE_DELAY = 0.13;  // seconds between steps

function processInput(dt) {
  moveCooldown -= dt;
  if (moveCooldown > 0) return;
  // ... read keys, move grid, reset cooldown
  moveCooldown = MOVE_DELAY;
}
```

The player rotates to face the direction of travel using `Math.atan2`:

```js
playerMesh.rotation.y = Math.atan2(dx, -dz);
```

---

### Drop Shadow

A transparent `PlaneGeometry` pinned just above the tile surface fakes a soft blob shadow. During later stages it scales down as the player jumps.

```js
const shadowBlob = new THREE.Mesh(
  new THREE.PlaneGeometry(0.6, 0.6),
  new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true,
    opacity: 0.25, depthWrite: false,
  })
);
shadowBlob.rotation.x = -Math.PI / 2;
shadowBlob.position.y = 0.002;
scene.add(shadowBlob);
```

---

### Docker Setup

The game is three static files (`index.html`, `game.js`, `style.css`). `nginx:alpine` serves them with gzip and a one-day cache header. A `HEALTHCHECK` pings the server so Docker knows when the container is ready.

```dockerfile
FROM nginx:1.25-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY index.html  /usr/share/nginx/html/
COPY game.js     /usr/share/nginx/html/
COPY style.css   /usr/share/nginx/html/
COPY nginx.conf  /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

```yaml
# docker-compose.yml
services:
  iso-game:
    build: .
    container_name: iso-game
    ports:
      - "8081:80"
    restart: unless-stopped
```

To run:

```bash
docker compose up --build -d
# then open http://<your-local-ip>:8081
```

---

<a name="stage-3"></a>
## Stage 3 — WASD, Camera Rotation, Compass & Eye Ray

![Stage 3 — Camera rotation and compass](screenshots/stage3-compass.png)

### Goal
Add WASD as a second input scheme, let the player orbit the camera with Z/C/X, show a compass in the corner, and project a red direction ray from the player's eye.

---

### Camera Orbit (Z / C / X)

The camera is repositioned to orbit the player at a fixed radius in the XZ plane. A `cameraRotStep` integer (0–3) drives 90° snaps; `targetCamAngle` is the desired angle; `currentCamAngle` is the smoothed value used for rendering. Shortest-arc interpolation prevents the camera spinning the long way around.

```js
const CAM_RADIUS        = 18 * Math.SQRT2;   // same distance as (18,18,18)
const DEFAULT_CAM_ANGLE = Math.PI / 4;        // 45° → camera at NE

let cameraRotStep   = 0;
let targetCamAngle  = DEFAULT_CAM_ANGLE;
let currentCamAngle = DEFAULT_CAM_ANGLE;

// On C keypress:
cameraRotStep  = (cameraRotStep + 1) % 4;
targetCamAngle = DEFAULT_CAM_ANGLE - cameraRotStep * (Math.PI / 2);

// Each frame — shortest-arc lerp:
let diff = targetCamAngle - currentCamAngle;
while (diff >  Math.PI) diff -= 2 * Math.PI;
while (diff < -Math.PI) diff += 2 * Math.PI;
currentCamAngle += diff * (1 - Math.exp(-dt * 8));

// Orbit position:
camera.position.x = playerMesh.position.x + CAM_RADIUS * Math.cos(currentCamAngle);
camera.position.y = CAM_HEIGHT;
camera.position.z = playerMesh.position.z + CAM_RADIUS * Math.sin(currentCamAngle);
camera.lookAt(playerMesh.position.x, 0, playerMesh.position.z);
```

---

### Compass HUD

A small `<canvas>` drawn each frame in the bottom-left corner. The ring of N/E/S/W labels rotates with the camera so you always know which world direction is where. A fixed white triangle at the top marks "screen up".

```js
function drawCompass() {
  // Rotate the label ring by the current camera step
  ctx2d.save();
  ctx2d.translate(CC, CC);
  ctx2d.rotate(cameraRotStep * (Math.PI / 2));   // 0°, 90°, 180°, 270°

  for (const [lbl, a] of [['N',0],['E',π/2],['S',π],['W',-π/2]]) {
    ctx2d.fillStyle = lbl === 'N' ? '#ff5555' : 'rgba(255,255,255,0.65)';
    ctx2d.fillText(lbl, Math.sin(a) * labelR, -Math.cos(a) * labelR);
  }
  ctx2d.restore();

  // Fixed "screen up" triangle — never rotates
  ctx2d.beginPath();
  ctx2d.moveTo(CC, 4);
  ctx2d.lineTo(CC - 4, 14);
  ctx2d.lineTo(CC + 4, 14);
  ctx2d.fill();
}
```

---

### Red Eye Ray

A `THREE.ArrowHelper` is attached directly to `playerMesh`. Because it is a child, it automatically inherits the player's world position and rotation — no manual update required.

```js
const rayArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),                            // local forward = −Z
  new THREE.Vector3(0, 0.06, -(PLAYER_SIZE / 2 + 0.02)), // starts at the eye
  12,       // extends 12 world units
  0xff2222,
  0.4,      // arrowhead length
  0.14      // arrowhead width
);
playerMesh.add(rayArrow);   // ← child of player, auto-follows rotation
```

---

<a name="stage-4"></a>
## Stage 4 — Camera-Relative 8-Direction Movement, Jump & Lava Tiles

![Stage 4 — Lava area with pulsing glow](screenshots/stage4-lava.png)

### Goal
Make movement fully screen-relative (pressing ↑ moves toward the top of screen regardless of camera angle), allow diagonal tile movement, add a space-bar jump with physics, and introduce non-walkable lava tiles backed by a metadata system.

---

### Camera-Relative 8-Direction Movement

This is the most mathematically involved part of the project. The key insight comes from how Three.js `lookAt` constructs the camera's local axes.

For a camera at XZ angle α:

- **Screen right** (camera local +X) projected onto XZ = `( sin α, 0, −cos α )`
- **Screen up** (camera local +Y) projected onto XZ = `(−cos α, 0, −sin α )`

World movement is then:

```
world = ix · screen_right + (−iz) · screen_up
```

(`iz` is negated because `iz = +1` means "screen down", the opposite of screen-up.)

```js
const α    = targetCamAngle;   // always a multiple of π/4 → sin/cos = ±√2/2

const rawX =  ix * Math.sin(α) + iz * Math.cos(α);
const rawZ = -ix * Math.cos(α) + iz * Math.sin(α);

const dx = Math.round(rawX);   // snaps to −1, 0, or +1
const dz = Math.round(rawZ);
```

Because `α` is always a multiple of 45°, `sin(α)` and `cos(α)` are always `±√2/2 ≈ 0.707`, and `Math.round(0.707) = 1`. This means:

| Keys held | Screen direction | World movement (step 0) |
|---|---|---|
| W only | Up-left | `(−1, −1)` — NW diagonal |
| D only | Up-right | `(+1, −1)` — NE diagonal |
| S only | Down-right | `(+1, +1)` — SE diagonal |
| A only | Down-left | `(−1, +1)` — SW diagonal |
| W + D | Up | `(0, −1)` — North |
| W + A | Left | `(−1, 0)` — West |
| S + D | Right | `(+1, 0)` — East |
| S + A | Down | `(0, +1)` — South |

Pressing two keys combines the two diagonal vectors into a pure cardinal direction — the player gets all 8 directions from just 4 keys, and it all stays correct through every camera rotation.

---

### Jump Physics

A classic discrete-time Euler integration: each frame, gravity pulls `jumpVelocity` down; the player Y position is updated by the current velocity; when Y returns to zero the player is grounded.

```js
const JUMP_SPEED = 7.5;
const GRAVITY    = 22;

// On Space keydown (only when grounded):
if (e.code === 'Space' && isGrounded) {
  jumpVelocity = JUMP_SPEED;
  isGrounded   = false;
}

// Each frame:
if (!isGrounded) {
  jumpVelocity -= GRAVITY * dt;
  playerJumpY  += jumpVelocity * dt;
  if (playerJumpY <= 0) {
    playerJumpY  = 0;
    jumpVelocity = 0;
    isGrounded   = true;
  }
}

// Shadow shrinks / fades proportionally to height
const shadowS = Math.max(0.15, 1 - playerJumpY * 0.18);
shadowBlob.scale.set(shadowS, 1, shadowS);
shadowBlob.material.opacity = 0.25 * shadowS;
```

---

### Tile Metadata & Lava Area

Every tile is stored in `tileMap[x][z]` with a typed metadata object:

```js
// tileMap[x][z] = {
//   walkable : boolean   — false blocks movement onto this tile
//   type     : string    — 'stone' | 'lava'
//   mesh     : THREE.Mesh
// }

tileMap[x][z] = {
  walkable : !isLava,
  type     : isLava ? 'lava' : 'stone',
  mesh     : tile,
};
```

The `isWalkable()` helper checks both bounds and the metadata flag:

```js
function isWalkable(x, z) {
  if (Math.abs(x) > GRID_HALF || Math.abs(z) > GRID_HALF) return false;
  return tileMap[x]?.[z]?.walkable !== false;
}
```

Movement is gated through this check — lava tiles simply can't be entered:

```js
if (isWalkable(nx, nz)) {
  grid.x = nx;
  grid.z = nz;
} else {
  // HUD shows "tile: lava  walkable: false  ← blocked"
}
```

The lava blob is hand-placed as a `Set` of `"x,z"` keys, giving explicit authoring control over the shape:

```js
const LAVA_COORDS = new Set([
              '5,3', '6,3',
    '4,4',   '5,4', '6,4', '7,4',
'3,5','4,5', '5,5', '6,5', '7,5',
    '4,6',   '5,6', '6,6', '7,6',
              '5,7', '6,7', '7,7',
]);
```

Lava materials use `emissive` to self-illuminate even when shadowed, and a pulsing `PointLight` floats above the area:

```js
mat.emissive.setHex(0x441100);
mat.emissiveIntensity = 0.6;

// In animate():
lavaLight.intensity = 1.8 + Math.sin(t * 2.8) * 0.6;
```

---

<a name="stage-5"></a>
## Stage 5 — FPS Counter & Player Facing Fix

### Goal
Display a live frame-rate counter and fix the player's eye/ray so it points in the direction of travel instead of roughly opposite to it.

---

### FPS Counter

A pair of accumulators (`fpsAccum`, `fpsFrames`) are incremented each frame inside `animate()`. Every 0.5 s the display is flushed and the counters reset, giving a stable reading that doesn't jitter every frame.

```js
let fpsAccum  = 0;
let fpsFrames = 0;
const fpsEl = document.getElementById('fps');

// Inside animate():
fpsAccum  += dt;
fpsFrames += 1;
if (fpsAccum >= 0.5) {
  fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`;
  fpsAccum  = 0;
  fpsFrames = 0;
}
```

A `#fps` div is positioned absolute in the top-left corner to mirror the coordinates display on the right.

---

### Player Facing Direction Fix

The player's eye and `ArrowHelper` ray live in local space along the `−Z` axis. To make local `−Z` point toward world direction `(dx, dz)` after a Y-axis rotation `θ`, the correct identity is:

```
local −Z rotated by θ = (−sin θ,  0,  −cos θ)  in world XZ
```

Setting this equal to `(dx, dz)` gives `sin θ = −dx`, `cos θ = −dz`, so:

```js
// Correct ✓
playerMesh.rotation.y = Math.atan2(-dx, -dz);

// Was wrong — produces the opposite facing direction ✗
// playerMesh.rotation.y = Math.atan2(dx, -dz);
```

The one-character sign change on `dx` ensures that pressing Up faces north-west, Right faces north-east, Down faces south-east, and Left faces south-west — all matching the direction the cube actually moves.

---

<a name="stage-6"></a>
## Stage 6 — Corner Sliding & Version Overlay

### Goal
Make movement feel fluid near obstacles by automatically sliding along accessible edges, and display the current game version in the HUD.

---

### Corner Sliding

When a diagonal world move `(dx, dz)` is blocked, the game tries each axis component individually before giving up. This lets the player glide around corners without having to manually steer around them.

The logic lives inside a `tryMove` helper that both performs the move and updates all related state (rotation, HUD, coords) atomically:

```js
function tryMove(tx, tz, faceDx, faceDz) {
  if (!isWalkable(tx, tz)) return false;
  grid.x = tx;
  grid.z = tz;
  playerMesh.rotation.y = Math.atan2(-faceDx, -faceDz);
  coordsEl.textContent  = `${grid.x}, ${grid.z}`;
  const tile = tileMap[tx]?.[tz];
  tileInfoEl.textContent = tile
    ? `tile: ${tile.type}  walkable: ${tile.walkable}` : '';
  return true;
}

const moved = tryMove(nx, nz, dx, dz);

if (!moved && dx !== 0 && dz !== 0) {
  // Try keeping dx only (slide along X), then dz only (slide along Z)
  const slid = tryMove(grid.x + dx, grid.z,    dx,  0)
            || tryMove(grid.x,    grid.z + dz,   0, dz);
  if (!slid) { /* show blocked message */ }
}
```

The `||` short-circuits — if the first slide succeeds the second is never attempted. The player faces the actual slide direction, so the eye and ray remain meaningful even during a corrected move.

---

### Version Overlay

`version.txt` is a plain-text file containing just the version string (e.g. `0.6.0`). It is served by nginx alongside the other static assets and fetched once at startup:

```js
const versionEl = document.getElementById('version');
fetch('/version.txt')
  .then(r => r.text())
  .then(v => { versionEl.textContent = `v${v.trim()}`; })
  .catch(() => {});
```

The element is positioned bottom-right at low opacity so it is visible without being distracting. The `.catch` is a no-op — the label stays at `v?.?.?` if the fetch fails (e.g. during local dev without Docker).

Bumping the version is now a one-line edit to `version.txt`; Docker's volume mount means the change is live on the next browser refresh.

---

<a name="stage-7"></a>
## Stage 7 — Pause Menu & Settings Panel

### Goal
Add a pause state (P key) and a full in-game settings panel (Esc key) that lets every tunable constant be changed live — with sliders, manual number inputs, per-row reset buttons, and a global "Restore Defaults" — without reloading the page.

---

### Tunable Constants

All gameplay constants that used to be `const` were changed to `let` so the settings panel can mutate them at runtime:

```js
let viewSize            = 10;     // orthographic frustum half-size
let moveDelay           = 0.13;   // seconds between tile steps
let jumpSpeed           = 7.5;
let gravity             = 22;
let camFollowSpeed      = 8;
let cornerSlidingEnabled = true;
```

A `DEFAULTS` object stores the original values and is the single source of truth for the reset buttons:

```js
const DEFAULTS = {
  viewSize: 10, moveDelay: 130, jumpSpeed: 7.5,
  gravity: 22,  camFollowSpeed: 8, fogDensity: 0.032,
  cornerSliding: true, showFps: true, showCompass: true,
  showRay: true, showAxes: false, hoverRaycast: true,
};
```

---

### Pause State

`isPaused` is a boolean checked at the top of `processInput` and at the start of the keydown handler. P toggles it; a full-screen `#pause-overlay` div is shown/hidden via a CSS class.

```js
let isPaused = false;

function setPaused(val) {
  isPaused = val;
  pauseOverlay.classList.toggle('hidden', !isPaused);
}

// In processInput:
if (isPaused) return;
```

---

### Settings Panel Architecture

The settings panel is a plain HTML form. Each tunable setting has a `<input type="range">` and a `<input type="number">` kept in sync by `linkControls()`:

```js
function linkControls(sliderId, inputId, min, max) {
  const slider = document.getElementById(sliderId);
  const input  = document.getElementById(inputId);
  slider.addEventListener('input', () => { input.value = slider.value; });
  input.addEventListener('input',  () => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) slider.value = Math.max(min, Math.min(max, v));
  });
}
```

`syncMenuToState()` populates all controls from the live game variables whenever the menu opens, so the sliders always reflect the current state rather than stale defaults.

**Save & Apply** reads every control and applies the values immediately. The zoom change additionally calls `camera.updateProjectionMatrix()` so the viewport updates without a reload:

```js
document.getElementById('btn-save').addEventListener('click', () => {
  moveDelay      = parseFloat(document.getElementById('n-move-delay').value) / 1000;
  jumpSpeed      = parseFloat(document.getElementById('n-jump-speed').value);
  // ...
  const newViewSize = parseFloat(document.getElementById('n-zoom').value);
  if (newViewSize !== viewSize) {
    viewSize = newViewSize;
    camera.left  = -viewSize * aspect;  camera.right = viewSize * aspect;
    camera.top   =  viewSize;           camera.bottom = -viewSize;
    camera.updateProjectionMatrix();    // ← live zoom without reload
  }
  scene.fog.density = parseFloat(document.getElementById('n-fog').value);
  closeSettings();
});
```

---

### Per-Row Reset Buttons

Each settings row has a `⟳` button carrying a `data-reset` attribute naming the DEFAULTS key. A single delegated listener on the panel handles all of them:

```js
document.getElementById('settings-panel').addEventListener('click', e => {
  const btn = e.target.closest('.btn-reset');
  if (btn) applyDefault(btn.dataset.reset);
});
```

`applyDefault(key)` looks up the key in `DEFAULTS` and sets the matching controls — slider and number input together — via `setControls()`.

---

<a name="stage-8"></a>
## Stage 8 — Axes Helper, Labels & Orientation HUD

### Goal
Add an opt-in debugging gizmo that shows the X/Y/Z world axes in their classic red/green/blue colours, with legible letter labels at each tip, and a live pitch/yaw/roll readout that updates as the camera orbits.

---

### Axes Helper

Three.js provides `THREE.AxesHelper(size)` built-in. It draws three lines from the origin — X red, Y green, Z blue — each `size` units long. Hidden by default; toggled via Settings → Visual → Show Axes.

```js
const axesHelper = new THREE.AxesHelper(4);
axesHelper.visible = false;
scene.add(axesHelper);
```

---

### Sprite Labels

The axis letters are canvas-texture `THREE.Sprite` objects attached as children of `axesHelper`, so they automatically show and hide with it. Sprites always face the camera, keeping the letters readable from any orbit angle.

```js
(function addAxisLabels() {
  const specs = [
    { text: 'X', color: '#ff4444', pos: [4.6, 0,   0  ] },
    { text: 'Y', color: '#44dd44', pos: [0,   4.6, 0  ] },
    { text: 'Z', color: '#4499ff', pos: [0,   0,   4.6] },
  ];
  specs.forEach(({ text, color, pos }) => {
    const c  = document.createElement('canvas');
    c.width  = c.height = 64;
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
    axesHelper.add(sprite);   // ← child of axesHelper, hides with it
  });
})();
```

---

### Pitch / Yaw / Roll HUD

A `#orientation` div in the bottom-right shows camera orientation. Yaw tracks `currentCamAngle` live; pitch and roll are the fixed values of the isometric camera.

```js
// In animate(), only when axesHelper is visible:
if (axesHelper.visible) {
  const yawDeg   = (((currentCamAngle * 180 / Math.PI) % 360) + 360) % 360;
  const pitchDeg = Math.atan2(CAM_HEIGHT, CAM_RADIUS) * 180 / Math.PI; // ~35.3°
  orientationEl.textContent =
    `yaw   ${yawDeg.toFixed(1)}°\npitch ${pitchDeg.toFixed(1)}°\nroll  0.0°`;
  orientationEl.style.display = '';
} else {
  orientationEl.style.display = 'none';
}
```

Pitch is computed from `CAM_HEIGHT` and `CAM_RADIUS` rather than hard-coded, so if the camera elevation ever changes the display stays correct.

---

<a name="stage-9"></a>
## Stage 9 — Mouse Hover Raycast & Tile Highlight

### Goal
Cast a ray from the camera through the mouse cursor each frame to identify which tile is under the pointer. Highlight that tile visually, store it in state as `hoveredTile`, and display its metadata in the HUD.

---

### Raycaster Setup

All 289 tile meshes are collected into a flat `tileMeshes` array during grid construction. `THREE.Raycaster.setFromCamera()` handles the orthographic-camera math and intersects the list each frame.

```js
const tileMeshes = [];   // populated during tile creation loop
// tile = new THREE.Mesh(...); tileMeshes.push(tile);

const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2(Infinity, Infinity);

window.addEventListener('mousemove', e => {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('mouseleave', () => { mouse.set(Infinity, Infinity); });
```

Setting the mouse to `(Infinity, Infinity)` on `mouseleave` ensures the raycaster misses all tiles and the highlight disappears cleanly when the cursor exits the window.

---

### Per-Frame Hover Detection

Each frame the raycaster is fired. On a hit, the grid coordinates are recovered by rounding the mesh's world position (tiles sit at integer XZ coordinates).

```js
raycaster.setFromCamera(mouse, camera);
const hits = raycaster.intersectObjects(tileMeshes);

if (hits.length > 0) {
  const m  = hits[0].object;
  const tx = Math.round(m.position.x);   // tile integer coords
  const tz = Math.round(m.position.z);
  const td = tileMap[tx]?.[tz];

  hoveredTile = td ? { x: tx, z: tz, type: td.type, walkable: td.walkable } : null;
} else {
  hoveredTile = null;
}
```

---

### Tile Highlight

A single reusable `PlaneGeometry` quad is repositioned to the hovered tile each frame rather than creating a new mesh per tile. It sits 5 mm above the tile surface (`y = 0.005`) and pulses its opacity with a sine wave.

```js
const hoverHighlight = new THREE.Mesh(
  new THREE.PlaneGeometry(0.92, 0.92),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
                                 opacity: 0.25, depthWrite: false })
);
hoverHighlight.rotation.x = -Math.PI / 2;
hoverHighlight.position.y = 0.005;
hoverHighlight.visible    = false;
scene.add(hoverHighlight);

// In animate() on a hit:
hoverHighlight.position.x           = tx;
hoverHighlight.position.z           = tz;
hoverHighlight.material.color.setHex(td?.type === 'lava' ? 0xff8844 : 0xffffff);
hoverHighlight.material.opacity     = 0.18 + Math.sin(t * 5) * 0.07;
hoverHighlight.visible              = true;
```

Lava tiles receive an orange-tinted highlight to match their warm palette; stone tiles get a neutral white.

---

<a name="stage-10"></a>
## Stage 10 — Camera Pan (Right-Click Drag)

### Goal
Let the player hold right mouse button and drag to pan the camera across the world independently of the player. While panned, the player moves freely without the camera following. Pressing X re-centres the camera on the player smoothly.

---

### Focus Point Architecture

Previously the camera always orbited around `playerMesh.position`. A new `camFocusX/Z` world-space point replaces it as the orbit centre. When not panned, this point tracks the player via the same exponential lerp the camera position uses; when panned, it is frozen in world space.

```js
let camFocusX = 0, camFocusZ = 0;
let isPanMode = false;

// In animate():
if (!isPanMode) {
  camFocusX += (playerMesh.position.x - camFocusX) * camK;
  camFocusZ += (playerMesh.position.z - camFocusZ) * camK;
}

const tgtCamX = camFocusX + CAM_RADIUS * Math.cos(currentCamAngle);
const tgtCamZ = camFocusZ + CAM_RADIUS * Math.sin(currentCamAngle);
camera.lookAt(camFocusX, 0, camFocusZ);
```

The only change to the camera animation loop is substituting `camFocusX/Z` for `playerMesh.position`. In follow mode the behaviour is identical to before; in pan mode the focus is a fixed world anchor.

---

### Screen-to-World Pan Conversion

Right-drag deltas arrive in screen pixels. Converting to world units requires knowing how many world units fit across the viewport in each axis — which depends on the current orthographic frustum size — and then projecting along the camera's local XZ axes.

```js
// Pixel → world unit scale (orthographic projection)
const worldPerPxH = (viewSize * 2 * aspect) / window.innerWidth;
const worldPerPxV = (viewSize * 2) / window.innerHeight;

// Camera local axes projected onto world XZ
//   screen-right = (sin α,  0, -cos α)
//   screen-down  = (cos α,  0,  sin α)
const sx = Math.sin(currentCamAngle);
const cx = Math.cos(currentCamAngle);

// Map-style: scene moves WITH the drag
camFocusX += -dx * worldPerPxH * sx + dy * worldPerPxV * cx;
camFocusZ +=  dx * worldPerPxH * cx + dy * worldPerPxV * sx;
isPanMode = true;
```

The negation on `dx` makes the scene follow the cursor (drag right → tiles move right), consistent with map applications and Blender's viewport pan.

---

### Reset and Cursor Feedback

X already reset the camera orbit angle. It now also sets `isPanMode = false`, which causes the focus point to smoothly lerp back to the player on the next frame via the existing `camK` lerp — no special re-centre animation needed.

While in pan mode the cursor is `grab`; while actively dragging it becomes `grabbing`. A subtle amber badge reads `PAN — X to re-centre` so the player always knows the camera is decoupled.

```js
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
// (suppresses the browser right-click menu on the canvas)
```

---

<a name="stage-11"></a>
## Stage 11 — Click-to-Move with A\* Pathfinding

### Goal
Left-click any walkable tile to automatically walk the player to it using A\*. A configurable step delay lets you watch the algorithm explore tile by tile, with blue for explored tiles, red for the chosen path, and green for the destination.

---

### A\* Implementation

The algorithm uses a **min-heap priority queue** keyed on `f = g + h`, where `g` is the true cost from start and `h` is the Chebyshev heuristic (admissible for 8-direction grids). Diagonal steps cost √2 rather than 1 to produce geometrically natural paths.

```js
// Chebyshev heuristic — never overestimates on an 8-direction grid
function _h(ax, az, bx, bz) {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

const _DIRS8 = [
  [-1,-1],[0,-1],[1,-1],
  [-1, 0],       [1, 0],
  [-1, 1],[0, 1],[1, 1],
];

// Inside the search loop — diagonal steps cost √2, cardinal cost 1
const cost = (dx !== 0 && dz !== 0) ? Math.SQRT2 : 1;
const ng   = gScore.get(key) + cost;
if (ng < (gScore.get(nk) ?? Infinity)) {
  cameFrom.set(nk, key);
  gScore.set(nk, ng);
  heap.push({ x: nx, z: nz, f: ng + _h(nx, nz, gx, gz) });
}
```

The path is reconstructed by following `cameFrom` back from goal to start and reversing the result.

---

### Async Step-by-Step with Token Cancellation

The search function is `async`. It pauses for `pathfindDelay` ms after each node it pops, yielding control back to the render loop so Three.js can repaint the exploration visualisation in real time. A monotonically increasing `pfToken` integer lets any new click immediately invalidate an in-flight search:

```js
async function _aStar(sx, sz, gx, gz, token) {
  while (heap.size > 0) {
    if (pfToken !== token) return null;   // a newer search has started

    const cur = heap.pop();
    // ... process node ...
    pfExplored.add(key);

    if (pathfindDelay > 0) {
      _vizExplored();
      await new Promise(r => setTimeout(r, pathfindDelay));
      if (pfToken !== token) return null; // check again after the sleep
    }
  }
}
```

When `pathfindDelay` is 0 there are no `await` calls, so the entire search runs synchronously in a single frame — no visual step-through, but instant results.

---

### Instanced Mesh Visualisation

Three `InstancedMesh` objects share the same `PlaneGeometry(0.88, 0.88)` but have different `MeshBasicMaterial` colours. `depthTest: false` and explicit `renderOrder` values ensure they always render on top of the tile geometry in the correct stack order (explored → path → hover → destination).

```js
function _makeLayer(color, maxN, order) {
  const m = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.88, 0.88),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.5,
      depthWrite: false, depthTest: false,
    }),
    maxN
  );
  m.renderOrder = order;
  scene.add(m);
  return m;
}

const exploredLayer = _makeLayer(0x2255ff, MAX_TILES, 1);  // blue
const pathLayer     = _makeLayer(0xff2222, MAX_TILES, 2);  // red
const destLayer     = _makeLayer(0x22ff55, 1,         4);  // green
```

Each update sets instance matrices via a shared `_pfDummy` `Object3D` whose `rotation.x` is pre-set to `−π/2` so the plane lies flat on the ground.

---

### Path Following and Cancellation

Once a path is found, `processInput` checks `pfState === 'following'` each tick. It calls `tryMove` for the next waypoint, increments `pfStepIdx`, and refreshes the path visualisation so the red highlight shrinks as the player walks. Pressing any movement key calls `cancelPathfind()`, which increments `pfToken` and clears all visualisation layers.

```js
if (pfState === 'following') {
  const anyMove = held.has('ArrowUp') || /* ... */;
  if (anyMove) { cancelPathfind(); /* fall through to keyboard */ }
  else {
    const next = pfPath[pfStepIdx];
    if (tryMove(next.x, next.z, next.x - grid.x, next.z - grid.z)) {
      pfStepIdx++;
      _vizPath();   // trim walked tiles from red highlight
    }
    moveCooldown = moveDelay;
    return;
  }
}
```

---

## Controls Reference

| Key | Action |
|---|---|
| W / ↑ | Move toward screen top |
| S / ↓ | Move toward screen bottom |
| A / ← | Move toward screen left |
| D / → | Move toward screen right |
| Two movement keys | Cardinal move (N / E / S / W) |
| Space | Jump |
| C | Rotate camera 90° clockwise |
| Z | Rotate camera 90° counterclockwise |
| X | Reset camera to default angle |
| P | Toggle pause (PAUSED overlay) |
| Esc | Open / close settings panel |
| Right-click drag | Pan camera (decouples from player) |
| Left-click tile  | Pathfind and auto-walk to that tile |

---

<a name="stage-12"></a>
## Stage 12 — Multi-Room Map, Walls & Wall Transparency

### Goal
Expand the single-room stone floor into a two-room dungeon connected by a narrow corridor, wrap every room boundary in 3-D walls, and fade those walls away when the player is nearby so they never obscure the view.

---

### Room Layout

```
  Room 1  x: −8..8,  z: −8..8   (17×17 — existing)
  │
  └── Corridor  x: −1..1,  z: 9..13   (3 wide × 5 deep)
        │
        └── Room 2  x: −5..5,  z: 14..24   (11×11 — new, blue-grey palette)
```

Room 2 uses a distinct cool-toned colour set so the player immediately knows they've crossed into a different space:

```js
const ROOM2_COLORS = [
  0x374258, 0x2e3a55, 0x3a4260, 0x2c3850,
  0x404560, 0x363e58, 0x344060, 0x3c4055,
];
```

Corridor entry and exit tiles are painted with `DOOR_COLOR = 0x6a6040` (warm amber stone) to signal the transition.

---

### isWalkable Refactor

The old implementation hardcoded the Room 1 grid extents:

```js
// Before — only Room 1 worked
function isWalkable(x, z) {
  if (Math.abs(x) > GRID_HALF || Math.abs(z) > GRID_HALF) return false;
  return tileMap[x]?.[z]?.walkable !== false;
}
```

After expanding the map the check was replaced by a simple presence test:

```js
// After — any tile that exists and is walkable is reachable
function isWalkable(x, z) {
  return tileMap[x]?.[z]?.walkable === true;
}
```

A\* pathfinding now routes seamlessly across all rooms because the only authority is `tileMap`.

---

### Algorithmic Wall Generation

Rather than hand-placing walls, a single pass over `tileMap` checks each walkable tile's four cardinal neighbours. If a neighbour position has **no entry in `tileMap` at all**, a wall segment is placed on that edge. This means:

- Room boundaries get walls automatically.
- The corridor opening appears because Room 1 tiles at z = 8 have walkable corridor tiles at z = 9 — those edges are skipped.
- Lava tiles are defined in `tileMap` (just non-walkable), so their adjacent stone tiles don't get walls — the lava reads as an open-floor hazard, not a walled chamber.

```js
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
      if (tileMap[nx]?.[nz] !== undefined) continue;  // neighbour exists — no wall
      // ... create wall mesh and push to wallData
    }
  }
}
```

Two shared geometries cover both orientations (`wallGeomNS` for north/south faces, `wallGeomEW` for east/west), keeping geometry allocation low.

---

### Door Pillars

Four `0.28 × 1.8 × 0.28` stone columns are placed at the corridor mouth corners (±1.5 on X, at z = 8.5 and z = 13.5) to frame the openings visually:

```js
[
  [-1.5,  8.5], [1.5,  8.5],   // Room 1 → Corridor
  [-1.5, 13.5], [1.5, 13.5],   // Corridor → Room 2
].forEach(([px, pz]) => { /* Mesh at (px, 0.9, pz) */ });
```

---

### Per-Frame Wall Transparency

Every wall mesh gets its own `MeshLambertMaterial` with `transparent: true`. In `animate()` a tight loop checks each wall's world distance to the player and writes a new `opacity`:

```js
const px = playerMesh.position.x, pz = playerMesh.position.z;
for (const wd of wallData) {
  const dist = Math.sqrt((wd.x - px) ** 2 + (wd.z - pz) ** 2);
  const t = Math.max(0, Math.min(1,
    (dist - WALL_FADE_NEAR) / (WALL_FADE_FAR - WALL_FADE_NEAR)));
  wd.mesh.material.opacity = WALL_MIN_OPC + t * (1 - WALL_MIN_OPC);
}
```

`WALL_FADE_NEAR = 2.5` / `WALL_FADE_FAR = 4.5` means walls start fading at 4.5 units and reach minimum opacity (`0.12`) at 2.5 units — enough to always show the player cube even when pressed against a corner.

---

<a name="stage-13"></a>
## Stage 13 — Tile Elevation, Dais & Staircase

### Goal
Add a third dimension to tile navigation: tiles can have an elevation (height), the player cube smoothly follows that height, and large steps the player can't climb are blocked both from keyboard input and pathfinding.

---

### Tile Elevation Model

Each `tileMap` entry gains an optional `elevation` field — the world-Y of the tile's top surface. Tiles without it default to 0 (the existing flat floor). All downstream systems (rendering, pathfinding, movement) read this value through `tileMap[x]?.[z]?.elevation || 0`, so flat tiles need no change.

---

### Step Geometry

The core rendering challenge: a step tile must look solid — no gap between its side face and the floor below. The trick is to make the `BoxGeometry` taller than `TILE_THICKNESS` so it fills downward to the floor:

```js
// height fills from y = −TILE_THICKNESS/2 (below ground) up to y = elev (top surface)
const geom = new THREE.BoxGeometry(1 - TILE_GAP, elev + TILE_THICKNESS, 1 - TILE_GAP);

// Center the box so its top face is exactly at elev
tile.position.set(x, (elev - TILE_THICKNESS) / 2, z);
```

For `elev = 0`, this reduces to the standard tile: height = `TILE_THICKNESS`, center = `−TILE_THICKNESS/2`. For a step at `elev = 0.3`, the box is 0.52 units tall and the top face sits flush at 0.3.

---

### playerBaseY

A new variable `playerBaseY` lerps toward the current tile's elevation each frame using the same exponential lerp already used for XZ movement:

```js
const curTileElev = tileMap[grid.x]?.[grid.z]?.elevation || 0;
playerBaseY += (curTileElev - playerBaseY) * lerpK;   // lerpK = 1 − exp(−dt × 20)

playerMesh.position.y = PLAYER_SIZE / 2 + playerJumpY + bob + playerBaseY;
shadowBlob.position.y = playerBaseY + 0.002;
```

Jump physics (`playerJumpY`) remain unchanged — the jump arc is relative to `playerBaseY`, so the cube lands correctly whether it is at ground level or on the platform.

---

### Cliff-Jump Prevention

Without a guard, `isWalkable` would allow the player to step directly from a floor tile to the 0.9-unit-tall platform edge — an impossible cliff. One check in both `tryMove` and the A\* neighbour loop blocks any move where the elevation difference exceeds `MAX_STEP_HEIGHT = _STEP_H + 0.02 = 0.32`:

```js
const fromElev = tileMap[grid.x]?.[grid.z]?.elevation || 0;
const toElev   = tileMap[tx]?.[tz]?.elevation   || 0;
if (Math.abs(toElev - fromElev) > MAX_STEP_HEIGHT) return false;
```

Because the same check is in `_aStar`, the pathfinder automatically routes through the stairs rather than trying to find a shortcut over the edge.

---

### Dais Layout

```
Room 2  z: 14..24
               z=14 ──── floor
               z=15 ──── step ×3 (x: −1..1)  elev 0.3
               z=16 ──── step ×3 (x: −1..1)  elev 0.6
          z=17..21 ──── platform ×5 (x: −2..2)  elev 0.9
               z=22 ──── step ×3 (x: −1..1)  elev 0.6
               z=23 ──── step ×3 (x: −1..1)  elev 0.3
               z=24 ──── floor
```

The platform is 5 wide but the stairs are 3 wide, leaving 2 floor tiles on each side of the stairs so the player can walk around the base without accessing the top.

---

### Altar & Dais Light

An emissive dark-stone slab rests at the platform centre, accompanied by a pulsing blue-purple point light:

```js
daisLight.intensity = 1.2 + Math.sin(t * 1.5) * 0.4;
```

The slower pulse rate (1.5 Hz) contrasts with the lava light (2.8 Hz) to give each area its own atmospheric rhythm.

---

<a name="stage-14"></a>
## Stage 14 — Scroll Zoom, Debug Raycast & Zoom HUD

**Goal:** Make zoom accessible without opening Settings, add a debug tool for diagnosing raycast hit selection, and give the player always-visible feedback on the current zoom level.

### Scroll-Wheel Zoom

Mouse wheel now adjusts `viewSize` in real time (step 0.8 per tick, clamped 6–18):

```js
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  const dir = e.deltaY > 0 ? 1 : -1;
  setZoom(viewSize + dir * 0.8);
}, { passive: false });
```

The zoom slider in Settings stays in sync because `setZoom` updates the frustum centrally.

### Debug Raycast Visualisation

Settings → Visual → **Debug Raycast** draws a cyan `THREE.Line` from the orthographic ray origin to the winning hit point, a green sphere at the exact intersection, and a HUD overlay listing every tile the ray hit with its elevation, hitY, and a `◀` marker on the winner. This was built to diagnose the isometric raycast bias where a geometrically nearer floor tile behind an elevated step could incorrectly win the selection.

### `setZoom` Helper & Zoom HUD

All zoom mutations are now consolidated into one function:

```js
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
```

A `#zoom-info` label in the bottom-right corner shows the live zoom value (e.g. `zoom 10.0`). Pressing **X** now also calls `setZoom(DEFAULTS.viewSize)` so a full camera reset — angle, pan mode, and zoom — happens with one key.

---

<a name="stage-15"></a>
## Stage 15 — Room 3 & Ramp Connection

**Goal:** Add a third room to the north-east of Room 2, connected by a walkable ramp rather than a flat corridor. The ramp needed to respect the existing `MAX_STEP_HEIGHT` constraint, and wall generation needed extending to handle elevated floor tiles properly.

### Map Layout

Room 3 sits at x: 11..19, z: 12..20 at elevation 1.5 (five `_STEP_H` steps above ground). It connects to Room 2's east wall (x=5) via a five-column ramp at x: 6..10, z: 16..18. The opening in Room 2's east wall appears automatically because the ramp tiles are in `tileMap` before the wall loop runs — the same algorithmic approach used for the corridor.

### Ramp Geometry

Each ramp column rises exactly `_STEP_H` (0.3), so the step from Room 2 ground (elev 0) to the first ramp tile (elev 0.3) and every subsequent column transition is within `MAX_STEP_HEIGHT = 0.32`. The geometry reuses `_getDaisGeom`, which fills from below ground up to the exact elevation — no gap between ramp tile sides:

```js
for (let col = 0; col < (RAMP_X_MAX - RAMP_X_MIN + 1); col++) {
  const elev = _STEP_H * (col + 1);   // 0.3 → 0.6 → 0.9 → 1.2 → 1.5
  for (let z = RAMP_Z_MIN; z <= RAMP_Z_MAX; z++) {
    tileMap[x][z] = { walkable: true, type: 'ramp', elevation: elev, mesh: tile };
  }
}
```

The final ramp column (x=10) sits at elevation 1.5 — flush with Room 3's floor — so the transition is seamless.

### Elevation-Aware Wall Generation

The original wall code placed all walls at `y = WALL_HEIGHT / 2` regardless of tile elevation. This worked for the dais (no walls on dais edges) but would have placed Room 3's boundary walls floating at ground level. The fix: walls now extend from y=0 up to `elevation + WALL_HEIGHT`, with the center shifted accordingly:

```js
const tileElev = tileMap[x][z].elevation || 0;
const wallH    = tileElev + WALL_HEIGHT;
// Reuse shared geometry for ground-level tiles; new geometry for elevated ones
const geom = tileElev === 0 ? dir.geom : new THREE.BoxGeometry(
  dir.dx === 0 ? 1 - TILE_GAP : 0.1,
  wallH,
  dir.dx === 0 ? 0.1 : 1 - TILE_GAP
);
wall.position.set(x + dir.ox, wallH / 2, z + dir.oz);
```

Room 3 boundary walls are 2.4 units tall (1.5 + 0.9). The ramp side-walls step progressively from 1.2 to 2.4 units, forming natural retaining walls that rise with the ramp.

### Room 3 Lighting

A warm golden `PointLight` (0xffa030, range 18) pulses at 1.1 Hz with a phase offset from the dais light, giving each area a distinct atmospheric rhythm:

```js
room3Light.intensity = 1.2 + Math.sin(t * 1.1 + 1.2) * 0.35;
```

---

## Project Structure

```
iso-game/
├── index.html          # HTML shell — loads Three.js CDN + game.js (levels injected via manifest)
├── levels/
│   ├── manifest.json   # Level registry — id, name, file for each level
│   ├── level1.js       # The Stone Keep
│   └── level2.js       # The Stone Keep 2
├── game.js             # All game logic
├── style.css           # Fullscreen canvas + HUD styling
├── version.txt         # Current version string (e.g. 1.0.0)
├── CHANGELOG.md        # Per-version change history
├── CLAUDE.md           # Project rules for Claude (docs + versioning)
├── Dockerfile          # nginx:alpine static file server
├── docker-compose.yml  # Maps container port 80 → host 8081; host volume mounts
├── nginx.conf          # Gzip + 1-day cache headers
├── .dockerignore
└── docs/
    └── dev-log.md      # This file
```

## Stage 16 — Multi-Level Architecture (v1.4.0)

Extracted all level-specific data (tiles, lights, decoratives, portals) into `levels/level1.js` using a simple `window.LEVELS` global — no ES module changes needed, so Three.js CDN globals stay intact.

The new level engine in `game.js` exposes three functions: `buildLevel(data)` constructs the full scene from a data object, `tearDownLevel()` cleanly removes all tiles/walls/lights/decoratives by draining the `tileMeshes`, `wallData`, `decorativeMeshes`, and `levelLights` tracking arrays, and `loadLevel(id)` ties them together.

Light pulses (`base + sin(t*freq+phase)*amp`) are now driven by data in each level's `lights[]` array, replacing the three hardcoded animate() lines with a single generic loop.

A level-select overlay is shown on launch. It reads `window.LEVELS` at runtime so future levels auto-appear in the menu as their scripts are added. Portals are stubbed in the data format for Level 1 and will activate transitions in a later stage.

## Stage 17 — Room 4 & Full Loop (v1.4.1)

Added a fourth room (mossy green stone, east of Room 1) and a second z-axis ramp descending from Room 3's south face, completing a navigable loop through all rooms: Room 1 → north corridor → Room 2 → east ramp → Room 3 → south ramp → Room 4 → west opening → Room 1.

The connection between Room 1 and Room 4 requires no corridor — the wall generator skips walls wherever adjacent tiles exist in `tileMap`, so placing Room 4 at xMin:9 directly beside Room 1's xMax:8 opens a wide doorway for free.

`_lvlBuildRampRoom` was extended to support `elevationAxis: 'z'`, stepping elevation per z-row (instead of x-column). The logic unifies into a single loop parameterised by axis, keeping the x-case unchanged.

## Stage 18 — Decorative Raycast & Room 4 Fence (v1.4.2)

Extended the hover raycast to include `decorativeMeshes` alongside `tileMeshes`. Each decorative mesh now carries `userData = { kind, id, w, h, d }` stamped in `_lvlBuildDecorativeMesh`. The best-hit selection uses actual hit-point Y for decoratives (they're tall objects whose faces sit above floor level) so they naturally beat the tiles beneath them.

When the winning hit is a decorative, the `hoverHighlight` plane is rescaled to the object's footprint (`scale.set((w+0.08)/0.92, 1, (d+0.08)/0.92)`) and repositioned flush with its base. The orange pulsing overlay (`0xff8800`) distinguishes decorative hovers from tile hovers (pink). The debug HUD emits `decorative:<id>` for each decorative hit in the list.

Room 4 was expanded to xMin:9 xMax:22 zMin:-10 zMax:6. A perimeter fence is generated programmatically inside the level IIFE using `_panel`/`_post` helpers and concatenated into the decoratives array. The fence has four gaps — west (Room 1 entrance), north (Ramp 2 entrance), east and south (side exits) — with corner and gap posts marking each opening.

<a name="stage-19"></a>
## Stage 19 — Editor Load Level & Manifest Discovery (v1.6.0)

### Goal

Two workflow gaps closed: the editor had no way to load an existing level file (only a hardcoded "Load level1" button), and the game's level-select screen only ever showed one level even when multiple `.js` files existed in `levels/`.

### Editor: Load Level button

The hardcoded `btn-load-lvl1` button was replaced with a general `Load Level` button. Clicking it:

1. Fetches `levels/manifest.json` and lists all entries in a new modal.
2. On level selection, fetches the `.js` file text, evals it in an isolated scope (same sandboxing used by Import JS), and calls `_loadLevel()` with the resulting data.
3. Restores `window.LEVELS` to its previous state so the fetch does not pollute the global registry.

```js
const src = await fetch('./levels/' + entry.file).then(r => r.text());
const saved = window.LEVELS;
window.LEVELS = {};
new Function(src)();
const lvl = window.LEVELS[entry.id] || window.LEVELS[Object.keys(window.LEVELS)[0]];
window.LEVELS = saved;
_loadLevel(lvl);
```

### Level discovery via manifest.json

`levels/manifest.json` is a small file listing every available level:

```json
{
  "levels": [
    { "id": "level1", "name": "The Stone Keep",   "file": "level1.js" },
    { "id": "level2", "name": "The Stone Keep 2",  "file": "level2.js" }
  ]
}
```

`initLevelSelect()` in `game.js` is now `async`. It fetches the manifest, injects each level as a `<script>` tag (skipping any already present in `window.LEVELS`), waits for all scripts to load, then builds the button list from the fully-populated `window.LEVELS`. The hardcoded `<script src="./levels/level1.js">` tag was removed from `index.html` — level loading is now entirely manifest-driven.

```js
await Promise.all((manifest.levels || []).map(entry =>
  new Promise((resolve) => {
    if (window.LEVELS?.[entry.id]) { resolve(); return; }
    const s = document.createElement('script');
    s.src = './levels/' + entry.file;
    s.onload = resolve;
    s.onerror = () => { console.warn('failed:', entry.file); resolve(); };
    document.head.appendChild(s);
  })
));
```

Adding a new level now requires only: drop the `.js` file into `levels/` and add one line to `manifest.json`.

---

<a name="stage-20"></a>
## Stage 20 — Navmesh Navigation Fix (v1.6.2)

### Goal

Fix click-to-move so it pathfinds to the actual clicked cell on brush-based levels, and ensure non-walkable brushes (lava, pillars, altar) are correctly excluded from the navmesh.

---

### Root Cause: Mesh Center vs Hit Point

The hover raycast recovered the target cell by rounding the **mesh's world position**:

```js
// Before — broken for large brushes
const tx = Math.round(bestObj.position.x);
const tz = Math.round(bestObj.position.z);
```

For a brush like `b_main` (17×17 cells), the mesh is centered at `(0, 0)`, so every click anywhere on the main floor resolved to tile `(0, 0)` and pathfound there. The same mesh-center lookup was used in `getKey` (which ranks hits by elevation) and in the debug HUD.

The fix uses the **ray–surface intersection point** instead:

```js
// After — correct for any mesh size
const tx = Math.round(best.point.x);
const tz = Math.round(best.point.z);
```

`best.point` is the exact world coordinate where the camera ray touched the mesh. Rounding it gives the integer cell coordinate regardless of how large the brush is.

---

### Hit Ranking: `h.point.y` Instead of tileMap Lookup

`getKey` — used to pick the topmost surface when the ray passes through multiple meshes — suffered the same bug:

```js
// Before — always 0 for b_main (looked up elevation at mesh center (0,0))
const getKey = h => h.object.userData?.kind === 'decorative'
  ? h.point.y
  : (tileMap[Math.round(h.object.position.x)]?.[Math.round(h.object.position.z)]?.elevation || 0);
```

The fix is to use the actual intersection Y for every hit. For a floor brush at elevation 0 the top face is at `y = 0`; for the raised platform at elevation 0.9 the top face is at `y = 0.9`. The highest-Y hit is naturally the topmost visible surface:

```js
// After — elevation-agnostic, works for any mesh shape
const getKey = h => h.point.y;
```

---

### Non-Walkable Brush Blocking

`_bakeNav` (in `level1.js`) correctly skips non-walkable brushes. But the walkable floor brush (`b_main`) covers the same XZ footprint as the lava pit (`b_lava`) and pillar positions. Its cells were stamped walkable first, leaving those positions open to the pathfinder.

`buildLevel` now runs a second pass after the navMesh stamp that forces any cell under a non-walkable solid brush to `walkable: false`:

```js
for (const brush of (data.brushes || [])) {
  if (brush.brushClass !== 'solid' || brush.walkable) continue;
  for (let x = brush.xMin; x <= brush.xMax; x++) {
    for (let z = brush.zMin; z <= brush.zMax; z++) {
      if (tileMap[x]?.[z]) tileMap[x][z].walkable = false;
    }
  }
}
```

This correctly blocks:
- **Lava pit** (`b_lava`, x:4–7, z:4–7) — pathfinder routes around it
- **Corridor pillars** (`b_pill_*`) — the two blocked cells at z=8 funnel the path through the single open cell between them
- **Platform altar** (`b_altar`, x:0, z:19) — the altar cell is impassable; adjacent platform cells remain walkable

---

<a name="stage-21"></a>
## Stage 21 — Viewport Axis Orientation Labels (v1.6.3)

### Goal

Make it immediately obvious which world axis runs in which screen direction inside every editor viewport, without cluttering the existing UI.

### Approach

Each ortho viewport has a fixed, known camera orientation, so its axis labels can be placed with pure CSS using percentage-based `left`/`top` positions relative to the `#viewports` container. The 3D perspective view rotates freely, so its labels must be re-projected from world space every frame.

### Static labels (CSS)

Sixteen `<div class="vp-axis">` elements are inserted into `#viewports`. The base `.vp-axis` rule gives them all the same look — 10 px monospace, soft blue-white, dual text-shadow for legibility against any background — while per-ID rules snap each one to its viewport edge:

```css
.vp-axis {
  position: absolute;
  font-size: 10px;
  font-family: 'Consolas', 'Courier New', monospace;
  color: rgba(180, 220, 255, 0.70);
  pointer-events: none;
  z-index: 10;
  text-shadow: 0 0 3px #000, 0 0 6px #000;
}

/* Example — +X on the right edge of the Top view (TR quadrant) */
#ax-top-px { right: 2px; top: 25%; transform: translateY(-50%); }
```

The `#viewports` div is split 50 / 50, so each quadrant's midpoint is at 25 % or 75 % of the total height / width, making the edge-centred maths straightforward.

### Dynamic labels for the 3D viewport (JS)

Four additional divs (`ax-3d-px`, `ax-3d-nx`, `ax-3d-pz`, `ax-3d-nz`) are positioned by `_updateAxisLabels3D()`, called at the end of every `animate()` frame. The function projects fixed world-space sentinel points (±9 on each axis) through `perspCam`, converts the resulting NDC coordinates to CSS pixels within the BL viewport rect, clamps them to a 12 px inset margin, and writes `style.left` / `style.top`:

```js
function _updateAxisLabels3D() {
  const r = getViewportRect('persp');
  for (const key in _ax3d) {
    _ax3dTmp.copy(_ax3dPts[key]).project(perspCam);
    const cssX = r.x + (_ax3dTmp.x + 1) / 2 * r.w;
    const cssY = r.y + (1 - _ax3dTmp.y) / 2 * r.h;
    _ax3d[key].style.left = Math.max(r.x+12, Math.min(r.x+r.w-12, cssX)) + 'px';
    _ax3d[key].style.top  = Math.max(r.y+12, Math.min(r.y+r.h-12, cssY)) + 'px';
    _ax3d[key].style.transform = 'translate(-50%, -50%)';
  }
}
```

DOM references and `THREE.Vector3` objects are cached outside the function so the hot path allocates nothing.

<a name="stage-22"></a>
## Stage 22 — Per-Viewport Show Brush Edges Toggle (v1.6.4)

**Goal:** Let each viewport independently show or hide the `brushEdgeGroup` edge outlines that are drawn over solid brushes, with sensible defaults (on in ortho views, off in the 3D view).

### `_vpSnap` — new `showBrushEdges` key

A `showBrushEdges` boolean was added to every entry in the `_vpSnap` config object. The three ortho viewports default to `true`; the perspective viewport defaults to `false`:

```js
const _vpSnap = {
  top:   { tile: true, intersection: false, gridDepthTest: false, showBrushEdges: true  },
  front: { tile: true, intersection: false, gridDepthTest: false, showBrushEdges: true  },
  side:  { tile: true, intersection: false, gridDepthTest: false, showBrushEdges: true  },
  persp: { tile: true, intersection: false, gridDepthTest: true,  showBrushEdges: false },
};
```

### Per-frame visibility in `_renderVP`

Just before `renderer.render(helperScene, cam)`, `brushEdgeGroup.visible` is set from the snap state for the current viewport. It is restored to `true` immediately after so no other system sees it as persistently hidden:

```js
const _showEdges = _vpSnap[name]?.showBrushEdges ?? true;
brushEdgeGroup.visible = _showEdges;
renderer.render(helperScene, cam);
brushEdgeGroup.visible = true;
```

### Context menu wiring

A new `<label class="ctx-item"><input type="checkbox" id="ctx-brush-edges"> Show Brush Edges</label>` was added to the context menu in `editor.html`, positioned after the "Grid Depth Test" item. In `editor.js` the DOM reference, `_showCtxMenu` state sync, and `change` event listener mirror the existing pattern for the other snap toggles:

```js
const _ctxBrushEdges = document.getElementById('ctx-brush-edges');
// inside _showCtxMenu:
_ctxBrushEdges.checked = _vpSnap[vp].showBrushEdges;
// event listener:
_ctxBrushEdges.addEventListener('change', () => {
  if (_ctxVP) _vpSnap[_ctxVP].showBrushEdges = _ctxBrushEdges.checked;
});
```

---

<a name="stage-23"></a>
## Stage 23 — editor.js Refactor: Constants, Legacy Removal, Split Batch Props (v1.6.5)

### Goal

Reduce noise and dead weight in `editor.js` across four concrete areas: named constants for repeated magic numbers, removal of the legacy `decoratives`/`lights` code paths, elimination of elevated-tile composite string IDs, and splitting the monolithic `_showBatchProps` into focused helpers.

### Named constants (item 8)

Two constants added at the top of the file replace all inline numeric literals:

```js
const SELECTION_COLOR    = 0xffcc00;  // selection highlight / handle corners
const DEFAULT_FACE_COLOR = 0x808080;  // default brush face / entity colour
```

`SELECTION_COLOR` replaces three occurrences (`roomBoundsBox`, `BoxHelper`, and the 12 corner entries in `HANDLE_COLOR`). `DEFAULT_FACE_COLOR` replaces every `0x808080` in brush face defaults, batch palette helpers, and `_tcol`/`_hex` renderers.

### Legacy decoratives / lights removal (item 6)

After the migration code in `_loadLevel` was strengthened to always run (previously it skipped if `ES.entities` was already populated), the legacy arrays are guaranteed empty after every load. With that invariant in place:

- The two `forEach` render calls in `rebuildLevel()` were removed.
- All `'decor'` and `'light'` branches were removed from: `_finishMarquee`, `_moveSelection`, `_startMoveDrag`, `_applyMoveDelta`, `_duplicateSelection`, `_deleteSelected`, `_showPropsForSelection`, `_showProps`, `_bindProps`, `_showBatchProps` (both HTML and handler sections), `_getItemDisplay`, `_refreshLayersList` allItems, and the Ctrl+A handler.
- The dead `_placeDecor()` and `_placeLight()` functions were removed.

### Elevated tile composite IDs (item 7)

Elevated tiles previously lacked a proper `id` field — selection used the string `"${x},${z}"` as a surrogate. This required `.split(',').map(Number)` parsing in five separate locations. The fix:

```js
// _loadLevel: assign IDs to tiles that predate this change
ES.elevatedTiles = (lvl.elevatedTiles || []).map(et =>
  et.id ? et : { ...et, id: _nextId('elev') }
);
// _buildElevatedTile: expose the id in userData
mesh.userData = { kind:'elevated', id:et.id, x:et.x, z:et.z, ... };
```

All composite-ID references in `_findMeshById`, `_deleteSelected`, `_finishMarquee`, `_showPropsForSelection`, `_refreshLayersList`, and Ctrl+A were replaced with direct `et.id` lookups.

### Splitting `_showBatchProps` (item 5)

The 187-line function mixed three concerns. It is now three functions:

```js
function _buildBatchHTML(kinds, items, n)   // → HTML string, no side effects
function _bindBatchHandlers(kinds, items)    // → wires DOM listeners
function _showBatchProps(kinds, items, n) {  // thin orchestrator
  propsContent.innerHTML = _buildBatchHTML(kinds, items, n);
  propsContent.querySelectorAll('[data-ind="1"]').forEach(el => { el.indeterminate = true; });
  _bindBatchHandlers(kinds, items);
}
```

Each of `_buildBatchHTML` and `_bindBatchHandlers` defines its own local helper closures (`shared`/`bnum`/`bcol`/`bsel` and `bBN`/`bBNInt`/`bBC`/`bBS` respectively) so neither leaks state into the other.

---

<a name="stage-24"></a>
## Stage 24 — editor.js Refactor: Entity Lookup, Prop-Row Unification, Color Helper, Binding Helpers (v1.6.6)

### Goal

Continue the `editor.js` cleanup started in Stage 23 across four more items: a single entity-lookup helper to eliminate repeated per-kind `.find()` chains, a unified prop-row builder replacing four near-identical template strings, consistent color-to-hex conversion via the existing `_colorToHex` constant, and module-level input-binding helpers to replace locally-redefined `bN`/`bC` closures in three prop panels.

### `_getEntityByKind` (item 1)

All selection-driven code previously repeated the same five-branch `.find()` pattern. A single helper now owns those lookups:

```js
function _getEntityByKind(kind, id) {
  if (kind==='room')       return ES.rooms.find(r=>r.id===id)||null;
  if (kind==='standalone') return ES.standaloneTiles.find(t=>t.id===id)||null;
  if (kind==='elevated')   return ES.elevatedTiles.find(e=>e.id===id)||null;
  if (kind==='brush')      return ES.brushes.find(b=>b.id===id)||null;
  if (kind==='entity')     return ES.entities.find(e=>e.id===id)||null;
  if (kind==='nav')        return ES.navMesh.find(c=>c.id===id)||null;
  return null;
}
```

Used in `_startMoveDrag`, `_applyMoveDelta`, `_moveSelection`, `_duplicateSelection`, `_showPropsForSelection`, and `_getItemDisplay` — replacing ~25 inline lookup chains.

### `_propRow` unified template builder (item 2)

The four template helpers (`_tr`, `_tn`, `_tsel`, `_tcol`) generated nearly identical `<div class="prop-row">` markup. They are now thin wrappers over a single function:

```js
function _propRow(l, id, v, type='text', opts=null, step=1) {
  let input;
  if      (type==='select') input=`<select id="${id}">...</select>`;
  else if (type==='color')  input=`<input type="color" id="${id}" value="${_colorToHex(v)}">`;
  else if (type==='number') input=`<input type="number" id="${id}" value="${v||0}" step="${step}">`;
  else                      input=`<input type="text" id="${id}" value="${v||''}">`;
  return `<div class="prop-row"><label>${l}</label>${input}</div>`;
}
const _tr  = (l,id,v)      => _propRow(l, id, v);
const _tn  = (l,id,v,s=1)  => _propRow(l, id, v, 'number', null, s);
const _tsel= (l,id,v,opts) => _propRow(l, id, v, 'select', opts);
const _tcol= (l,id,v)      => _propRow(l, id, v, 'color');
```

### `_colorToHex` rollout (item 3)

The `_colorToHex` helper added to the constants block is now used everywhere a hex color string is needed: inside `_propRow` for color inputs, `bcol` in `_buildBatchHTML`, face-color `fHex` in the brush batch loop, palette swatch rendering in `_buildBatchHTML` and `_palRows`, and `_showBrushProps` (which previously defined its own identical `_hex` local).

### Module-level binding helpers (item 4)

Three prop panels each defined a local `bN` / `bC` closure with the same shape. Two module-level helpers replace them all:

```js
function _bindNumField(id, obj, field, afterChange=null, int=false) {
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('change', () => { obj[field]=int?parseInt(el.value):parseFloat(el.value); afterChange?.(); });
}
function _bindColorField(id, obj, field, afterChange=null) {
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('change', () => { obj[field]=parseInt(el.value.replace('#',''),16); afterChange?.(); });
}
```

Call sites pass the target object and field directly. `_showBrushProps` supplies `afterBrush = () => { rebuildLevel(); _updateHandles(brush.id,'brush'); }` as the callback; the nav and entity panels pass `() => rebuildLevel()`.

---

<a name="stage-25"></a>
## Stage 25 — editor.js Refactor: Precision Helper, Shared-Value Helper, Extract Resize Drag (v1.6.7)

### Goal

Three more targeted cleanups in `editor.js`: a micro-helper to eliminate repeated float-precision casts, a module-level shared-value helper to de-duplicate the batch HTML builder, and extraction of the 50-line resize-drag dispatch from `_onMouseMove` into its own function.

### `_f2` precision helper (item 10)

The pattern `parseFloat(v.toFixed(2))` appeared 8 times across resize drag, move drag, and `_applyMoveDelta`. A one-liner constant eliminates all of them:

```js
const _f2 = v => parseFloat(v.toFixed(2));
```

All 8 call sites now read `_f2(y)`, `_f2(wp.y)`, `_f2(wp.y - worldStart.y)`, etc.

### `_getSharedValue` batch helper (item 9)

`_buildBatchHTML` was the only caller of its local `shared` closure. Promoting it to a named module-level function makes the intent explicit and removes it from the closure:

```js
function _getSharedValue(items, field) {
  const vals=items.map(i=>i.data[field]); return vals.every(v=>v===vals[0])?vals[0]:null;
}
```

The local binding inside `_buildBatchHTML` becomes a one-liner:
```js
const shared = field => _getSharedValue(items, field);
```

### Extracting `_handleResizeDrag` (item 11)

The resize-handle dispatch in `_onMouseMove` was a 50-line, four-branch block covering the XZ top-view handles, the Y edge handles, the XY front-view corners, and the ZY side-view corners. Extracted to:

```js
function _handleResizeDrag(cx, cy, vp) {
  const o=_dragHandle.obj, ht=_dragHandle.type;
  if ([...XZ handles...].includes(ht)) { /* top-view */ rebuildLevel(); }
  else if (['yMin','yMax'].includes(ht)) { /* y edges */ rebuildLevel(); }
  else if ([...XY handles...].includes(ht)) { /* front-view */ rebuildLevel(); }
  else if ([...ZY handles...].includes(ht)) { /* side-view */ rebuildLevel(); }
}
```

`_onMouseMove` now opens with a single guarded call:

```js
if (_dragHandle && mouseButtons.left) { _handleResizeDrag(cx, cy, vp); return; }
```

The function shrinks from ~136 to ~85 lines, and the resize logic is independently readable.

---

## Stage 26 — editor.js Refactor: Rename Abbreviations to Full Names (v1.6.8) {#stage-26}

**Goal:** Replace all abbreviated identifiers in named functions and event handlers with self-documenting names. Anonymous arrow-function parameters (`l`, `v`, `opts`, `o`, `i`, etc.) are left short per project convention.

### Module-level variables

| Old name | New name |
|---|---|
| `activeVP` | `activeViewport` |
| `_lastHoverVP` | `_lastHoverViewport` |
| `_ctxVP` | `_ctxViewport` |

### Coordinate and viewport utilities

- `snapGrid(coord, vp)` → `snapGrid(coord, viewport)`
- `getViewportRect(vp)` → `getViewportRect(viewport)`
- `getViewportAt(cx, cy)` → `getViewportAt(mouseX, mouseY)`
- `toClip(vp, cx, cy)` → `toClip(viewport, mouseX, mouseY)`
- `topToWorld` / `frontToWorld` / `sideToWorld` → `(mouseX, mouseY)` params
- `_worldYFromView(cx, cy, vp)` → `_worldYFromView(mouseX, mouseY, viewport)`
- `worldToCSS(wx, wy, wz, vp)` → `worldToCSS(worldX, worldY, worldZ, viewport)`; inner `v` (projected Vector3) → `projected`

### Event handlers

- `contextmenu`: `vp` → `viewport`
- `mousedown`: `cx`/`cy` → `mouseX`/`mouseY`
- `mousemove`: `cx`/`cy` → `mouseX`/`mouseY`, `dx`/`dy` → `deltaX`/`deltaY`, `mx`/`my` → `movementX`/`movementY`
- `wheel`: `vp` → `viewport`
- `keydown`: `vp` → `viewport`

### Named function parameter renames

| Function | Old params | New params |
|---|---|---|
| `_renderVP` | `name, cam` | `viewportName, camera` |
| `_showCtxMenu` | `vp, sx, sy` | `viewport, screenX, screenY` |
| `_setVPHighlight` | `vp` (inner `n`) | `viewport` (inner `name`) |
| `_onLeftDown` | `cx, cy, ctrl` | `mouseX, mouseY, ctrl` |
| `_handleResizeDrag` | `cx, cy, vp` | `mouseX, mouseY, viewport` |
| `_onMouseMove` | `cx, cy, dx, dy` | `mouseX, mouseY, deltaX, deltaY` |
| `_startMoveDrag` | `wp, vp` | `worldPos, viewport` |
| `_finishMarquee` | `s, e, vp, add` | `cssStart, cssEnd, viewport, additive` |
| `_showDrawRect` | `v` | `visible` |
| `_bindNumField` | `…, int` | `…, asInteger` |
| `_floorTile` | inner `ud` | `userData` |

### Local variable renames inside function bodies

- `ht` → `handleType` (in drag/move handlers)
- `ud` → `userData` (in raycast handlers and `_onLeftDown`)
- `wp` → `worldPos` (in drag and toggle functions)
- `ps` → `panScale` (in `_onMouseMove`)
- `hoverVP` → `hoverViewport`, `dvp` → `dragViewport` (in `_onMouseMove`)
- `elev` → `elevation`, `ht` → `boundsHeight` (in `_updateRoomBoundsBox`)
- `cx`/`cy` → `clampedX`/`clampedY` (in `_updateAxisLabels3D`)
- `o` → `obj` (in `_handleResizeDrag`)
- `sx`/`sz`/`sy` → `snappedX`/`snappedZ`/`snappedY` (in `_handleResizeDrag`)

### Example: `_renderVP` before and after

```js
// Before
function _renderVP(name, cam, isLive) {
  const r = getViewportRect(name);
  renderer.render(scene, cam);
  const _axesToHide = _vpHideAxes[name] || [];
  const _gridVis = name === 'persp' ? [...] : ({...}[name] || [...]);
  const _gdt = _vpSnap[name]?.gridDepthTest ?? false;
  renderer.render(helperScene, cam);
}

// After
function _renderVP(viewportName, camera, isLive) {
  const r = getViewportRect(viewportName);
  renderer.render(scene, camera);
  const _axesToHide = _vpHideAxes[viewportName] || [];
  const _gridVis = viewportName === 'persp' ? [...] : ({...}[viewportName] || [...]);
  const _gdt = _vpSnap[viewportName]?.gridDepthTest ?? false;
  renderer.render(helperScene, camera);
}
```

### Example: `_updateAxisLabels3D` clamp variables

```js
// Before
const cx = Math.max(xMin, Math.min(xMax, cssX));
const cy = Math.max(yMin, Math.min(yMax, cssY));
_ax3d[key].style.left = cx + 'px';
_ax3d[key].style.top  = cy + 'px';

// After
const clampedX = Math.max(xMin, Math.min(xMax, cssX));
const clampedY = Math.max(yMin, Math.min(yMax, cssY));
_ax3d[key].style.left = clampedX + 'px';
_ax3d[key].style.top  = clampedY + 'px';
```


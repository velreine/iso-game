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

---

## Project Structure

```
iso-game/
├── index.html          # HTML shell — loads Three.js CDN + game.js
├── game.js             # All game logic
├── style.css           # Fullscreen canvas + HUD styling
├── version.txt         # Current version string (e.g. 0.8.0)
├── CHANGELOG.md        # Per-version change history
├── CLAUDE.md           # Project rules for Claude (docs + versioning)
├── Dockerfile          # nginx:alpine static file server
├── docker-compose.yml  # Maps container port 80 → host 8081; host volume mounts
├── nginx.conf          # Gzip + 1-day cache headers
├── .dockerignore
└── docs/
    └── dev-log.md      # This file
```

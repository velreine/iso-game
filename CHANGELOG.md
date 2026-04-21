# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [1.2.2] - 2026-04-21

### Added
- **Scroll-wheel zoom** — mouse wheel adjusts `viewSize` (6–18) in real time
  without opening the Settings menu; step size 0.8 per tick, zoom slider stays
  in sync when Settings is next opened
- **Debug Raycast mode** (Settings → Visual → Debug Raycast) — when enabled:
  - A cyan `THREE.Line` is drawn from the orthographic ray origin to the selected
    hit point each frame
  - A green sphere marks the exact intersection point
  - A HUD overlay lists every tile the ray hit: tile coords, elevation, hitY,
    and a `◀` marker on the winning hit

---

## [1.2.1] - 2026-04-21

### Fixed
- **Hover raycast tile selection** — replaced `hits[0]` (closest along the ray) with an
  elevation-first comparison: the hit whose tile has the highest `elevation` wins; ties
  are broken by the highest intersection-point Y. This reliably picks the visually topmost
  tile even when an isometric ray is geometrically closer to a floor tile behind an
  elevated step
- **Altar tile** — `tileMap[0][19].walkable` set to `false` so the space under the altar
  slab is not selectable or navigable

---

## [1.2.0] - 2026-04-21

### Added
- **Tile elevation system** — `tileMap` entries now carry an optional `elevation` field
  (world-Y of the tile's top surface); tiles without it default to 0
- **`playerBaseY`** — a new state variable that lerps toward the current tile's elevation
  each frame; `playerMesh.position.y` is now `PLAYER_SIZE/2 + playerJumpY + bob + playerBaseY`,
  so the player cube smoothly rises and descends as it crosses steps
- **Raised dais in Room 2** — a 5×5 platform at elevation 0.9 (x: −2..2, z: 17..21)
  with matching cool-blue stone geometry; stairs of 3 tiles wide on both the north
  (z: 15..16) and south (z: 22..23) faces, each step rising 0.3 units
- **Step geometry** — dais tiles use a taller `BoxGeometry` whose bottom sits at
  `y = −TILE_THICKNESS/2` and whose top surface sits at exactly `elevation`, so
  the step side-faces are always solid with no gap to the floor below
- **Altar** — a dark emissive stone slab (1.8 × 0.45 × 0.85) resting on the platform
  centre at (0, 1.125, 19)
- **Dais point light** — a soft blue-purple `PointLight` above the altar that pulses
  gently (`1.2 ± 0.4` intensity at 1.5 Hz)
- **Cliff-jump prevention** — `tryMove` and the A\* neighbour loop both reject moves
  where `|toElevation − fromElevation| > MAX_STEP_HEIGHT (0.32)`; the staircase is
  the only route onto (or off) the platform, and the pathfinder respects this
- Shadow blob `position.y` tracks `playerBaseY` so it always rests on the tile surface

---

## [1.1.0] - 2026-04-20

### Added
- **Second room** — a cooler-toned 11×11 stone room (Room 2, x: −5..5, z: 14..24)
  using a distinct blue-grey palette to visually contrast with Room 1
- **Connecting corridor** — 3 tiles wide, 5 tiles deep (x: −1..1, z: 9..13)
  with warm-tinted **door tiles** at each end (z = 9 and z = 13) signalling the transitions
- **Algorithmic wall generation** — for every walkable tile, a wall segment is placed
  on any edge that borders empty space; walls are only generated at world boundaries
  (not between adjacent rooms), so the corridor openings appear naturally with no
  special-case code
- **Door pillars** — four decorative stone columns (0.28 × 1.8 × 0.28) flank the
  corridor openings, one at each side of both the Room 1 and Room 2 entrances
- **Wall transparency** — each frame every wall's opacity is computed from its
  distance to the player (`WALL_FADE_NEAR = 2.5`, `WALL_FADE_FAR = 4.5`,
  `WALL_MIN_OPC = 0.12`) so nearby walls fade out, keeping the player always visible

### Changed
- `isWalkable` — removed the old `GRID_HALF` bounds check; multi-room reachability
  is now determined purely by `tileMap[x]?.[z]?.walkable === true`
- `MAX_TILES` — raised from 289 to 500 to cover all pathfinding visualisation
  instances across both rooms and corridor
- Sun shadow camera frustum expanded to ±35 to cover the full two-room map

---

## [1.0.0] - 2026-04-21

### Added
- **Click-to-move** — left-click any walkable tile to pathfind to it; the cube
  automatically walks the computed path one step per `moveDelay`
- **A\* pathfinding** — min-heap priority queue, 8-directional movement,
  diagonal cost √2, Chebyshev heuristic; handles the full 17×17 grid
- **Step-by-step visualisation** with configurable delay:
  - **Blue** — tiles explored by A* (the closed set, updated each step)
  - **Red** — the planned path from current position to goal
  - **Green** — the destination tile
  - Three `InstancedMesh` layers with `depthTest:false` + `renderOrder` so
    they always render on top of tile geometry in the correct stack order
- **Pathfinding delay slider** (0–500 ms, default 30 ms) — set to 0 for
  instant pathfinding, or increase to watch A* explore tile by tile
- **Cancel on manual move** — pressing any movement key while following a
  path cancels it immediately
- **Token-based cancellation** — clicking a new tile while A* is still
  searching safely aborts the previous search
- **Settings section "Pathfinding"**: Step Delay slider + Click to Move,
  Show Path, Show Destination, Show Exploration checkboxes (all with ⟳ reset)

### Changed
- `tryMove` hoisted to module scope so pathfinding can call it directly

---

## [0.9.0] - 2026-04-19

### Added
- **Camera pan** — hold right mouse button and drag to pan the camera in any
  direction; the camera orbits the panned focus point rather than the player
- **Player decoupling** — while panned, the player moves freely without the
  camera following; the camera stays locked on the panned world position
- **Smooth re-centre** — pressing X resets camera angle (existing) and also
  cancels pan mode, smoothly re-centring on the player via the existing lerp
- **Pan indicator** — a subtle amber `PAN — X to re-centre` badge appears at
  the centre of the screen while the camera is decoupled from the player
- **Cursor feedback** — cursor changes to `grab` when panned, `grabbing`
  while dragging; right-click context menu suppressed on the canvas

### Changed
- HUD hint updated to show `RMB  Pan`
- Camera orbit now always uses `camFocusX/Z` world point instead of player
  position directly, enabling clean pan / follow mode switching

---

## [0.8.0] - 2026-04-19

### Added
- **Hover raycast** — `THREE.Raycaster` casts from the camera through the mouse
  cursor each frame against all tile meshes (the "ceiling-to-floor" ray)
- **Tile highlight** — a `PlaneGeometry` quad repositions to whichever tile is
  under the cursor; white for stone tiles, orange-tinted for lava; pulses gently
- **`hoveredTile` state** — `{ x, z, type, walkable }` updated every frame;
  cleared when the cursor leaves the window
- **Hover info HUD** — `#hover-info` overlay (top-right, below tile-info) shows
  grid coords, tile type, and walkable status for the hovered tile
- **Settings toggle** — Settings → Visual → Hover Raycast (on by default);
  disabling hides the highlight and clears the HUD

---

## [0.7.3] - 2026-04-19

### Added
- **Axis labels on axes helper** — canvas-texture sprites show `X` (red),
  `Y` (green), `Z` (blue) at the tip of each arm; always face the camera;
  hide/show with the axes helper toggle
- **Pitch / Yaw / Roll HUD** — small readout in the bottom-right that appears
  only when the axes helper is visible; yaw updates live as the camera orbits,
  pitch shows the fixed isometric elevation (~35.3°), roll is always 0°

---

## [0.7.2] - 2026-04-19

### Added
- **Axes helper** — `THREE.AxesHelper` placed at world origin showing X (red),
  Y (green), and Z (blue) arms, each 4 units long; toggleable via
  Settings → Visual → Show Axes (off by default)

---

## [0.7.1] - 2026-04-19

### Added
- **Per-setting reset buttons** — each settings row has a small `⟳` button that
  restores only that value to its default without touching anything else
- **Restore Defaults button** — resets all settings controls to their defaults
  at once (bottom-left of the settings panel)

---

## [0.7.0] - 2026-04-19

### Added
- **Pause (P key)** — pressing P freezes all game logic and shows a full-screen
  `PAUSED` overlay with a dim backdrop; pressing P again resumes
- **Settings menu (Esc key)** — opens a styled panel with six tunable sliders,
  each paired with a manual number input for precise values:
  - *Move Delay (ms)* — time between steps (50–300 ms)
  - *Jump Speed* — initial vertical velocity (3–15)
  - *Gravity* — downward acceleration (10–40)
  - *Camera Follow Speed* — exponential-lerp constant (2–20)
  - *Zoom* — orthographic frustum half-size (6–18)
  - *Fog Density* — exponential fog density (0–0.08)
- **Settings toggles** — four checkboxes: Corner Sliding, Show FPS,
  Show Compass, Show Eye Ray
- **Save & Apply** — applies all settings live (no page reload); zoom change
  calls `camera.updateProjectionMatrix()` immediately
- **HUD hint** updated to mention P = Pause and Esc = Settings

---

## [0.6.0] - 2026-04-19

### Added
- **Corner sliding** — when a cardinal/diagonal move is blocked, the game
  automatically tries each axis component in order so the player glides
  around obstacle edges instead of stopping dead
  (e.g. West blocked → try NW slide, then SW slide)
- **Version overlay** — `version.txt` is fetched at startup and rendered
  as a small `v0.6.0` label in the bottom-right corner of the HUD
- **Project CLAUDE.md** — rules requiring dev-log, changelog, and version
  bump on every batch of changes
- **`CHANGELOG.md`** — this file; retroactively covers all prior versions

### Changed
- `docker-compose.yml` now mounts `game.js`, `style.css`, `index.html`, and
  `version.txt` as host volumes so edits are live on browser refresh (no
  rebuild required after the initial `--build`)
- `Dockerfile` updated to `COPY version.txt`

---

## [0.5.0] - 2026-04-19

### Added
- **FPS counter** — top-left HUD overlay, updated every 0.5 s

### Fixed
- **Player facing direction** — rotation formula corrected from
  `Math.atan2(dx, -dz)` to `Math.atan2(-dx, -dz)` so the eye and red ray
  point in the actual direction of travel across all 8 movement directions

---

## [0.4.0] - 2026-04-19

### Added
- **Camera-relative 8-direction movement** — single arrow/WASD key produces a
  world-diagonal step; two keys produce a world-cardinal step; all directions
  stay correct through every camera rotation
- **Jump** — Space bar launches the player with Euler-integrated physics
  (`JUMP_SPEED = 7.5`, `GRAVITY = 22`); shadow blob shrinks and fades
  proportionally to height
- **Lava tile cluster** — hand-placed `LAVA_COORDS` Set; lava tiles use
  emissive material and a pulsing `PointLight`
- **Tile metadata system** — every tile stored as
  `{ walkable, type, mesh }` in `tileMap[x][z]`
- **Tile info HUD** — shows `tile: <type>  walkable: <bool>` (and `← blocked`
  when movement is denied)

---

## [0.3.0] - 2026-04-19

### Added
- **Camera orbit** — Z rotates 90° CCW, C rotates 90° CW, X resets; smooth
  shortest-arc interpolation via exponential lerp
- **WASD** as a second movement input scheme (mirrors arrow keys)
- **Compass HUD** — bottom-left canvas; N/E/S/W label ring rotates with the
  camera; fixed white triangle marks screen-up
- **Red eye ray** — `THREE.ArrowHelper` child of `playerMesh`; automatically
  follows player rotation; 12-unit length

---

## [0.2.0] - 2026-04-19

### Added
- **Player cube** — `0.65 × 0.65 × 0.65` steel-blue box with white eye
  indicator on the front face
- **Arrow-key movement** — grid-based logical position (`grid.x / grid.z`)
  with exponential lerp smoothing toward `playerMesh.position`
- **Move cooldown** — `MOVE_DELAY = 0.13 s` prevents uncontrolled rapid steps
- **Drop-shadow blob** — transparent `PlaneGeometry` that scales during jump
- **Docker** — `nginx:1.25-alpine` container serving static files on port 8081;
  healthcheck via `wget`

---

## [0.1.0] - 2026-04-19

### Added
- **Three.js r128 scene** — `WebGLRenderer` with antialiasing, PCFSoft shadow maps
- **Isometric orthographic camera** — positioned at `(18, 18, 18)` for a true
  45° iso angle; frustum resizes on window resize
- **Stone tile floor** — 17 × 17 grid (`GRID_HALF = 8`); `BoxGeometry` with
  `TILE_GAP = 0.06` gap; 10 random grey tones give a hand-laid look
- **Three-light rig** — ambient (`0x8090b0`) + directional sun (`0xffe8c0`,
  2 k shadow map) + fill light (`0x4060a0`)
- **Exponential fog** — `FogExp2` density `0.032`
- **nginx.conf** — gzip compression + 1-day `Cache-Control` header

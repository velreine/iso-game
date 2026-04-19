# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

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

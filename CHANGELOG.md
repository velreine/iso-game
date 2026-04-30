# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [1.6.1] - 2026-04-30
### Fixed
- **CORS / `file://` error** — all three `fetch()` calls that read level data now use `<script>` tag injection or `window.LEVEL_MANIFEST` instead:
  - `levels/manifest.json` (required `fetch`) → `levels/manifest.js` (sets `window.LEVEL_MANIFEST`), loaded as a plain `<script>` tag in `index.html` and `editor.html`
  - `game.js` `initLevelSelect`: replaced `fetch('./levels/manifest.json')` with direct read of `window.LEVEL_MANIFEST`
  - `editor.js` Load Level modal: replaced `fetch` of manifest and `fetch`+`new Function` of level file text with script-tag injection; works under both `file://` and `http://`

---

## [1.6.0] - 2026-04-30
### Added
- **Editor: Load Level button** — replaces the old "Load level1" hardcoded button; opens a modal that reads `levels/manifest.json`, lists all available levels by name, then fetches and evals the selected `.js` file before calling `_loadLevel()` to rebuild the scene
- **Level discovery via `levels/manifest.json`** — a JSON manifest lists every level by `id`, `name`, and `file`; `initLevelSelect()` in `game.js` is now async and fetches the manifest on startup, injects each level script dynamically, then populates the level-select screen — adding a new level now only requires dropping its `.js` file in `levels/` and adding one entry to `manifest.json`
- `levels/manifest.json` created with entries for `level1` (The Stone Keep) and `level2` (The Stone Keep 2)
### Changed
- `index.html` no longer hard-codes `<script src="./levels/level1.js">`; all level loading goes through the manifest

## [1.5.0] - 2026-04-29
### Added
- **Entity system** — unified `● Entity` tool (`E` key) replaces the old Decor, Light, and Spawn tools; click anywhere in the TOP view to open the Place Entity dialog with a type selector (`decor` / `light` / `spawn`) and type-specific fields
  - **decor**: box-shaped decorative prop with W/H/D and color
  - **light**: point light indicator sphere with color, intensity, and distance; renders as a range wireframe in the editor
  - **spawn**: single player spawn point — replaces any previous spawn; the green sphere moves accordingly
- Entities are fully selectable, moveable (drag / arrow keys), duplicatable (Ctrl+D), deleteable, and group-aware
- Entity properties editable in the Properties panel; type can be changed post-placement
- Entities serialized as `entities[]` in the level file; `playerStart` is automatically derived from the spawn entity on export
- Backward-compatible import: levels exported with old `decoratives[]`/`lights[]` arrays automatically migrate to the new `entities[]` format on load; legacy rooms/elevated tiles from old levels still render correctly
- game.js updated with `_lvlBuildEntity()` — decor entities render as `MeshLambertMaterial` boxes; light entities add a `THREE.PointLight` to the scene; spawn entities set the player start position
### Removed
- **Room**, **Tile**, **Elevated**, **Lava**, **Decor**, **Light**, **Spawn** toolbar buttons — all geometry is now built with brushes; old level data for these types still loads and renders for backward compatibility
- Room-creation dialog and Elevated-tile dialog removed from HTML; no new rooms or elevated tiles can be created in the editor (existing ones remain selectable and editable)

## [1.4.9] - 2026-04-29
### Added
- **Groups / directories** in the Objects panel: select items then press **Ctrl+G** (or the ⊞ button) to group them into a named, collapsible directory entry
  - Click a group header to select all its members (Ctrl+click adds to existing selection); all members light up in both the viewport and the panel
  - Double-click a group name to rename it inline
  - Click ▾ / the arrow to collapse/expand the group body; items are indented with a left border for visual hierarchy
  - **×** button on the header ungroups (removes the container, keeps all items as ungrouped)
  - An item can only belong to one group; grouping moves it out of any previous group automatically
- **Ctrl+A**: select all items in the level at once
- Groups survive export/import (serialized into the level file) and are fully undo-aware
- Deleting items automatically removes their references from groups; empty groups are pruned

## [1.4.8] - 2026-04-27
### Added
- **Nav Paint tool** (`N` key): click in the TOP view to add individual nav cells at tileMap elevation; Ctrl+click to erase; overlay activates automatically when painting — lets you hand-tune the nav mesh after a compile
- **Trigger zone brush class**: change a brush's Class to `trigger` in the dialog or Properties panel — trigger zones render as a semi-transparent colored box with an edge wireframe (color/tint customisable) and are completely invisible in-game; properties include `Event` (onEnter / onLeave / zone / killzone), `Script ID`, and `Tag` — all stored in the exported level and stamped into `tileMap` as `.trigger` metadata for future game scripting
- **Ramp-aware nav compilation**: `_compileNavMesh()` now correctly handles ramp rooms — each column/row of a ramp gets its actual per-step elevation stamped into the nav mesh rather than a flat `elevation=0`; also now includes elevated tiles in the compilation
- Brush Class field surfaced in the Properties panel — change solid↔trigger at any time; face editor is disabled on trigger brushes with a hint that faces are invisible in game
- Trigger zone entries in the Layers panel show `◈ trigger:<type>` instead of `⬛ brush`

### Changed
- `_compileNavMesh()` no longer stamps walkable nav tiles from trigger-class brushes (trigger zones are not walkable surfaces)

## [1.4.7] - 2026-04-26
### Added
- **Brush tool** (`B` key): draw arbitrary-size solid boxes in the TOP view — each brush has independent Y min/max, a walkable toggle, and per-face colour/nodraw settings
  - Per-face editor: click any of the 6 face rows (Top, Bottom, ±X, ±Z) to select it; assign colour or mark as NoDraw (invisible/transparent)
  - Brushes are fully integrated into the editor pipeline: resize handles (including Y min/max in front/side views), move-drag, arrow-key nudge, Ctrl+D duplicate, Delete, marquee selection, undo/redo, layers list
- **Nav mesh system**: walkable brush footprints + rooms + standalone tiles are divided into integer tiles to form a tile-based nav mesh
  - `⬡ Compile Nav` button: bakes the nav mesh from current walkable geometry; status bar shows tile count
  - `⬡ Show Nav` toggle: overlays semi-transparent green planes on each nav cell in all viewports
  - Nav mesh is **auto-compiled on export** and written into the level file as `navMesh: [{x, z, elevation}]`
  - On import/load, previously baked nav meshes are restored without recompilation
- **Brush rendering in game.js**: `_lvlBuildBrush()` renders multi-material BoxGeometry for each brush; NoDraw faces are fully transparent; brush meshes participate in the hover raycaster
- **Nav mesh stamped into tileMap** at load time: baked nav cells are written into `tileMap` so the game's existing A* pathfinder can walk across brush surfaces

### Changed
- Export now always triggers a nav compile so the baked nav is never stale
- `btn-new` and `loadLevel` both clear/restore brush + navMesh state
- Undo stack now captures brushes and navMesh

## [1.4.6] - 2026-04-26
### Fixed
- **Grid alignment**: all three orthographic grids (top XZ, front XY, side ZY) were shifted by 0.5 units in their active axes so grid lines land on tile *boundaries* rather than tile *centres* — rooms, tiles, preview boxes, and selection outlines now sit cleanly inside grid cells

## [1.4.5] - 2026-04-26
### Added
- **Fly mode** (`Z` key): toggles pointer-lock FPS camera control in the 3D viewport — cursor hides and locks; mouse look steers the camera; WASD moves in the direction the camera faces (including up/down); Q/E raise/lower; `Z` again exits
- **Isometric home camera**: editor now spawns with the perspective camera exactly matching the game's view — position `(18,18,18)`, yaw `−¾π`, pitch `−asin(1/√3)` (≈ 35.3°), looking at the world origin
- **Camera reset** (`X` key): snaps the perspective camera back to the isometric home position and angle at any time

### Changed
- WASD no longer fires outside fly mode (previously always active); right-drag still rotates in non-fly mode
- Movement in fly mode is per-frame (smooth, held-key) rather than single-step per key press

## [1.4.4] - 2026-04-25
### Added
- **Batch property editing**: when 2+ items of the same kind are selected the Properties panel shows shared fields instead of the "N items selected" hint
  - **Rooms**: batch-edit elevation; palette swatches editable per-index across all rooms (click swatch → colour picker applies to all); "Add" appends a colour entry to every selected room's palette; delete (✕) removes an index from all
  - **Standalone tiles**: batch-edit elevation and colour
  - **Decoratives**: batch-edit colour, W/H/D dimensions
  - **Lights**: batch-edit colour, intensity, distance
  - **Elevated tiles**: batch-edit elevation and type (step/platform)
  - **Mixed-kind selections**: shows elevation field when all selected items expose it
  - Fields where values differ show a blank input with "mixed" placeholder — entering a value overrides all items; colour pickers show at 55% opacity to indicate mixed state

## [1.4.3] - 2026-04-23
### Added
- **Level Editor** (`editor.html` / `editor.js` / `editor.css`): Hammer-style four-viewport level editor served at `/editor.html`
  - **Four viewports**: perspective 3D (bottom-left), top-down ortho XZ (top-right), front ortho XY (bottom-right), side ortho ZY (top-left)
  - **Perspective controls**: right-drag to look, WASD/Q/E to fly, scroll to dolly
  - **Ortho controls**: scroll to zoom all ortho views, middle-drag to pan each view independently
  - **Tools** (keyboard shortcuts S/R/E/V/D/L/P): Select, Room draw, Elevated tile, Lava paint, Decorative box, Light, Spawn
  - **Room tool**: drag rectangle in top view → room dialog with type (stone/corridor/ramp), palette, elevation, ramp axis/start, door colour
  - **Lava tool**: click toggle on any stone room tile
  - **Elevated tile tool**: click tile → dialog sets elevation + type (step/platform)
  - **Decor/Light tools**: click top view to place; property panel for dimensions/colour/position
  - **Spawn tool**: click top view to place the player start marker
  - **Property panel**: live-editable fields for selected room/elevated/decor/light; palette swatch editor
  - **Layers panel**: scrollable object list; click to select; duplicate (⧉) and delete (✕) buttons
  - **Undo** (Ctrl+Z, up to 50 steps); Delete key removes selected object
  - **Export**: serialises level to JS file ready for `levels/<id>.js`; copy-to-clipboard and download
  - **Import**: paste any level JS file to load it for editing
  - **Load level1**: button to load the shipped level1 data directly
  - Dark theme with cross-hair viewport dividers and coordinate readouts

---

## [1.4.2] - 2026-04-23
### Added
- **Decorative raycast**: hover highlight and debug HUD now detect decorative objects (altar, pillars, fence). Hovered decorative shown in orange; HUD lists `decorative:<id>` alongside tile hits
- **Highlight scales to object footprint**: `hoverHighlight` plane scales to match the hovered decorative's w×d dimensions, placed flush at its base
- **Room 4 expanded**: xMax 17→22, zMin −6→−10 (now 14×17 tiles — large enough for comfortable play)
- **Fence in Room 4**: dark-wood perimeter fence with 4 gaps (west to Room 1, north to Ramp 2, east side exit, south exit); generated programmatically from helper functions in the level IIFE
- Pillars repositioned to flank the Ramp 2 descent into Room 4; Room 4 light moved to room centre with increased range

---

## [1.4.1] - 2026-04-22
### Added
- **Room 4 — The Ruined Court**: mossy green-stone room east of Room 1 (x:9–17, z:−6–6), opens directly through Room 1's east wall with no corridor needed
- **Ramp 2**: 3-tile-wide south descender from Room 3 (elevation 1.5) to Room 4 (ground), closing the loop through all four rooms
- **z-axis ramp support**: `_lvlBuildRampRoom` now respects `elevationAxis: 'z'`, stepping elevation per z-row instead of per x-column
- Two mossy pillars at the Room 1 / Room 4 junction; green pulsing point light in Room 4

---

## [1.4.0] - 2026-04-22
### Added
- Multi-level architecture: level data extracted to `levels/level1.js` using `window.LEVELS` global pattern
- Level engine in `game.js`: `buildLevel(data)`, `loadLevel(id)`, `tearDownLevel()` with full scene cleanup
- Level select menu shown on launch; player picks a level before the game starts
- Portal metadata support in level data (empty for level 1, ready for future use)
- Dynamic light pulse system driven by level data; removes hardcoded per-light animate() code

---

## [1.3.5] - 2026-04-22

### Changed
- **Debug overlay materials** — all debug/pathfinding overlays now have `fog: false`
  so they are never washed out by scene fog regardless of distance; opacity bumped
  from 0.25 → 0.45 (hover) and 0.5 → 0.65 (path layers) for stronger contrast
- **Overlay colours** updated to pure saturated values that read clearly on any
  tile palette:
  - Hover highlight: `#ff00dd` vivid magenta-pink (lava override: `#ff6600`)
  - A\* explored layer: `#00aaff` bright sky-blue (was `#2255ff`)
  - Planned path layer: `#ff2255` bright pink-red (was `#ff2222`)
  - Destination layer: `#00ff44` pure bright green (was `#22ff55`)

---

## [1.3.4] - 2026-04-22

### Fixed
- **Pathfinding visualisation elevation** — `_setTileInstance` now reads
  `tileMap[x][z].elevation` and lifts each instance to `elevation + 0.005`;
  the destination (green), planned path (red), and A\* explored (blue) layers
  all go through this helper, so all three now sit on the tile surface for
  raised tiles (ramp, dais platform, Room 3) instead of floating below them
  at ground level

---

## [1.3.3] - 2026-04-22

### Fixed
- **Room 3 tile geometry** — switched from `_getDaisGeom` (full-height box from
  ground to elevation) to the standard thin `tileGeom` slab positioned at
  `ROOM3_ELEV − TILE_THICKNESS / 2`; the tall boxes exposed multiple side faces
  to the isometric ray, causing spurious multi-hits with varying hitY values.
  Ramp tiles keep `_getDaisGeom` because they are actual steps that need the
  filled side faces to avoid visual gaps; flat floors do not

### Changed
- **Hover highlight colour** — changed from white (`0xffffff`) to hot pink
  (`0xff69b4`); lava tiles retain their orange tint (`0xff8844`)

---

## [1.3.2] - 2026-04-22

### Fixed
- **Hover highlight elevation** — the pulsing highlight plane now tracks the
  hovered tile's `elevation` (`position.y = elevation + 0.005`); previously
  its Y was fixed at `0.005` so it appeared on the floor beneath raised tiles
  (dais platform, Room 3, ramp) instead of on their top surface

---

## [1.3.1] - 2026-04-22

### Fixed
- **Debug Raycast HUD** — hit list is now sorted winner-first; the selected tile
  always appears at index 0 labelled `◀ selected`, with the remaining hits in
  ray-distance order below it. The selection logic (elevation-first, hitY
  tiebreaker) is the same function used by both hover highlighting and
  click-to-move navigation — debug, hover, and pathfinding are now fully consistent

---

## [1.3.0] - 2026-04-22

### Added
- **Room 3** — a 9×9 warm-sandstone room (x: 11..19, z: 12..20) raised to
  elevation 1.5 (five steps above ground); uses a distinct amber/ochre palette
  to contrast with Room 1's cool grey and Room 2's blue-grey stone
- **Ramp connection** — instead of a corridor, Room 2's east wall (x=5) opens
  onto a 5-column × 3-tile ramp (x: 6..10, z: 16..18); each column rises
  exactly one `_STEP_H` (0.3), so all transitions are within `MAX_STEP_HEIGHT`
  and both keyboard movement and A\* pathfinding traverse the ramp naturally
- **Elevation-aware walls** — wall generation now reads each tile's `elevation`
  and builds walls that start at y=0 and extend to `elevation + WALL_HEIGHT`;
  Room 3's boundary walls are 2.4 units tall, ramp side-walls step up
  progressively like retaining walls as the ramp ascends
- **Room 3 ambient light** — a warm golden `PointLight` (0xffa030, range 18)
  floats above the room and pulses gently at 1.1 Hz, giving the sandstone
  floor a torch-like atmosphere distinct from Room 2's blue-purple dais light
- `MAX_TILES` raised from 500 → 700 to cover the expanded map

---

## [1.2.4] - 2026-04-21

### Changed
- **Altar colour** — material updated to neutral dark grey (`0x2a2a2a`, emissive `0x111111`
  at 0.3 intensity) replacing the previous blue-tinted dark tone; the slab now reads as
  plain stone under the dais light
- **Debug Raycast HUD** — each hit line now shows full tile metadata:
  `type`, `walkable`, `elev`, and `hitY`, making it straightforward to see what kind of
  tile was hit and whether it is navigable (e.g. `type:platform  walkable:yes  elev:0.90  hitY:0.923 ◀`)

---

## [1.2.3] - 2026-04-21

### Added
- **Zoom HUD display** — a `#zoom-info` label in the bottom-right corner always
  shows the current zoom level (e.g. `zoom 10.0`); updates live on scroll wheel,
  Settings save, and X key reset
- **X key resets zoom** — pressing X now also resets `viewSize` back to the
  default (10) in addition to resetting camera angle and cancelling pan mode

### Changed
- Extracted `setZoom(newSize)` helper — consolidates all camera frustum + display
  updates into one place; used by scroll wheel, Settings save, and X key handlers

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

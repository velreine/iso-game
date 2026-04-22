// ─── Level 1: The Stone Keep ──────────────────────────────────────────────────
// All tile, light, and decorative data for level 1.
// Loaded by the engine via <script src="./levels/level1.js"> and registered on
// window.LEVELS.  No code runs here — pure data.
(function () {
  window.LEVELS = window.LEVELS || {};

  window.LEVELS.level1 = {
    id:          'level1',
    name:        'The Stone Keep',
    stepHeight:  0.3,            // used for cliff-jump check (MAX_STEP_HEIGHT = stepHeight + 0.02)
    playerStart: { x: 0, z: 0 },

    // ── Rooms ────────────────────────────────────────────────────────────────
    // Each room is a rectangular region of tiles.
    // type 'stone'    → flat tiles, optional uniform elevation, optional lavaCoords
    // type 'corridor' → flat tiles, doorColor at doorZ rows
    // type 'ramp'     → tiles whose elevation increases by stepHeight along elevationAxis
    rooms: [
      {
        id: 'room1', type: 'stone', tileType: 'stone',
        xMin: -8, xMax: 8, zMin: -8, zMax: 8,
        palette: [
          0x52525c, 0x4a4a58, 0x585862, 0x4e4e5a,
          0x545460, 0x5e5e68, 0x484852, 0x56565e,
          0x606068, 0x4c4c56,
        ],
        lavaCoords: [
                    [5,3],[6,3],
          [4,4],   [5,4],[6,4],[7,4],
          [3,5],[4,5],[5,5],[6,5],[7,5],
                   [4,6],[5,6],[6,6],[7,6],
                         [5,7],[6,7],[7,7],
        ],
        lavaPalette: [
          0xff3300, 0xff4400, 0xff5500, 0xff6600,
          0xff8800, 0xffaa00, 0xdd2200, 0xee4400,
        ],
      },
      {
        id: 'corridor', type: 'corridor', tileType: 'stone',
        xMin: -1, xMax: 1, zMin: 9, zMax: 13,
        palette: [
          0x52525c, 0x4a4a58, 0x585862, 0x4e4e5a, 0x545460,
        ],
        doorColor: 0x6a6040,
        doorZ: [9, 13],
      },
      {
        id: 'room2', type: 'stone', tileType: 'stone2',
        xMin: -5, xMax: 5, zMin: 14, zMax: 24,
        palette: [
          0x374258, 0x2e3a55, 0x3a4260, 0x2c3850,
          0x404560, 0x363e58, 0x344060, 0x3c4055,
        ],
      },
      {
        id: 'room3', type: 'stone', tileType: 'stone3',
        xMin: 11, xMax: 19, zMin: 12, zMax: 20,
        elevation: 1.5,
        palette: [
          0x8b7355, 0x7a6245, 0x977d5e, 0x886a48, 0x9a7850, 0x80654a,
        ],
      },
      {
        id: 'ramp1', type: 'ramp', tileType: 'ramp',
        xMin: 6, xMax: 10, zMin: 16, zMax: 18,
        palette: [0x8a7258, 0x7e6850, 0x867060],
        // elevation increases along +x, starting at stepHeight, one step per column
        elevationAxis: 'x', elevationStart: 0.3,
      },
      {
        id: 'room4', type: 'stone', tileType: 'stone4',
        xMin: 9, xMax: 17, zMin: -6, zMax: 6,
        palette: [
          0x3d5a3e, 0x344f35, 0x406043, 0x384d3a,
          0x3b5540, 0x425e44, 0x365238, 0x3e583f,
        ],
      },
      {
        id: 'ramp2', type: 'ramp', tileType: 'ramp2',
        xMin: 13, xMax: 15, zMin: 7, zMax: 11,
        palette: [0x7e6e58, 0x726450, 0x7a6a58],
        // elevation increases along +z, connecting Room 4 (ground) to Room 3 (elev 1.5)
        elevationAxis: 'z', elevationStart: 0.3,
      },
    ],

    // ── Elevated tiles (dais staircase + platform) ───────────────────────────
    // Skipped during room generation; use _getDaisGeom so side-faces are solid.
    // type 'step' → daisStep palette; type 'platform' → daisPlatform palette
    daisStepPalette:     [0x485070, 0x455068, 0x4a5272],
    daisPlatformPalette: [0x3a4868, 0x384562, 0x3c4a6c],

    elevatedTiles: [
      // ── North stairs (z 15–16, ascending south into room 2) ──
      { x:-1, z:15, elevation:0.3, type:'step'     },
      { x: 0, z:15, elevation:0.3, type:'step'     },
      { x: 1, z:15, elevation:0.3, type:'step'     },
      { x:-1, z:16, elevation:0.6, type:'step'     },
      { x: 0, z:16, elevation:0.6, type:'step'     },
      { x: 1, z:16, elevation:0.6, type:'step'     },
      // ── Platform ──
      { x:-2, z:17, elevation:0.9, type:'platform' },
      { x:-1, z:17, elevation:0.9, type:'platform' },
      { x: 0, z:17, elevation:0.9, type:'platform' },
      { x: 1, z:17, elevation:0.9, type:'platform' },
      { x: 2, z:17, elevation:0.9, type:'platform' },
      { x:-2, z:18, elevation:0.9, type:'platform' },
      { x:-1, z:18, elevation:0.9, type:'platform' },
      { x: 0, z:18, elevation:0.9, type:'platform' },
      { x: 1, z:18, elevation:0.9, type:'platform' },
      { x: 2, z:18, elevation:0.9, type:'platform' },
      { x:-2, z:19, elevation:0.9, type:'platform' },
      { x:-1, z:19, elevation:0.9, type:'platform' },
      { x: 0, z:19, elevation:0.9, type:'platform' },
      { x: 1, z:19, elevation:0.9, type:'platform' },
      { x: 2, z:19, elevation:0.9, type:'platform' },
      { x:-2, z:20, elevation:0.9, type:'platform' },
      { x:-1, z:20, elevation:0.9, type:'platform' },
      { x: 0, z:20, elevation:0.9, type:'platform' },
      { x: 1, z:20, elevation:0.9, type:'platform' },
      { x: 2, z:20, elevation:0.9, type:'platform' },
      { x:-2, z:21, elevation:0.9, type:'platform' },
      { x:-1, z:21, elevation:0.9, type:'platform' },
      { x: 0, z:21, elevation:0.9, type:'platform' },
      { x: 1, z:21, elevation:0.9, type:'platform' },
      { x: 2, z:21, elevation:0.9, type:'platform' },
      // ── South stairs ──
      { x:-1, z:22, elevation:0.6, type:'step'     },
      { x: 0, z:22, elevation:0.6, type:'step'     },
      { x: 1, z:22, elevation:0.6, type:'step'     },
      { x:-1, z:23, elevation:0.3, type:'step'     },
      { x: 0, z:23, elevation:0.3, type:'step'     },
      { x: 1, z:23, elevation:0.3, type:'step'     },
    ],

    // ── Decorative meshes ────────────────────────────────────────────────────
    // type 'box' → BoxGeometry (w, h, d) placed at (x, y, z)
    // blocksNav: tiles that should be set walkable:false after the mesh is placed
    decoratives: [
      {
        id: 'altar', type: 'box',
        x: 0, y: 1.125, z: 19,
        w: 1.8, h: 0.45, d: 0.85,
        color: 0x2a2a2a, emissive: 0x111111, emissiveIntensity: 0.3,
        castShadow: true,
        blocksNav: [{ x: 0, z: 19 }],
      },
      { id: 'pillar_r1_nw', type: 'box', x: -1.5, y: 0.9, z:  8.5, w: 0.28, h: 1.8, d: 0.28, color: 0x706858, castShadow: true },
      { id: 'pillar_r1_ne', type: 'box', x:  1.5, y: 0.9, z:  8.5, w: 0.28, h: 1.8, d: 0.28, color: 0x706858, castShadow: true },
      { id: 'pillar_r2_sw', type: 'box', x: -1.5, y: 0.9, z: 13.5, w: 0.28, h: 1.8, d: 0.28, color: 0x706858, castShadow: true },
      { id: 'pillar_r2_se', type: 'box', x:  1.5, y: 0.9, z: 13.5, w: 0.28, h: 1.8, d: 0.28, color: 0x706858, castShadow: true },
      { id: 'pillar_r4_n',  type: 'box', x:  9.5, y: 0.9, z:  1.5, w: 0.28, h: 1.8, d: 0.28, color: 0x4a5a48, castShadow: true },
      { id: 'pillar_r4_s',  type: 'box', x:  9.5, y: 0.9, z: -1.5, w: 0.28, h: 1.8, d: 0.28, color: 0x4a5a48, castShadow: true },
    ],

    // ── Point lights ─────────────────────────────────────────────────────────
    // pulse: { base, amp, freq, phase } → intensity = base + sin(t*freq+phase)*amp
    lights: [
      {
        id: 'lava', color: 0xff5500, intensity: 2.0, distance: 10,
        x: 6, y: 1.5, z: 6,
        pulse: { base: 1.8, amp: 0.6, freq: 2.8 },
      },
      {
        id: 'dais', color: 0x7070ff, intensity: 1.5, distance: 10,
        x: 0, y: 3.1, z: 19,
        pulse: { base: 1.2, amp: 0.4, freq: 1.5 },
      },
      {
        id: 'room3', color: 0xffa030, intensity: 1.4, distance: 18,
        x: 15, y: 4.5, z: 16,
        pulse: { base: 1.2, amp: 0.35, freq: 1.1, phase: 1.2 },
      },
      {
        id: 'room4', color: 0x60c070, intensity: 1.3, distance: 18,
        x: 13, y: 3.0, z: 0,
        pulse: { base: 1.1, amp: 0.3, freq: 0.9, phase: 2.1 },
      },
    ],

    // ── Portals ──────────────────────────────────────────────────────────────
    // { x, z, targetLevel, targetSpawn: {x, z} }
    portals: [],
  };
}());

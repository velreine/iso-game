// ─── Level 1: The Stone Keep ──────────────────────────────────────────────────
// All tile, light, and decorative data for level 1.
// Loaded by the engine via <script src="./levels/level1.js"> and registered on
// window.LEVELS.  Helper vars/functions are allowed inside the IIFE.
(function () {
  window.LEVELS = window.LEVELS || {};

  // ── Room 4 fence (generated) ─────────────────────────────────────────────
  // Room 4: xMin:9 xMax:22 zMin:-10 zMax:6
  // Fence runs along the inner face of the border tiles (0.5 inside each edge).
  // Four gaps:  West  z=-1.5→1.5  (Room 1 entrance)
  //             North x=12.5→16.5 (Ramp 2 entrance)
  //             East  z=-4.5→-1.5 (side exit)
  //             South x=14.5→17.5 (south exit)
  var _FW  = 0x3a2510;   // fence panel colour (dark wood)
  var _FPC = 0x2a1a0a;   // fence post colour  (darker wood)
  var _FH  = 1.2;        // height
  var _FY  = 0.6;        // centre Y (base flush with ground)
  var _FT  = 0.12;       // panel thickness

  function _panel(id, x, z, w, d) {
    return { id: id, type: 'box', x: x, y: _FY, z: z,
             w: w, h: _FH, d: d, color: _FW, castShadow: true };
  }
  function _post(id, x, z) {
    return { id: id, type: 'box', x: x, y: _FY, z: z,
             w: 0.22, h: _FH, d: 0.22, color: _FPC, castShadow: true };
  }

  var _fence = [
    // West wall (x=9.5) — gap z=-1.5 to 1.5
    _panel('fw_s',   9.5, -5.5, _FT, 8.0),   // z=-9.5 to -1.5
    _panel('fw_n',   9.5,  3.5, _FT, 4.0),   // z= 1.5 to  5.5
    // North wall (z=5.5) — gap x=12.5 to 16.5
    _panel('fn_w',  11.0,  5.5, 3.0, _FT),   // x= 9.5 to 12.5
    _panel('fn_e',  19.0,  5.5, 5.0, _FT),   // x=16.5 to 21.5
    // East wall (x=21.5) — gap z=-4.5 to -1.5
    _panel('fe_n',  21.5,  2.0, _FT, 7.0),   // z=-1.5 to  5.5
    _panel('fe_s',  21.5, -7.0, _FT, 5.0),   // z=-9.5 to -4.5
    // South wall (z=-9.5) — gap x=14.5 to 17.5
    _panel('fs_w',  12.0, -9.5, 5.0, _FT),   // x= 9.5 to 14.5
    _panel('fs_e',  19.5, -9.5, 4.0, _FT),   // x=17.5 to 21.5
    // Corner posts
    _post('fp_nw',   9.5,  5.5),
    _post('fp_ne',  21.5,  5.5),
    _post('fp_sw',   9.5, -9.5),
    _post('fp_se',  21.5, -9.5),
    // Gap posts — West entrance
    _post('fp_w_s',  9.5, -1.5),
    _post('fp_w_n',  9.5,  1.5),
    // Gap posts — North (ramp) entrance
    _post('fp_n_w', 12.5,  5.5),
    _post('fp_n_e', 16.5,  5.5),
    // Gap posts — East exit
    _post('fp_e_n', 21.5, -1.5),
    _post('fp_e_s', 21.5, -4.5),
    // Gap posts — South exit
    _post('fp_s_w', 14.5, -9.5),
    _post('fp_s_e', 17.5, -9.5),
  ];

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
        xMin: 9, xMax: 22, zMin: -10, zMax: 6,
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
      // Pillars flanking the Ramp 2 descent into Room 4
      { id: 'pillar_r4_nw', type: 'box', x: 13.0, y: 0.9, z: 4.5, w: 0.28, h: 1.8, d: 0.28, color: 0x4a5a48, castShadow: true },
      { id: 'pillar_r4_ne', type: 'box', x: 15.0, y: 0.9, z: 4.5, w: 0.28, h: 1.8, d: 0.28, color: 0x4a5a48, castShadow: true },
    ].concat(_fence),

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
        id: 'room4', color: 0x60c070, intensity: 1.5, distance: 22,
        x: 15.5, y: 3.0, z: -2,
        pulse: { base: 1.2, amp: 0.35, freq: 0.9, phase: 2.1 },
      },
    ],

    // ── Portals ──────────────────────────────────────────────────────────────
    // { x, z, targetLevel, targetSpawn: {x, z} }
    portals: [],
  };
}());

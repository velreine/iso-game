// ─── Level 1: The Stone Keep — brush-only redesign ───────────────────────────
(function () {
  'use strict';
  window.LEVELS = window.LEVELS || {};

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Standard floor/step face set: coloured top, nodraw bottom, darker sides.
  function _f(top, side) {
    side = side !== undefined ? side : Math.max(0, top - 0x0d0d0d);
    return {
      py: { color: top,  nodraw: false },
      ny: { color: 0,    nodraw: true  },
      px: { color: side, nodraw: false },
      nx: { color: side, nodraw: false },
      pz: { color: side, nodraw: false },
      nz: { color: side, nodraw: false },
    };
  }
  // Uniform colour on all faces (pillars, altar, etc.).
  function _u(c) {
    return { py:{color:c,nodraw:false}, ny:{color:c,nodraw:false},
             px:{color:c,nodraw:false}, nx:{color:c,nodraw:false},
             pz:{color:c,nodraw:false}, nz:{color:c,nodraw:false} };
  }

  // Bake a navMesh from the walkable brushes at build time so the game engine
  // gets a ready-to-use tile grid without needing to recompile.
  function _bakeNav(brushes) {
    var cells = {};
    brushes.forEach(function(b) {
      if (!b.walkable) return;
      for (var x = b.xMin; x <= b.xMax; x++) {
        for (var z = b.zMin; z <= b.zMax; z++) {
          var k = x + ',' + z;
          if (!cells[k] || cells[k].elevation < b.yMax)
            cells[k] = { x: x, z: z, elevation: b.yMax };
        }
      }
    });
    return Object.values(cells);
  }

  // ── Colour palette ────────────────────────────────────────────────────────
  var C = {
    // main stone room
    stone:     0x50505c,  stoneSide: 0x3e3e4a,
    // corridor
    corr:      0x52525c,  corrSide:  0x404050,
    // blue room (north)
    blue:      0x374258,  blueSide:  0x2a3448,
    // tan elevated room
    tan:       0x8b7355,  tanSide:   0x7a6245,
    // green courtyard
    green:     0x3d5a3e,  greenSide: 0x2e4830,
    // raised platform inside blue room
    plat:      0x3a4868,  platSide:  0x2c3858,
    // step stone (stairs up to platform)
    step:      0x485070,  stepSide:  0x39405e,
    // ramp stone
    ramp:      0x8a7258,  rampSide:  0x786050,
    // pillars
    pillar:    0x706858,
    // altar
    altar:     0x2a2a2a,
    // lava
    lava:      0xff4400,  lavaGlow:  0xcc2200,
  };

  // ── Brushes ───────────────────────────────────────────────────────────────
  // Convention:
  //   Floor brushes    yMin=-0.22, yMax=elevation  (thickness mimics old tile)
  //   Step/ramp top    yMin=0,     yMax=stepHeight  (sits on floor brush below)
  //   Pillars/deco     yMin=floor_elevation, yMax=top
  //
  // Staircase steps (inside room2) use yMin=0 so they sit cleanly on top of the
  // floor brush without any z-fighting.
  var brushes = [

    // ── Ground-floor areas ──────────────────────────────────────────────────
    {
      id:'b_main', brushClass:'solid', walkable:true,
      xMin:-8, xMax:8,  zMin:-8, zMax:8,
      yMin:-0.22, yMax:0,
      faces: _f(C.stone, C.stoneSide),
    },
    {
      id:'b_corridor', brushClass:'solid', walkable:true,
      xMin:-1, xMax:1,  zMin:9,  zMax:13,
      yMin:-0.22, yMax:0,
      faces: _f(C.corr, C.corrSide),
    },
    {
      id:'b_room2', brushClass:'solid', walkable:true,
      xMin:-5, xMax:5,  zMin:14, zMax:24,
      yMin:-0.22, yMax:0,
      faces: _f(C.blue, C.blueSide),
    },
    {
      id:'b_room4', brushClass:'solid', walkable:true,
      xMin:9,  xMax:22, zMin:-10, zMax:6,
      yMin:-0.22, yMax:0,
      faces: _f(C.green, C.greenSide),
    },

    // ── Elevated room (north-east) ──────────────────────────────────────────
    {
      id:'b_room3', brushClass:'solid', walkable:true,
      xMin:11, xMax:19, zMin:12, zMax:20,
      yMin:1.28, yMax:1.5,
      faces: _f(C.tan, C.tanSide),
    },

    // ── Raised platform in room2 ────────────────────────────────────────────
    // Sits on the room2 floor (yMin=0 avoids z-fighting with the floor brush).
    {
      id:'b_platform', brushClass:'solid', walkable:true,
      xMin:-2, xMax:2,  zMin:17, zMax:21,
      yMin:0, yMax:0.9,
      faces: _f(C.plat, C.platSide),
    },

    // ── Staircase south: room2 floor (y=0) → platform (y=0.9) ──────────────
    { id:'b_step_s1', brushClass:'solid', walkable:true, xMin:-1, xMax:1, zMin:15, zMax:15, yMin:0, yMax:0.3, faces:_f(C.step, C.stepSide) },
    { id:'b_step_s2', brushClass:'solid', walkable:true, xMin:-1, xMax:1, zMin:16, zMax:16, yMin:0, yMax:0.6, faces:_f(C.step, C.stepSide) },

    // ── Staircase north: platform → room2 floor (descending) ───────────────
    { id:'b_step_n1', brushClass:'solid', walkable:true, xMin:-1, xMax:1, zMin:22, zMax:22, yMin:0, yMax:0.6, faces:_f(C.step, C.stepSide) },
    { id:'b_step_n2', brushClass:'solid', walkable:true, xMin:-1, xMax:1, zMin:23, zMax:23, yMin:0, yMax:0.3, faces:_f(C.step, C.stepSide) },

    // ── Ramp 1: room2 ground (x=6,y=0) → room3 floor (x=10,y=1.5) ─────────
    // Stepped along +X, three tiles wide (z=16–18).
    { id:'b_r1_1', brushClass:'solid', walkable:true, xMin:6,  xMax:6,  zMin:16, zMax:18, yMin:-0.22, yMax:0.3, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r1_2', brushClass:'solid', walkable:true, xMin:7,  xMax:7,  zMin:16, zMax:18, yMin:-0.22, yMax:0.6, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r1_3', brushClass:'solid', walkable:true, xMin:8,  xMax:8,  zMin:16, zMax:18, yMin:-0.22, yMax:0.9, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r1_4', brushClass:'solid', walkable:true, xMin:9,  xMax:9,  zMin:16, zMax:18, yMin:-0.22, yMax:1.2, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r1_5', brushClass:'solid', walkable:true, xMin:10, xMax:10, zMin:16, zMax:18, yMin:-0.22, yMax:1.5, faces:_f(C.ramp, C.rampSide) },

    // ── Ramp 2: room4 ground (z=7,y=0) → room3 floor (z=11,y=1.5) ─────────
    // Stepped along +Z, three tiles wide (x=13–15).
    { id:'b_r2_1', brushClass:'solid', walkable:true, xMin:13, xMax:15, zMin:7,  zMax:7,  yMin:-0.22, yMax:0.3, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r2_2', brushClass:'solid', walkable:true, xMin:13, xMax:15, zMin:8,  zMax:8,  yMin:-0.22, yMax:0.6, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r2_3', brushClass:'solid', walkable:true, xMin:13, xMax:15, zMin:9,  zMax:9,  yMin:-0.22, yMax:0.9, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r2_4', brushClass:'solid', walkable:true, xMin:13, xMax:15, zMin:10, zMax:10, yMin:-0.22, yMax:1.2, faces:_f(C.ramp, C.rampSide) },
    { id:'b_r2_5', brushClass:'solid', walkable:true, xMin:13, xMax:15, zMin:11, zMax:11, yMin:-0.22, yMax:1.5, faces:_f(C.ramp, C.rampSide) },

    // ── Pillars flanking the corridor ───────────────────────────────────────
    { id:'b_pill_nw', brushClass:'solid', walkable:false, xMin:-1, xMax:-1, zMin:8,  zMax:8,  yMin:0, yMax:1.8, faces:_u(C.pillar) },
    { id:'b_pill_ne', brushClass:'solid', walkable:false, xMin:1,  xMax:1,  zMin:8,  zMax:8,  yMin:0, yMax:1.8, faces:_u(C.pillar) },
    { id:'b_pill_sw', brushClass:'solid', walkable:false, xMin:-1, xMax:-1, zMin:13, zMax:13, yMin:0, yMax:1.8, faces:_u(C.pillar) },
    { id:'b_pill_se', brushClass:'solid', walkable:false, xMin:1,  xMax:1,  zMin:13, zMax:13, yMin:0, yMax:1.8, faces:_u(C.pillar) },

    // ── Altar on the platform ───────────────────────────────────────────────
    {
      id:'b_altar', brushClass:'solid', walkable:false,
      xMin:0, xMax:0, zMin:19, zMax:19,
      yMin:0.9, yMax:1.35,
      faces: _u(C.altar),
    },

    // ── Lava pit (slightly above floor — avoids z-fighting with b_main) ─────
    // Non-walkable.  Orange top, dark glowing sides.
    {
      id:'b_lava', brushClass:'solid', walkable:false,
      xMin:4, xMax:7, zMin:4, zMax:7,
      yMin:-0.22, yMax:0.05,
      faces: {
        py: { color: C.lava,    nodraw: false },
        ny: { color: 0,         nodraw: true  },
        px: { color: C.lavaGlow,nodraw: false },
        nx: { color: C.lavaGlow,nodraw: false },
        pz: { color: C.lavaGlow,nodraw: false },
        nz: { color: C.lavaGlow,nodraw: false },
      },
    },
  ];

  // ── Entities ──────────────────────────────────────────────────────────────
  var entities = [
    // Player spawn
    { id:'spawn', entityType:'spawn', x:0, y:0, z:0 },

    // Lights — pulse keeps the old flicker effect
    { id:'light_lava',  entityType:'light', x:6,    y:1.5, z:6,
      color:0xff5500, intensity:2.0, distance:10,
      pulse:{ base:1.8, amp:0.6, freq:2.8 } },
    { id:'light_altar', entityType:'light', x:0,    y:3.1, z:19,
      color:0x7070ff, intensity:1.5, distance:10,
      pulse:{ base:1.2, amp:0.4, freq:1.5 } },
    { id:'light_room3', entityType:'light', x:15,   y:4.5, z:16,
      color:0xffa030, intensity:1.4, distance:18,
      pulse:{ base:1.2, amp:0.35, freq:1.1, phase:1.2 } },
    { id:'light_room4', entityType:'light', x:15.5, y:3.0, z:-2,
      color:0x60c070, intensity:1.5, distance:22,
      pulse:{ base:1.2, amp:0.35, freq:0.9, phase:2.1 } },
  ];

  window.LEVELS.level1 = {
    id:         'level1',
    name:       'The Stone Keep',
    stepHeight: 0.3,
    playerStart:{ x:0, z:0 },

    // Legacy arrays — empty; geometry is all in brushes/entities now.
    rooms:        [],
    elevatedTiles:[],
    decoratives:  [],
    lights:       [],
    portals:      [],
    groups:       [],

    brushes:  brushes,
    entities: entities,
    navMesh:  _bakeNav(brushes),
  };
}());

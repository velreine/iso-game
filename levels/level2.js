// ─── The Stone Keep2 ────
(function () {
  window.LEVELS = window.LEVELS || {};
  window.LEVELS["level2"] = {
  "id": "level2",
  "name": "The Stone Keep2",
  "stepHeight": 0.3,
  "playerStart": {
    "x": 0,
    "z": 0
  },
  "rooms": [],
  "elevatedTiles": [],
  "decoratives": [],
  "lights": [],
  "portals": [],
  "brushes": [
    {
      "id": "b_main",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -8,
      "xMax": 8,
      "zMin": -8,
      "zMax": 8,
      "yMin": -0.22,
      "yMax": 0,
      "faces": {
        "py": {
          "color": 5263452,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 4079178,
          "nodraw": false
        },
        "nx": {
          "color": 4079178,
          "nodraw": false
        },
        "pz": {
          "color": 4079178,
          "nodraw": false
        },
        "nz": {
          "color": 4079178,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_corridor",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -1,
      "xMax": 1,
      "zMin": 9,
      "zMax": 13,
      "yMin": -0.22,
      "yMax": 0,
      "faces": {
        "py": {
          "color": 5395036,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 4210768,
          "nodraw": false
        },
        "nx": {
          "color": 4210768,
          "nodraw": false
        },
        "pz": {
          "color": 4210768,
          "nodraw": false
        },
        "nz": {
          "color": 4210768,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_room2",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -5,
      "xMax": 5,
      "zMin": 14,
      "zMax": 24,
      "yMin": -0.22,
      "yMax": 0,
      "faces": {
        "py": {
          "color": 3621464,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 2765896,
          "nodraw": false
        },
        "nx": {
          "color": 2765896,
          "nodraw": false
        },
        "pz": {
          "color": 2765896,
          "nodraw": false
        },
        "nz": {
          "color": 2765896,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_room4",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 9,
      "xMax": 22,
      "zMin": -10,
      "zMax": 6,
      "yMin": -0.22,
      "yMax": 0,
      "faces": {
        "py": {
          "color": 4020798,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 3033136,
          "nodraw": false
        },
        "nx": {
          "color": 3033136,
          "nodraw": false
        },
        "pz": {
          "color": 3033136,
          "nodraw": false
        },
        "nz": {
          "color": 3033136,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_room3",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 11,
      "xMax": 19,
      "zMin": 12,
      "zMax": 20,
      "yMin": 1.28,
      "yMax": 1.5,
      "faces": {
        "py": {
          "color": 9139029,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 8020549,
          "nodraw": false
        },
        "nx": {
          "color": 8020549,
          "nodraw": false
        },
        "pz": {
          "color": 8020549,
          "nodraw": false
        },
        "nz": {
          "color": 8020549,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_platform",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -2,
      "xMax": 2,
      "zMin": 17,
      "zMax": 21,
      "yMin": 0,
      "yMax": 0.9,
      "faces": {
        "py": {
          "color": 3819624,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 2898008,
          "nodraw": false
        },
        "nx": {
          "color": 2898008,
          "nodraw": false
        },
        "pz": {
          "color": 2898008,
          "nodraw": false
        },
        "nz": {
          "color": 2898008,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_step_s1",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -1,
      "xMax": 1,
      "zMin": 15,
      "zMax": 15,
      "yMin": 0,
      "yMax": 0.3,
      "faces": {
        "py": {
          "color": 4739184,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 3752030,
          "nodraw": false
        },
        "nx": {
          "color": 3752030,
          "nodraw": false
        },
        "pz": {
          "color": 3752030,
          "nodraw": false
        },
        "nz": {
          "color": 3752030,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_step_s2",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -1,
      "xMax": 1,
      "zMin": 16,
      "zMax": 16,
      "yMin": 0,
      "yMax": 0.6,
      "faces": {
        "py": {
          "color": 4739184,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 3752030,
          "nodraw": false
        },
        "nx": {
          "color": 3752030,
          "nodraw": false
        },
        "pz": {
          "color": 3752030,
          "nodraw": false
        },
        "nz": {
          "color": 3752030,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_step_n1",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -1,
      "xMax": 1,
      "zMin": 22,
      "zMax": 22,
      "yMin": 0,
      "yMax": 0.6,
      "faces": {
        "py": {
          "color": 4739184,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 3752030,
          "nodraw": false
        },
        "nx": {
          "color": 3752030,
          "nodraw": false
        },
        "pz": {
          "color": 3752030,
          "nodraw": false
        },
        "nz": {
          "color": 3752030,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_step_n2",
      "brushClass": "solid",
      "walkable": true,
      "xMin": -1,
      "xMax": 1,
      "zMin": 23,
      "zMax": 23,
      "yMin": 0,
      "yMax": 0.3,
      "faces": {
        "py": {
          "color": 4739184,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 3752030,
          "nodraw": false
        },
        "nx": {
          "color": 3752030,
          "nodraw": false
        },
        "pz": {
          "color": 3752030,
          "nodraw": false
        },
        "nz": {
          "color": 3752030,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r1_1",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 6,
      "xMax": 6,
      "zMin": 16,
      "zMax": 18,
      "yMin": -0.22,
      "yMax": 0.3,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r1_2",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 7,
      "xMax": 7,
      "zMin": 16,
      "zMax": 18,
      "yMin": -0.22,
      "yMax": 0.6,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r1_3",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 8,
      "xMax": 8,
      "zMin": 16,
      "zMax": 18,
      "yMin": -0.22,
      "yMax": 0.9,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r1_4",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 9,
      "xMax": 9,
      "zMin": 16,
      "zMax": 18,
      "yMin": -0.22,
      "yMax": 1.2,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r1_5",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 10,
      "xMax": 10,
      "zMin": 16,
      "zMax": 18,
      "yMin": -0.22,
      "yMax": 1.5,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r2_1",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 13,
      "xMax": 15,
      "zMin": 7,
      "zMax": 7,
      "yMin": -0.22,
      "yMax": 0.3,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r2_2",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 13,
      "xMax": 15,
      "zMin": 8,
      "zMax": 8,
      "yMin": -0.22,
      "yMax": 0.6,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r2_3",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 13,
      "xMax": 15,
      "zMin": 9,
      "zMax": 9,
      "yMin": -0.22,
      "yMax": 0.9,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r2_4",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 13,
      "xMax": 15,
      "zMin": 10,
      "zMax": 10,
      "yMin": -0.22,
      "yMax": 1.2,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_r2_5",
      "brushClass": "solid",
      "walkable": true,
      "xMin": 13,
      "xMax": 15,
      "zMin": 11,
      "zMax": 11,
      "yMin": -0.22,
      "yMax": 1.5,
      "faces": {
        "py": {
          "color": 9073240,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 7888976,
          "nodraw": false
        },
        "nx": {
          "color": 7888976,
          "nodraw": false
        },
        "pz": {
          "color": 7888976,
          "nodraw": false
        },
        "nz": {
          "color": 7888976,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_pill_nw",
      "brushClass": "solid",
      "walkable": false,
      "xMin": -1,
      "xMax": -1,
      "zMin": 8,
      "zMax": 8,
      "yMin": 0,
      "yMax": 1.8,
      "faces": {
        "py": {
          "color": 7366744,
          "nodraw": false
        },
        "ny": {
          "color": 7366744,
          "nodraw": false
        },
        "px": {
          "color": 7366744,
          "nodraw": false
        },
        "nx": {
          "color": 7366744,
          "nodraw": false
        },
        "pz": {
          "color": 7366744,
          "nodraw": false
        },
        "nz": {
          "color": 7366744,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_pill_ne",
      "brushClass": "solid",
      "walkable": false,
      "xMin": 1,
      "xMax": 1,
      "zMin": 8,
      "zMax": 8,
      "yMin": 0,
      "yMax": 1.8,
      "faces": {
        "py": {
          "color": 7366744,
          "nodraw": false
        },
        "ny": {
          "color": 7366744,
          "nodraw": false
        },
        "px": {
          "color": 7366744,
          "nodraw": false
        },
        "nx": {
          "color": 7366744,
          "nodraw": false
        },
        "pz": {
          "color": 7366744,
          "nodraw": false
        },
        "nz": {
          "color": 7366744,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_pill_sw",
      "brushClass": "solid",
      "walkable": false,
      "xMin": -1,
      "xMax": -1,
      "zMin": 13,
      "zMax": 13,
      "yMin": 0,
      "yMax": 1.8,
      "faces": {
        "py": {
          "color": 7366744,
          "nodraw": false
        },
        "ny": {
          "color": 7366744,
          "nodraw": false
        },
        "px": {
          "color": 7366744,
          "nodraw": false
        },
        "nx": {
          "color": 7366744,
          "nodraw": false
        },
        "pz": {
          "color": 7366744,
          "nodraw": false
        },
        "nz": {
          "color": 7366744,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_pill_se",
      "brushClass": "solid",
      "walkable": false,
      "xMin": 1,
      "xMax": 1,
      "zMin": 13,
      "zMax": 13,
      "yMin": 0,
      "yMax": 1.8,
      "faces": {
        "py": {
          "color": 7366744,
          "nodraw": false
        },
        "ny": {
          "color": 7366744,
          "nodraw": false
        },
        "px": {
          "color": 7366744,
          "nodraw": false
        },
        "nx": {
          "color": 7366744,
          "nodraw": false
        },
        "pz": {
          "color": 7366744,
          "nodraw": false
        },
        "nz": {
          "color": 7366744,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_altar",
      "brushClass": "solid",
      "walkable": false,
      "xMin": 0,
      "xMax": 0,
      "zMin": 19,
      "zMax": 19,
      "yMin": 0.9,
      "yMax": 1.35,
      "faces": {
        "py": {
          "color": 2763306,
          "nodraw": false
        },
        "ny": {
          "color": 2763306,
          "nodraw": false
        },
        "px": {
          "color": 2763306,
          "nodraw": false
        },
        "nx": {
          "color": 2763306,
          "nodraw": false
        },
        "pz": {
          "color": 2763306,
          "nodraw": false
        },
        "nz": {
          "color": 2763306,
          "nodraw": false
        }
      }
    },
    {
      "id": "b_lava",
      "brushClass": "solid",
      "walkable": false,
      "xMin": 4,
      "xMax": 7,
      "zMin": 4,
      "zMax": 7,
      "yMin": -0.22,
      "yMax": 0.05,
      "faces": {
        "py": {
          "color": 16729088,
          "nodraw": false
        },
        "ny": {
          "color": 0,
          "nodraw": true
        },
        "px": {
          "color": 13378048,
          "nodraw": false
        },
        "nx": {
          "color": 13378048,
          "nodraw": false
        },
        "pz": {
          "color": 13378048,
          "nodraw": false
        },
        "nz": {
          "color": 13378048,
          "nodraw": false
        }
      }
    }
  ],
  "navMesh": [
    {
      "x": -8,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -8,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -8,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -7,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -7,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -6,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -6,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -5,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -4,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -3,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -2,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -8,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -7,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -6,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -5,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -4,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -3,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -2,
      "elevation": 0
    },
    {
      "x": -1,
      "z": -1,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 0,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 1,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 2,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 3,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 4,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 5,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 6,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 7,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 0,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 1,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 2,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 3,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 4,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 5,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 6,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 6,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 7,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 7,
      "z": 8,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 8,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 7,
      "elevation": 0
    },
    {
      "x": 8,
      "z": 8,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 9,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 10,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 11,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 12,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 13,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 9,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 10,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 11,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 12,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 13,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 9,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 10,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 11,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 12,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 13,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 14,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 15,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 16,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 17,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 18,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 19,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 20,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 21,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 22,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 23,
      "elevation": 0
    },
    {
      "x": -5,
      "z": 24,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 14,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 15,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 16,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 17,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 18,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 19,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 20,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 21,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 22,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 23,
      "elevation": 0
    },
    {
      "x": -4,
      "z": 24,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 14,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 15,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 16,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 17,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 18,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 19,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 20,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 21,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 22,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 23,
      "elevation": 0
    },
    {
      "x": -3,
      "z": 24,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 14,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 15,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 16,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 17,
      "elevation": 0.9
    },
    {
      "x": -2,
      "z": 18,
      "elevation": 0.9
    },
    {
      "x": -2,
      "z": 19,
      "elevation": 0.9
    },
    {
      "x": -2,
      "z": 20,
      "elevation": 0.9
    },
    {
      "x": -2,
      "z": 21,
      "elevation": 0.9
    },
    {
      "x": -2,
      "z": 22,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 23,
      "elevation": 0
    },
    {
      "x": -2,
      "z": 24,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 14,
      "elevation": 0
    },
    {
      "x": -1,
      "z": 15,
      "elevation": 0.3
    },
    {
      "x": -1,
      "z": 16,
      "elevation": 0.6
    },
    {
      "x": -1,
      "z": 17,
      "elevation": 0.9
    },
    {
      "x": -1,
      "z": 18,
      "elevation": 0.9
    },
    {
      "x": -1,
      "z": 19,
      "elevation": 0.9
    },
    {
      "x": -1,
      "z": 20,
      "elevation": 0.9
    },
    {
      "x": -1,
      "z": 21,
      "elevation": 0.9
    },
    {
      "x": -1,
      "z": 22,
      "elevation": 0.6
    },
    {
      "x": -1,
      "z": 23,
      "elevation": 0.3
    },
    {
      "x": -1,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 14,
      "elevation": 0
    },
    {
      "x": 0,
      "z": 15,
      "elevation": 0.3
    },
    {
      "x": 0,
      "z": 16,
      "elevation": 0.6
    },
    {
      "x": 0,
      "z": 17,
      "elevation": 0.9
    },
    {
      "x": 0,
      "z": 18,
      "elevation": 0.9
    },
    {
      "x": 0,
      "z": 19,
      "elevation": 0.9
    },
    {
      "x": 0,
      "z": 20,
      "elevation": 0.9
    },
    {
      "x": 0,
      "z": 21,
      "elevation": 0.9
    },
    {
      "x": 0,
      "z": 22,
      "elevation": 0.6
    },
    {
      "x": 0,
      "z": 23,
      "elevation": 0.3
    },
    {
      "x": 0,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 14,
      "elevation": 0
    },
    {
      "x": 1,
      "z": 15,
      "elevation": 0.3
    },
    {
      "x": 1,
      "z": 16,
      "elevation": 0.6
    },
    {
      "x": 1,
      "z": 17,
      "elevation": 0.9
    },
    {
      "x": 1,
      "z": 18,
      "elevation": 0.9
    },
    {
      "x": 1,
      "z": 19,
      "elevation": 0.9
    },
    {
      "x": 1,
      "z": 20,
      "elevation": 0.9
    },
    {
      "x": 1,
      "z": 21,
      "elevation": 0.9
    },
    {
      "x": 1,
      "z": 22,
      "elevation": 0.6
    },
    {
      "x": 1,
      "z": 23,
      "elevation": 0.3
    },
    {
      "x": 1,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 14,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 15,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 16,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 17,
      "elevation": 0.9
    },
    {
      "x": 2,
      "z": 18,
      "elevation": 0.9
    },
    {
      "x": 2,
      "z": 19,
      "elevation": 0.9
    },
    {
      "x": 2,
      "z": 20,
      "elevation": 0.9
    },
    {
      "x": 2,
      "z": 21,
      "elevation": 0.9
    },
    {
      "x": 2,
      "z": 22,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 23,
      "elevation": 0
    },
    {
      "x": 2,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 14,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 15,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 16,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 17,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 18,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 19,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 20,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 21,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 22,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 23,
      "elevation": 0
    },
    {
      "x": 3,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 14,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 15,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 16,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 17,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 18,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 19,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 20,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 21,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 22,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 23,
      "elevation": 0
    },
    {
      "x": 4,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 14,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 15,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 16,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 17,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 18,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 19,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 20,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 21,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 22,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 23,
      "elevation": 0
    },
    {
      "x": 5,
      "z": 24,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 9,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 9,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 10,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 10,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 11,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 12,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 12,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 13,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 13,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 14,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 14,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 15,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 15,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 16,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 16,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 17,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 17,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 18,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 18,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 19,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 19,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 20,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 20,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 21,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 21,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -10,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -9,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -8,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -7,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -6,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -5,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -4,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -3,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -2,
      "elevation": 0
    },
    {
      "x": 22,
      "z": -1,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 0,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 1,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 2,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 3,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 4,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 5,
      "elevation": 0
    },
    {
      "x": 22,
      "z": 6,
      "elevation": 0
    },
    {
      "x": 11,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 11,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 12,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 16,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 17,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 18,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 12,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 13,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 14,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 15,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 19,
      "elevation": 1.5
    },
    {
      "x": 19,
      "z": 20,
      "elevation": 1.5
    },
    {
      "x": 6,
      "z": 16,
      "elevation": 0.3
    },
    {
      "x": 6,
      "z": 17,
      "elevation": 0.3
    },
    {
      "x": 6,
      "z": 18,
      "elevation": 0.3
    },
    {
      "x": 7,
      "z": 16,
      "elevation": 0.6
    },
    {
      "x": 7,
      "z": 17,
      "elevation": 0.6
    },
    {
      "x": 7,
      "z": 18,
      "elevation": 0.6
    },
    {
      "x": 8,
      "z": 16,
      "elevation": 0.9
    },
    {
      "x": 8,
      "z": 17,
      "elevation": 0.9
    },
    {
      "x": 8,
      "z": 18,
      "elevation": 0.9
    },
    {
      "x": 9,
      "z": 16,
      "elevation": 1.2
    },
    {
      "x": 9,
      "z": 17,
      "elevation": 1.2
    },
    {
      "x": 9,
      "z": 18,
      "elevation": 1.2
    },
    {
      "x": 10,
      "z": 16,
      "elevation": 1.5
    },
    {
      "x": 10,
      "z": 17,
      "elevation": 1.5
    },
    {
      "x": 10,
      "z": 18,
      "elevation": 1.5
    },
    {
      "x": 13,
      "z": 7,
      "elevation": 0.3
    },
    {
      "x": 14,
      "z": 7,
      "elevation": 0.3
    },
    {
      "x": 15,
      "z": 7,
      "elevation": 0.3
    },
    {
      "x": 13,
      "z": 8,
      "elevation": 0.6
    },
    {
      "x": 14,
      "z": 8,
      "elevation": 0.6
    },
    {
      "x": 15,
      "z": 8,
      "elevation": 0.6
    },
    {
      "x": 13,
      "z": 9,
      "elevation": 0.9
    },
    {
      "x": 14,
      "z": 9,
      "elevation": 0.9
    },
    {
      "x": 15,
      "z": 9,
      "elevation": 0.9
    },
    {
      "x": 13,
      "z": 10,
      "elevation": 1.2
    },
    {
      "x": 14,
      "z": 10,
      "elevation": 1.2
    },
    {
      "x": 15,
      "z": 10,
      "elevation": 1.2
    },
    {
      "x": 13,
      "z": 11,
      "elevation": 1.5
    },
    {
      "x": 14,
      "z": 11,
      "elevation": 1.5
    },
    {
      "x": 15,
      "z": 11,
      "elevation": 1.5
    }
  ],
  "groups": [],
  "entities": [
    {
      "id": "spawn",
      "entityType": "spawn",
      "x": 0,
      "y": 0,
      "z": 0
    },
    {
      "id": "light_lava",
      "entityType": "light",
      "x": 6,
      "y": 1.5,
      "z": 6,
      "color": 16733440,
      "intensity": 2,
      "distance": 10,
      "pulse": {
        "base": 1.8,
        "amp": 0.6,
        "freq": 2.8
      }
    },
    {
      "id": "light_altar",
      "entityType": "light",
      "x": 0,
      "y": 3.1,
      "z": 19,
      "color": 7368959,
      "intensity": 1.5,
      "distance": 10,
      "pulse": {
        "base": 1.2,
        "amp": 0.4,
        "freq": 1.5
      }
    },
    {
      "id": "light_room3",
      "entityType": "light",
      "x": 15,
      "y": 4.5,
      "z": 16,
      "color": 16752688,
      "intensity": 1.4,
      "distance": 18,
      "pulse": {
        "base": 1.2,
        "amp": 0.35,
        "freq": 1.1,
        "phase": 1.2
      }
    },
    {
      "id": "light_room4",
      "entityType": "light",
      "x": 15.5,
      "y": 3,
      "z": -2,
      "color": 6340720,
      "intensity": 1.5,
      "distance": 22,
      "pulse": {
        "base": 1.2,
        "amp": 0.35,
        "freq": 0.9,
        "phase": 2.1
      }
    }
  ]
};
}());
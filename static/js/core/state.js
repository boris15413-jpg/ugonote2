'use strict';
(function(G){
  const C=G.Config;

  const state = {
    CW:C.DEFAULT_WIDTH, CH:C.DEFAULT_HEIGHT, ratio:C.DEFAULT_RATIO,
    layerOrder:['C','B','A'],
    frames:[], fc:new Map(),
    lruOrder:[],
    dirtyIds:new Set(), dirtyLayers:new Map(),
    cf:0, cl:'A', ct:'pen',
    cc:'#111111', cs:4, alpha:1,
    pc:'#FFFFFF',
    zoom:1, panX:0, panY:0,
    drawing:false, panning:false, playing:false,
    onion:false, onionCount:2, onionOpacity:0.25,
    fps:C.DEFAULT_FPS,
    lx:0, ly:0, sx:0, sy:0,
    sel:null, clip:null, frClip:null,
    txX:0, txY:0, txFs:28,
    undoStack:[], redoStack:[], maxUndo:C.MAX_UNDO,
    bgmBuf:null, bgmVol:1, sfxVol:1,
    seBuffers: [null, null, null, null],
    seNames: ['SE1', 'SE2', 'SE3', 'SE4'],
    pts:[], eSnap:null, img:null,
    penOut:false, penOutC:'#FFFFFF', penOutW:3,
    penSmooth:4,
    grid:false, gridSize:32,
    pressure:false,
    symmetry:'none',
    lassoPath:[],
    shapeFill:false,
    modified:false,
    autoSaveTimer:null,
    pixelMode:false,
    pixelSize:16,
    currentPage:'canvas',
    colorHistory:['#111111','#E02020','#2060E0','#20A020'],
    vectorPaths: new Map(),
    cpMode: false,
    cpSelectedPath: null,
    cpSelectedPoint: -1,
    cpDragging: false,
    cpHoverPath: null,
    cpHoverPoint: -1,
    loopPlay: false,
    recWhilePlaying: false,
    transformMode: false,
    transformData: null,
  };

  const thumbs = new Map();
  G.State=state;
  G.Thumbs=thumbs;
})(window.UgokuDraw);
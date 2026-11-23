// Pixel-Art-Sprites für Timos Turbo Run (alles selbst gezeichnet, als Text-Raster)
'use strict';

function makeSprite(rows, pal) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const col = pal[r[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}
function mirrorRows(rows) {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(w, '.').split('').reverse().join(''));
}
function sym(half) { // linke Hälfte spiegeln
  return half.map(r => r + r.split('').reverse().join(''));
}
function overlay(base, over) {
  return base.map((r, y) => {
    const o = over[y]; if (!o) return r;
    let s = r.split('');
    for (let x = 0; x < o.length; x++) if (o[x] !== '.') s[x] = o[x];
    return s.join('');
  });
}

const PAL_TIMO = {
  o: '#3a2418', f: '#f6ead4', s: '#dcc6a2', h: '#fffaf0', p: '#e8a39a', c: '#8e4a22', g: '#e8b830', n: '#5a3a2a'
};

// Timo von hinten: Kopf + Körper symmetrisch
const TIMO_BODY = sym([
  '...oo......',
  '..ofo......',
  '..ofso.....',
  '.ofssfo....',
  '.ofsffooooo',
  '.offffffffh',
  '..offfffffh',
  '..offfffffh',
  '...offffffh',
  '....offffff',
  '.....occccc',
  '....offffff',
  '..offfffffh',
  '.offffffffh',
  '.offffffffh',
  'offfffffffh',
  'osffffffffh',
  'osfffffffff',
  'ossffffffff',
  '.ossfffffss',
  '.oossssssss',
]);
const TIMO_TAIL = [
  '', '', '', '', '', '', '', '', '',
  '...............ooo....',
  '..............ohhho...',
  '..............ohffo...',
  '...............offso..',
  '..............offso...',
  '.............offso....',
  '............ofsso.....',
  '...........osso.......',
];
const TIMO_LEGS_A = [
  '..offso......osffo....',
  '..offso......ohhho....',
  '..offso......ooooo....',
  '..ohhho...............',
  '..ooooo...............',
];
const TIMO_LEGS_JUMP = [
  '..ohhho......ohhho....',
  '..ooooo......ooooo....',
];
const timoRunA = overlay(TIMO_BODY, TIMO_TAIL).concat(TIMO_LEGS_A);
const timoRunB = mirrorRows(timoRunA);
const timoJump = overlay(TIMO_BODY, TIMO_TAIL).concat(TIMO_LEGS_JUMP, ['', '', '']);

// Dr. Spritz, der Tierarzt, von hinten mit erhobener Spritze
const PAL_VET = {
  o: '#1e1e28', b: '#6b4226', k: '#f0c49c', w: '#ffffff', x: '#c9d4de', d: '#34508a', e: '#18181c',
  y: '#a8e6ff', n: '#d0d0d0', r: '#d84040', m: '#8a8a8a', g: '#2c2c2c'
};
const VET_TOP = [
  '....................n....',
  '....................n....',
  '...................oyo...',
  '...................oyo...',
  '...................oyo...',
  '...................oyo...',
  '..................ooroo..',
  '...................oko...',
  '.........oooo......oko...',
  '........obbbbo.....owo...',
  '.......obbkkbbo....owo...',
  '.......ommmmmmo...owxo...',
  '.......obbbbbbo...owo....',
  '........obbbbo...owxo....',
  '......ooookkooooowo......',
  '.ook.owwwwwwwwwwwwxo.....',
  '.okwowwwgwwwwwgwwwxo.....',
  '..owwwwwwgwxwgwwwwxo.....',
  '...oowwwwwgxgwwwwwxo.....',
  '.....owwwwwxwwwwwwxo.....',
  '.....owwwwwxwwwwwwxo.....',
  '.....owwwwwxwwwwwwxo.....',
  '.....owwwwwxwwwwwwxo.....',
  '.....owwwwwxwwwwwwxo.....',
  '.....oxxxxxoxxxxxxxo.....',
];
const vetA = VET_TOP.concat([
  '......oddddoddddddo......',
  '......oddddo.oddddo......',
  '......oddddo.oddddo......',
  '......oddddo.oeeeeo......',
  '......oeeeeo.oooooo......',
  '......oooooo.............',
]);
const vetB = VET_TOP.concat([
  '......oddddoddddddo......',
  '......oddddo.oddddo......',
  '......oddddo.oddddo......',
  '......oeeeeo.oddddo......',
  '......oooooo.oeeeeo......',
  '.............oooooo......',
]);

// Hundekrokette (knochenförmig)
const PAL_KK = { o: '#4a2810', b: '#a8642c', h: '#e09a58', d: '#7a4418' };
const kroketteRows = [
  '.oo.....oo.',
  'ohho...ohbo',
  'ohbboooobdo',
  '.obhhbbbdo.',
  'obbbooobbdo',
  'obdo...obdo',
  '.oo.....oo.',
];

// Power-Ups
const magnetRows = [
  '.ooo...ooo.',
  'orrro.orrro',
  'orrro.orrro',
  'orrro.orrro',
  'orrrooorrro',
  'orrrrrrrrro',
  '.orrrrrrro.',
  '..ooooooo..',
  '...........',
].map(r => r);
const magnetTips = ['.ooo...ooo.', 'owwwo.owwwo'];
const PAL_PU = {
  o: '#202030', r: '#e03838', w: '#e8e8f0', b: '#3c7cff', l: '#9cc4ff', y: '#ffd83a', a: '#ff9a1a',
  g: '#9a9aa6', G: '#6a6a78', p: '#ffffff', k: '#30303c', s: '#55dd66', f: '#f6ead4'
};
const magnetFull = overlay(magnetRows, magnetTips);
const shieldRows = [
  'ooooooooooo',
  'obbbbbbbbbo',
  'oblllllllbo',
  'oblfblfblbo',
  'oblllllllbo',
  'oblbfffblbo',
  '.oblfffblo.',
  '.obllllbbo.',
  '..obbbbbo..',
  '...obbbo...',
  '....ooo....',
];
const turboRows = [
  '...ooooo...',
  '..oaaaaao..',
  '.oaaayyaao.',
  'oaaayyaaaao',
  'oaayyyyyaao',
  'oaaaayyaaao',
  'oaaayyaaaao',
  '.oayyaaaao.',
  '..oaaaaao..',
  '...ooooo...',
];
const faxRows = [
  '....oooooo....',
  '....oppppo....',
  '....opkkpo....',
  '....oppppo....',
  '.oooooooooooo.',
  'oggggggggggggo',
  'oGGGGGGGGGGGGo',
  'oggkkkkgswswgo',
  'oggkllkgwswsgo',
  'oggkkkkgswswgo',
  'oGGGGGGGGGGGGo',
  '.oooooooooooo.',
];

// Deko
const PAL_DECO = {
  o: '#1f3a1a', g: '#3e9a3a', G: '#2c7a2c', l: '#6cc858', t: '#7a4a24', T: '#5a3418', y: '#ffe060',
  w: '#ffffff', r: '#ff6a8a', k: '#2a2a2a', m: '#c8c8c8', a: '#e8c070', p: '#b06a3a', P: '#8a4a28',
  b: '#5a8ad8', e: '#e0e0d0', v: '#3a6a32', c: '#d0e8ff', s: '#8a8a8a'
};
const treeRows = [
  '.......oooooo.......',
  '.....oollllggoo.....',
  '...oolllglgggGGoo...',
  '..ollllgggggGGGGGo..',
  '.olllggggggggGGGGGo.',
  '.ollgggggGgggggGGGo.',
  'olllgggggggggGGGGGGo',
  'ollgggGgggggggGGGGGo',
  'olggggggggGgggGGGGGo',
  'ogggggggggggggGGGGGo',
  'oggGgggggggggGGGGGGo',
  '.ogggggggGgggGGGGGo.',
  '.oGgggggggggGGGGGGo.',
  '..oGGgggggGGGGGGGo..',
  '...ooGGGGGGGGGGoo...',
  '.....oooottoooo.....',
  '........otTo........',
  '........otTo........',
  '........otTo........',
  '........otTo........',
  '.......ottTTo.......',
  '......oooooooo......',
];
const lampRows = [
  '.ooooo.',
  'oyyyyyo',
  '.ommmo.',
  '..oko..',
  '..oko..',
  '..oko..',
  '..oko..',
  '..oko..',
  '..oko..',
  '..oko..',
  '..oko..',
  '..oko..',
  '.okkko.',
  'ooooooo',
];
const flowerRows = [
  '.w.r..',
  'wyw.ry',
  '.w.vr.',
  '.v..v.',
  'vvv.v.',
];
const plantRows = [
  '..o.ooo..',
  '.ogoglgo.',
  'oglgggglo',
  'ogggGgggo',
  '.ogGgGgo.',
  'oglggggGo',
  '.ogGggGo.',
  '..ooGoo..',
  '..ppppp..',
  '..pPPPp..',
  '..ppppp..',
  '...ppp...',
];
const floorLampRows = [
  '..ooooo..',
  '.oaaaaao.',
  'oaaaaaaao',
  'ooooooooo',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '....k....',
  '...kkk...',
];
const coolerRows = [
  '..ooooo..',
  '.occccco.',
  '.occccco.',
  '.occccco.',
  '..ooooo..',
  '.oeeeeeo.',
  '.oebrbeo.',
  '.oeeeeeo.',
  '.oeeeeeo.',
  '.oeeeeeo.',
  '.oeeeeeo.',
  '.ooooooo.',
];

const SPR = {};
function buildSprites() {
  SPR.timoA = makeSprite(timoRunA, PAL_TIMO);
  SPR.timoB = makeSprite(timoRunB, PAL_TIMO);
  SPR.timoJ = makeSprite(timoJump, PAL_TIMO);
  SPR.vetA = makeSprite(vetA, PAL_VET);
  SPR.vetB = makeSprite(vetB, PAL_VET);
  SPR.kk = makeSprite(kroketteRows, PAL_KK);
  SPR.magnet = makeSprite(magnetFull, PAL_PU);
  SPR.shield = makeSprite(shieldRows, PAL_PU);
  SPR.turbo = makeSprite([
    '...t..t.....',
    '..t..t......',
    '...t..t.....',
    '..t..t......',
    'ooooooooo...',
    'occchcccoooo',
    'owwwwwwwo..o',
    'owwwwwwwo..o',
    'owwwwwwwoooo',
    '.owwwwwo....',
    'oooooooooooo',
    'ogggggggggo.',
    '.oooooooooo.',
  ], { o: '#2a1a12', w: '#ffffff', c: '#6b3a1a', h: '#a0643a', g: '#d8d8e0', t: '#e8e8f0' });
  SPR.fax = makeSprite(faxRows, PAL_PU);
  SPR.tree = makeSprite(treeRows, PAL_DECO);
  SPR.lamp = makeSprite(lampRows, PAL_DECO);
  SPR.flower = makeSprite(flowerRows, PAL_DECO);
  SPR.plant = makeSprite(plantRows, PAL_DECO);
  SPR.floorLamp = makeSprite(floorLampRows, PAL_DECO);
  SPR.cooler = makeSprite(coolerRows, PAL_DECO);
  // Papierblatt für Fax-Effekt
  SPR.paper = makeSprite(['ooooo', 'opppo', 'okkpo', 'opppo', 'okkko', 'ooooo'], PAL_PU);
  SPR.star = makeSprite(['..y..', '.yyy.', 'yyyyy', '.yyy.', '..y..'], PAL_PU);
}

// Schild mit Text (für Tore zwischen den Levels)
function makeSign(text, bg, fg) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '8px "Press Start 2P", monospace';
  const w = Math.ceil(g.measureText(text).width) + 10;
  c.width = w; c.height = 16;
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, 16);
  g.fillStyle = bg; g.fillRect(1, 1, w - 2, 14);
  g.fillStyle = fg; g.font = '8px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  g.fillText(text, 5, 4);
  return c;
}

/* =============================================================================
   The character grid.
   The screen is a grid of COLS × ROWS cells, like a terminal. Every frame the
   scene is built into the per-cell layers below (one value per cell), and the
   renderer turns each cell into one coloured character on the canvas.
   ============================================================================= */

const canvas = $("c");
const ctx = canvas.getContext("2d", { alpha: false });
const FONT = '"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace';

let W, H;          // viewport size in px
let FS;            // font size in px
let CW, CH;        // cell width / height in px
let COLS, ROWS, N; // grid size, N = COLS × ROWS
let SC;            // scale relative to a 14px font: sizes and speeds are multiplied by it

// ---- per-cell layers (index = row * COLS + col), rebuilt every frame ----
let cellGlyph, cellR, cellG, cellB;      // final character + colour
let rippleStrength, rippleGlyph;         // strongest ripple ring in the cell + its character
let lanternGlow;                         // warm light from lanterns
let koiShadow;                           // koi shadow on the floor / dark rim around a body
let causticNet;                          // the moving net of light on the water
let koiDepth, koiGlyph, koiR, koiG, koiB; // koi layer (depth -1 = no koi here)
let titleGlyph, titleAlpha;              // the name (only rebuilt on resize)
let titleBoxes = [];                     // tight boxes around each line of the name: the koi keep out

function resize() {
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  FS = W < 640 ? 11 : W < 1150 ? 13 : 14;
  SC = FS / 14;
  ctx.font = `${FS}px ${FONT}`;
  CW = ctx.measureText("M").width;
  CH = Math.round(FS * 1.22);
  COLS = Math.ceil(W / CW);
  ROWS = Math.ceil(H / CH);
  N = COLS * ROWS;

  cellGlyph = new Array(N);
  cellR = new Float32Array(N);
  cellG = new Float32Array(N);
  cellB = new Float32Array(N);
  rippleStrength = new Float32Array(N);
  rippleGlyph = new Array(N);
  lanternGlow = new Float32Array(N);
  koiShadow = new Float32Array(N);
  causticNet = new Float32Array(N);
  koiDepth = new Float32Array(N);
  koiGlyph = new Array(N);
  koiR = new Float32Array(N);
  koiG = new Float32Array(N);
  koiB = new Float32Array(N);

  buildTitle();
  placePads();
  // nav lanterns get new homes in the side margins
  lanterns.forEach((L, i) => {
    if (L.kind !== "nav") return;
    [L.homeX, L.homeY] = lanternHome(i);
    L.x = clamp(L.x, 40, W - 40);
    L.y = clamp(L.y, 40, H - 40);
  });
}

/** cell index of a point in px, or -1 if it's off the grid */
function cellAt(x, y) {
  const i = (x / CW) | 0, j = (y / CH) | 0;
  return i < 0 || i >= COLS || j < 0 || j >= ROWS ? -1 : j * COLS + i;
}

/** the range of cells covering a circle (clipped to the grid) */
function cellRange(x, y, r) {
  return {
    i0: Math.max(0, ((x - r) / CW) | 0),
    i1: Math.min(COLS - 1, ((x + r) / CW) | 0),
    j0: Math.max(0, ((y - r) / CH) | 0),
    j1: Math.min(ROWS - 1, ((y + r) / CH) | 0),
  };
}

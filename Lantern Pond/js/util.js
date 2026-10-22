/* =============================================================================
   Small helpers used everywhere: maths, smooth noise, glyphs and colours.
   ============================================================================= */

const $ = id => document.getElementById(id);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
/** an angle folded into -π..π */
const wrapAngle = a => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

// ---- value noise -----------------------------------------------------------
// a shuffled table of 0..255, doubled so lookups never need wrapping
const PERM = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

/** a stable pseudo-random value 0..1 for integer coordinates */
const hash2 = (i, j) => PERM[PERM[i & 255] + (j & 255)] / 255;

/** smooth value noise 0..1: hashes at the grid corners, blended with a smoothstep */
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---- glyphs & colour -------------------------------------------------------
/** the character that best draws a line running at angle phi (screen space, y down) */
function lineGlyph(phi) {
  const deg = (((phi * 180) / Math.PI) % 180 + 180) % 180;
  return deg < 22.5 || deg >= 157.5 ? "-" : deg < 67.5 ? "\\" : deg < 112.5 ? "|" : "/";
}

/** an "rgb(…)" string, quantised to 5 bits per channel and cached (the renderer asks for thousands per frame) */
const colourCache = new Array(32768);
function rgb(r, g, b) {
  r = clamp(r, 0, 255) >> 3;
  g = clamp(g, 0, 255) >> 3;
  b = clamp(b, 0, 255) >> 3;
  const key = (r << 10) | (g << 5) | b;
  return colourCache[key] || (colourCache[key] = `rgb(${(r << 3) | 4},${(g << 3) | 4},${(b << 3) | 4})`);
}

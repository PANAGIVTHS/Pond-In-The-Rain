/* =============================================================================
   The name on the water, and the lily pads.
   The name is drawn once (on resize) onto a hidden canvas, then each cell is
   sampled to see how much of it the letters cover; coverage picks a character.
   ============================================================================= */

// how a cell's coverage (c, 0..1) becomes a character: [glyph, opacity], or null for an empty cell.
// e.edge = the cell sits on an outline, e.angleFrom45 = how far that outline is from a 45° diagonal,
// e.slash = the / or \ that follows it. (Copied verbatim from headers/header_soft.html and header_ascii.html.)
const TITLE_STYLES = {
  soft: (c, e) => {
    if (c < 0.07) return null;
    return [c > 0.74 ? "█" : c > 0.52 ? "▓" : c > 0.32 ? "▒" : c > 0.18 ? "░" : c > 0.11 ? ":" : "·", c > 0.32 ? 0.9 : 0.6];
  },
  ascii: (c, e) => {
    if (c < 0.1) return null;
    const ramp = ".:-=+*#%@";
    let g = ramp[Math.min(ramp.length - 1, Math.floor(c * ramp.length * 1.05))];
    if (e.edge && e.angleFrom45 < 20 && c > 0.18 && c < 0.65) g = e.slash;
    return [g, 0.95];
  },
};

function buildTitle() {
  titleGlyph = new Array(N).fill(null);
  titleAlpha = new Float32Array(N);

  // 1. draw the name, white on transparent, onto an offscreen canvas the size of the screen
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const o = off.getContext("2d");
  const lines = CONFIG.name.split("\n"), nl = lines.length;
  let size = Math.min(H * (nl > 1 ? 0.2 : 0.21), W * 0.2);
  const setFont = () => (o.font = `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`);
  setFont();
  const textW = Math.max(...lines.map(l => o.measureText(l).width));
  if (textW > W * 0.86) {
    size *= (W * 0.86) / textW;
    setFont();
  }
  const lineH = size * 0.92;
  const lastY = H * 0.29 + ((nl - 1) * lineH) / 2; // the last line sits where a one-line name would
  o.fillStyle = "#fff";
  o.textAlign = "center";
  o.textBaseline = "middle";
  lines.forEach((l, n) => o.fillText(l, W / 2, lastY - (nl - 1 - n) * lineH));

  // 2. sample each cell at 3×3 points: average coverage and the strongest single sample
  const px = o.getImageData(0, 0, W, H).data;
  const cover = new Float32Array(N), peak = new Float32Array(N);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const s = [];
      for (const oy of [0.17, 0.5, 0.83])
        for (const ox of [0.17, 0.5, 0.83]) {
          const x = Math.min(W - 1, ((i + ox) * CW) | 0), y = Math.min(H - 1, ((j + oy) * CH) | 0);
          s.push(px[(y * W + x) * 4 + 3] / 255);
        }
      const k = j * COLS + i;
      let sum = 0;
      for (const v of s) sum += v;
      cover[k] = sum / 9;
      peak[k] = Math.max(...s);
    }

  // 3. coverage → characters, with outline direction from the coverage gradient
  const rule = TITLE_STYLES[CONFIG.titleStyle] || TITLE_STYLES.ascii;
  for (let j = 1; j < ROWS - 1; j++)
    for (let i = 1; i < COLS - 1; i++) {
      const k = j * COLS + i, c = cover[k];
      if (peak[k] < 0.05) continue;
      const gx = (cover[k + 1] - cover[k - 1]) / CW, gy = (cover[k + COLS] - cover[k - COLS]) / CH;
      const m = Math.hypot(gx * CW, gy * CH);
      const e = {
        edge: c < 0.85 && (m > 0.3 || c < 0.45),
        angleFrom45: Math.abs((Math.atan2(Math.abs(gy) * CH, Math.abs(gx) * CW) * 180) / Math.PI - 45),
        slash: lineGlyph(Math.atan2(gy, gx) + Math.PI / 2),
      };
      const r = rule(c, e);
      if (!r) continue;
      titleGlyph[k] = r[0];
      titleAlpha[k] = r[1];
    }

  // 4. a tight box around each line of the name: the koi keep out so it stays readable
  titleBoxes = lines
    .map((_, n) => {
      const cy = lastY - (nl - 1 - n) * lineH;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < N; k++) {
        if (!titleGlyph[k]) continue;
        const x = ((k % COLS) + 0.5) * CW, y = (((k / COLS) | 0) + 0.5) * CH;
        if (Math.abs(y - cy) > lineH * 0.62) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      const pad = CW * 0.8;
      return x1 > x0 ? { x0: x0 - pad, y0: y0 - CH * 0.6, x1: x1 + pad, y1: y1 + CH * 0.6 } : null;
    })
    .filter(Boolean);

  // 5. the tagline, one row under the name
  const row = Math.round((lastY + size * 0.58) / CH) + 1;
  const tag = CONFIG.tagline.toLowerCase(), start = Math.round(COLS / 2 - tag.length / 2);
  for (let n = 0; n < tag.length; n++) {
    const i = start + n;
    if (i < 0 || i >= COLS || tag[n] === " ") continue;
    const k = row * COLS + i;
    titleGlyph[k] = tag[n];
    titleAlpha[k] = 0.7;
  }
}

/** is the name showing? (it fades out as you scroll down) */
const titleVisible = () => scrollY < H * 0.4;

/** distance from a point to a box (0 inside) and the unit direction out of it */
function boxAway(b, x, y) {
  const dx = x < b.x0 ? x - b.x0 : x > b.x1 ? x - b.x1 : 0;
  const dy = y < b.y0 ? y - b.y0 : y > b.y1 ? y - b.y1 : 0;
  if (dx || dy) {
    const d = Math.hypot(dx, dy);
    return { d, ux: dx / d, uy: dy / d };
  }
  // inside: leave by the nearest side
  const l = x - b.x0, r = b.x1 - x, t = y - b.y0, bt = b.y1 - y, m = Math.min(l, r, t, bt);
  return { d: 0, ux: m === l ? -1 : m === r ? 1 : 0, uy: m === t ? -1 : m === bt ? 1 : 0 };
}

// ---- lily pads -------------------------------------------------------------
let pads = [];
function placePads() {
  // x, y (fractions of the screen), radius, has a flower
  const spots = [[0.09, 0.8, 62, 1], [0.9, 0.72, 54, 0], [0.14, 0.16, 44, 0], [0.85, 0.17, 50, 1], [0.6, 0.9, 40, 0], [0.38, 0.62, 30, 0]];
  pads = spots.map(([x, y, r, flower]) => ({
    x: x * W,
    y: y * H,
    radius: r * SC * (W < 640 ? 0.8 : 1),
    notch: rnd(0, 6.28),
    flower,
    bobPhase: rnd(0, 6),
  }));
}

/* =============================================================================
   Rendering. Each frame, in order:
   1. light layers: the caustic net and ripple rings
   2. composite: every cell becomes water, plus ripples and light
   3. things on the surface: rain
   4. paint: one character per cell onto the canvas
   ============================================================================= */

function render() {
  rippleStrength.fill(0);
  const aspect = CH / CW;

  drawCaustics(aspect);
  drawRipples();
  composite(aspect);

  drawSurfaceBits();
  paint();
}

/** the moving net of light on the water: bright where two drifting noise fields meet */
function drawCaustics(aspect) {
  for (let j = 0; j < ROWS; j++) {
    const y = j * aspect * 0.085;
    for (let i = 0; i < COLS; i++) {
      const x = i * 0.085;
      const n1 = noise(x * 0.9 + t * 0.085, y * 1.25 + t * 0.03) + 0.5 * noise(x * 2.1 - t * 0.05, y * 2.4 + t * 0.04);
      const n2 = noise(x * 1.1 - t * 0.06 + 13.7, y * 1.0 - t * 0.045 + 7.1) + 0.5 * noise(x * 1.9 + t * 0.07 + 3.3, y * 2.2 - t * 0.03 + 9.9);
      let v = 1 - Math.abs(n1 - n2) * 3.1;
      v = v < 0 ? 0 : v;
      causticNet[j * COLS + i] = v * v * v;
    }
  }
}

/** ripple rings, drawn with the character that follows the ring's tangent at each cell */
function drawRipples() {
  for (const rp of ripples) {
    if (rp.r < 0) continue; // not started yet
    const life = Math.pow(1 - rp.r / rp.max, 1.3) * rp.strength;
    const { i0, i1, j0, j1 } = cellRange(rp.x, rp.y, rp.r + CH);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * CW - rp.x, dy = (j + 0.5) * CH - rp.y, d = Math.hypot(dx, dy) || 1;
        const width = Math.hypot((0.62 * CW * dx) / d, (0.6 * CH * dy) / d) + 0.5; // a ring one cell thick, whatever its direction
        const off = Math.abs(d - rp.r) / width;
        if (off > 1) continue;
        const s = (1 - off) * life, k = j * COLS + i;
        if (s > rippleStrength[k]) {
          rippleStrength[k] = s;
          rippleGlyph[k] = rp.r < 5 * SC ? (rp.strength > 1 ? "o" : "°") : lineGlyph(Math.atan2(dy, dx) + Math.PI / 2);
        }
      }
  }
}

/** every cell becomes water, with ripples and light */
function composite(aspect) {
  for (let j = 0; j < ROWS; j++) {
    const y = j * aspect;
    for (let i = 0; i < COLS; i++) {
      const k = j * COLS + i;
      const dn = noise(i * 0.03 + t * 0.01, y * 0.03); // slow dark/light variation of the water
      const rp = rippleStrength[k], nt = causticNet[k];
      const L = nt * 0.9;
      let r = 5 + dn * 6 + L * 45;
      let g = 16 + dn * 12 + L * 120;
      let b = 24 + dn * 14 + L * 130;
      let ch;
      if (rp > 0.22) {
        ch = rippleGlyph[k];
        r += rp * 120;
        g += rp * 150;
        b += rp * 160;
      } else ch = L > 0.62 ? "~" : L > 0.4 ? "-" : L > 0.2 ? "·" : dn > 0.8 && hash2(i, j) > 0.93 ? "." : " ";
      cellGlyph[k] = ch;
      cellR[k] = r;
      cellG[k] = g;
      cellB[k] = b;
    }
  }
}

/** rain streaks */
function drawSurfaceBits() {
  for (const s of streaks) {
    const k = cellAt(s.x, s.y);
    if (k < 0) continue;
    if (cellGlyph[k] === " " || cellGlyph[k] === "·") {
      cellGlyph[k] = Math.random() < 0.5 ? "'" : ",";
      cellR[k] += 40;
      cellG[k] += 58;
      cellB[k] += 66;
    }
  }
}

/** puts it all on the canvas: the background, then one character per cell */
function paint() {
  ctx.fillStyle = "#040c11";
  ctx.fillRect(0, 0, W, H);

  ctx.font = `${FS}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  let lastStyle = null; // only change fillStyle when the colour changes
  for (let j = 0; j < ROWS; j++) {
    const y = (j + 0.5) * CH;
    for (let i = 0; i < COLS; i++) {
      const k = j * COLS + i, ch = cellGlyph[k];
      if (ch === " " || !ch) continue;
      const s = rgb(cellR[k], cellG[k], cellB[k]);
      if (s !== lastStyle) {
        ctx.fillStyle = s;
        lastStyle = s;
      }
      ctx.fillText(ch, i * CW, y);
    }
  }
}

/* =============================================================================
   Rendering. Each frame, in order:
   1. the caustic net of light
   2. composite: every cell becomes water
   3. paint: one character per cell onto the canvas
   ============================================================================= */

function render() {
  const aspect = CH / CW;

  drawCaustics(aspect);
  composite(aspect);

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

/** every cell becomes water, lit by the caustic net */
function composite(aspect) {
  for (let j = 0; j < ROWS; j++) {
    const y = j * aspect;
    for (let i = 0; i < COLS; i++) {
      const k = j * COLS + i;
      const dn = noise(i * 0.03 + t * 0.01, y * 0.03); // slow dark/light variation of the water
      const L = causticNet[k] * 0.9;
      cellGlyph[k] = L > 0.62 ? "~" : L > 0.4 ? "-" : L > 0.2 ? "·" : dn > 0.8 && hash2(i, j) > 0.93 ? "." : " ";
      cellR[k] = 5 + dn * 6 + L * 45;
      cellG[k] = 16 + dn * 12 + L * 120;
      cellB[k] = 24 + dn * 14 + L * 130;
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

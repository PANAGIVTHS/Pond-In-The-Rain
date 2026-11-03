/* =============================================================================
   Rendering. Each frame, in order:
   1. light layers: the caustic net, ripple rings, lantern glow
   2. koi, deepest first, into the koi layer
   3. composite: every cell becomes koi or water, plus ripples and light
   4. things on the surface: lily pads, the name, rain, food, lanterns
   5. paint: one character per cell onto the canvas
   ============================================================================= */

const KOI_RAMP = "@%#&8o*+:"; // koi shading: dense in shadow → sparse in light
const LIGHT_DIR = (() => {    // light from the upper left
  const v = [-0.42, -0.56, 0.72], l = Math.hypot(...v);
  return v.map(x => x / l);
})();

function render() {
  rippleStrength.fill(0);
  lanternGlow.fill(0);
  koiShadow.fill(0);
  koiDepth.fill(-1);
  const aspect = CH / CW, scrollRows = scrollPix / CH;

  drawCaustics(aspect, scrollRows);
  drawRipples();
  drawLanternGlow();
  fish.sort((a, b) => a.depth - b.depth); // deep koi first
  for (const f of fish) stampKoi(f);
  composite(aspect, scrollRows);

  drawPads();
  drawTitle();
  drawSurfaceBits();
  const lanternSprites = drawLanterns();
  paint(lanternSprites);
}

/** the moving net of light on the water: bright where two drifting noise fields meet */
function drawCaustics(aspect, scrollRows) {
  for (let j = 0; j < ROWS; j++) {
    const y = (j + scrollRows) * aspect * 0.085;
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

/** warm lantern light on the water, flickering */
function drawLanternGlow() {
  for (const L of lanterns) {
    const R = (130 + L.hover * 30) * SC * Math.max(1, L.intensity);
    const flicker = 0.86 + 0.1 * Math.sin(L.phase * 7.3) + 0.06 * Math.sin(L.phase * 13.1);
    const { i0, i1, j0, j1 } = cellRange(L.x, L.y, R);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot((i + 0.5) * CW - L.x, (j + 0.5) * CH - L.y) / R;
        if (d < 1) {
          const q = 1 - d;
          lanternGlow[j * COLS + i] += q * q * flicker * (0.8 + 0.35 * L.hover);
        }
      }
  }
}

/** draws one koi into the koi layer: a shaded tube around the spine, eyes, a forked tail,
    pectoral fins, its shadow on the floor and a dark rim of water around it */
function stampKoi(f) {
  const nd = f.nodes, n = nd.length, R = f.radius, rad = BODY_PROFILE.map(p => p * R);

  // cells to visit: the spine's bounding box plus room for fins and tail
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const p of nd) {
    minx = Math.min(minx, p.x);
    maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y);
    maxy = Math.max(maxy, p.y);
  }
  const pad = R * 2.6;
  const i0 = Math.max(0, ((minx - pad) / CW) | 0), i1 = Math.min(COLS - 1, ((maxx + pad) / CW) | 0);
  const j0 = Math.max(0, ((miny - pad) / CH) | 0), j1 = Math.min(ROWS - 1, ((maxy + pad) / CH) | 0);

  // tail: sways a beat after the body
  const lx = nd[n - 1].x, ly = nd[n - 1].y;
  let tdx = lx - nd[n - 2].x, tdy = ly - nd[n - 2].y;
  const tl = Math.hypot(tdx, tdy) || 1;
  tdx /= tl;
  tdy /= tl;
  const sway = Math.sin(f.tailPhase - 2.4) * 0.5, cs = Math.cos(sway), sn = Math.sin(sway);
  const tailX = tdx * cs - tdy * sn, tailY = tdx * sn + tdy * cs, tailLen = R * 2.1;

  // pectoral fins: either side of node 2, flapping slowly
  let bx = nd[3].x - nd[1].x, by = nd[3].y - nd[1].y;
  const bl = Math.hypot(bx, by) || 1;
  bx /= bl;
  by /= bl;
  const bodyAngle = Math.atan2(by, bx);
  const fins = [-1, 1].map(side => {
    const a = bodyAngle + side * (0.95 + 0.25 * Math.sin(f.tailPhase * 0.8 + side));
    return { x: nd[2].x - by * side * rad[2] * 0.75, y: nd[2].y + bx * side * rad[2] * 0.75, dx: Math.cos(a), dy: Math.sin(a) };
  });

  // eyes
  let hx = nd[0].x - nd[1].x, hy = nd[0].y - nd[1].y;
  const hl = Math.hypot(hx, hy) || 1;
  hx /= hl;
  hy /= hl;
  const eyes = [-1, 1].map(side => ({
    x: nd[0].x + hx * rad[0] * 0.2 - hy * side * rad[0] * 0.62,
    y: nd[0].y + hy * rad[0] * 0.2 + hx * side * rad[0] * 0.62,
  }));

  const shadowDX = Math.round((15 * SC) / CW), shadowDY = Math.round((20 * SC) / CH);
  const depthFade = 0.25 + 0.75 * f.depth; // deeper koi fade toward the water colour
  const finC = f.variety.fin.map(c => lerp(c, 235, 0.25));

  for (let j = j0; j <= j1; j++) {
    const py = (j + 0.5) * CH;
    for (let i = i0; i <= i1; i++) {
      const px = (i + 0.5) * CW, idx = j * COLS + i;

      // nearest spine segment: bk = segment, bu = how far along it, bs = which side (signed)
      let best = 1e18, bk = 0, bu = 0, bs = 0, svx = 1, svy = 0;
      for (let k = 0; k < n - 1; k++) {
        const ax = nd[k].x, ay = nd[k].y, vx = nd[k + 1].x - ax, vy = nd[k + 1].y - ay, L2 = vx * vx + vy * vy || 1;
        let u = ((px - ax) * vx + (py - ay) * vy) / L2;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const qx = ax + vx * u - px, qy = ay + vy * u - py, d2 = qx * qx + qy * qy;
        if (d2 < best) {
          best = d2;
          bk = k;
          bu = u;
          bs = vx * (py - ay) - vy * (px - ax);
          svx = vx;
          svy = vy;
        }
      }
      const d = Math.sqrt(best), rr = rad[bk] + (rad[bk + 1] - rad[bk]) * bu;

      let g = null, r = 0, gg = 0, b = 0;
      if (d < rr) {
        // body: treat it as a round tube and light it from the upper left
        const sl = Math.hypot(svx, svy) || 1, pxn = -svy / sl, pyn = svx / sl;
        const q = clamp(bs / sl / rr, -1, 1), hz = Math.sqrt(1 - q * q); // q = across the body, hz = height of the tube there
        const lam = Math.max(0, pxn * q * LIGHT_DIR[0] + pyn * q * LIGHT_DIR[1] + hz * LIGHT_DIR[2]);
        const tt = (bk + bu) / (n - 1), shade = clamp(0.12 + 0.88 * lam - tt * 0.15, 0, 1);
        const pc = koiBodyColour(f, tt, q);
        const k = 0.28 + 0.95 * shade, spec = Math.pow(lam, 14) * 70;
        r = pc[0] * k + spec;
        gg = pc[1] * k + spec;
        b = pc[2] * k + spec;
        g = KOI_RAMP[Math.min(KOI_RAMP.length - 1, (shade * KOI_RAMP.length) | 0)];
        if (causticNet[idx] > 0.62 && lam > 0.55) {
          g = "*"; // light glinting off its back
          r += 40;
          gg += 40;
          b += 40;
        }
        for (const e of eyes) {
          if (Math.hypot(px - e.x, (py - e.y) * 0.8) < CW * 0.8 && tt < 0.12) {
            g = "•";
            r = 18;
            gg = 16;
            b = 18;
          }
        }
        if (j + shadowDY < ROWS && i + shadowDX < COLS) {
          const s2 = (j + shadowDY) * COLS + i + shadowDX; // shadow on the floor
          koiShadow[s2] = Math.max(koiShadow[s2], 0.75 * f.depth);
        }
      } else {
        if (d < rr + CW * 0.9) koiShadow[idx] = Math.max(koiShadow[idx], 0.95); // dark rim of water around the body
        // forked tail
        const ux = px - lx, uy = py - ly, u = (ux * tailX + uy * tailY) / tailLen;
        if (u > 0 && u < 1) {
          const lat = Math.abs(-ux * tailY + uy * tailX), width = R * (0.18 + 0.95 * u) * (1 - 0.25 * u);
          const fork = u > 0.7 && lat < R * 0.35 * (u - 0.7) * 3;
          if (lat < width && !fork) {
            g = lineGlyph(Math.atan2(uy, ux));
            const a = 0.95 - 0.35 * u;
            r = finC[0] * a;
            gg = finC[1] * a;
            b = finC[2] * a;
          }
        }
        // pectoral fins: thin ellipses
        if (!g)
          for (const fn of fins) {
            const ux2 = px - fn.x, uy2 = py - fn.y, a = ux2 * fn.dx + uy2 * fn.dy, c = -ux2 * fn.dy + uy2 * fn.dx;
            if (a > 0 && (a * a) / (R * R * 1.15) + (c * c) / (R * R * 0.18) < 1) {
              g = lineGlyph(Math.atan2(fn.dy, fn.dx));
              const al = 0.9 - (0.3 * a) / R;
              r = finC[0] * al;
              gg = finC[1] * al;
              b = finC[2] * al;
              break;
            }
          }
      }
      if (g) {
        koiGlyph[idx] = g;
        koiDepth[idx] = f.depth;
        koiR[idx] = lerp(10, r, depthFade);
        koiG[idx] = lerp(28, gg, depthFade);
        koiB[idx] = lerp(36, b, depthFade);
      }
    }
  }
}

/** every cell becomes koi or water, with ripples and light */
function composite(aspect, scrollRows) {
  for (let j = 0; j < ROWS; j++) {
    const y = (j + scrollRows) * aspect;
    for (let i = 0; i < COLS; i++) {
      const k = j * COLS + i;
      const dn = noise(i * 0.03 + t * 0.01, y * 0.03); // slow dark/light variation of the water
      const gw = lanternGlow[k], rp = rippleStrength[k], nt = causticNet[k], sh = koiShadow[k];
      let r, g, b, ch;
      if (koiDepth[k] >= 0) {
        ch = koiGlyph[k];
        r = koiR[k] + gw * 95 + nt * 14;
        g = koiG[k] + gw * 60 + nt * 20;
        b = koiB[k] + gw * 25 + nt * 22;
        if (rp > 0.35) {
          ch = rippleGlyph[k];
          r += rp * 90;
          g += rp * 110;
          b += rp * 120;
        }
      } else {
        const L = nt * 0.9 * (1 - sh * 0.8) + gw * 0.35;
        r = 5 + dn * 6 + L * 45 + gw * 120;
        g = 16 + dn * 12 + L * 120 + gw * 72;
        b = 24 + dn * 14 + L * 130 + gw * 30;
        if (sh > 0) {
          r *= 1 - sh * 0.55;
          g *= 1 - sh * 0.55;
          b *= 1 - sh * 0.55;
        }
        if (rp > 0.22) {
          ch = rippleGlyph[k];
          r += rp * 120;
          g += rp * 150;
          b += rp * 160;
        } else ch = L > 0.62 ? "~" : L > 0.4 ? "-" : L > 0.2 ? "·" : dn > 0.8 && hash2(i, j) > 0.93 ? "." : " ";
      }
      cellGlyph[k] = ch;
      cellR[k] = r;
      cellG[k] = g;
      cellB[k] = b;
    }
  }
}

/** lily pads (above the koi): radial veins, a notch, the odd flower */
function drawPads() {
  for (const p of pads) {
    const R = p.radius, px0 = p.x, py0 = p.y + Math.sin(t * 0.5 + p.bobPhase) * 1.5;
    const { i0, i1, j0, j1 } = cellRange(px0, py0, R);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * CW - px0, dy = (j + 0.5) * CH - py0, d = Math.hypot(dx, dy);
        if (d > R) continue;
        const a = Math.atan2(dy, dx);
        if (Math.abs(wrapAngle(a - p.notch)) < 0.28 && d > R * 0.12) continue;
        const k = j * COLS + i, e = d / R, v = noise(i * 0.4, j * 0.4), s = (0.55 + 0.45 * (1 - e)) * (0.8 + 0.3 * v) + lanternGlow[k] * 0.5;
        let ch = e > 0.86 ? (v > 0.5 ? "@" : "%") : e < 0.15 ? "o" : lineGlyph(a);
        let r = 48 * s + lanternGlow[k] * 60, g = 118 * s + lanternGlow[k] * 40, b = 62 * s;
        if (p.flower && d < R * 0.3) {
          const fd = d / (R * 0.3);
          ch = fd < 0.35 ? "*" : (i + j) & 1 ? "✿" : "❀";
          r = 236 - fd * 40;
          g = 150 - fd * 30;
          b = 170 - fd * 20;
        }
        cellGlyph[k] = ch;
        cellR[k] = r;
        cellG[k] = g;
        cellB[k] = b;
      }
  }
}

/** the name, tinted by koi passing beneath; fades out as you scroll */
function drawTitle() {
  const fade = clamp(1 - scrollY / (H * 0.55), 0, 1);
  if (fade <= 0.01) return;
  for (let k = 0; k < N; k++) {
    const c = titleGlyph[k];
    if (!c) continue;
    const a = titleAlpha[k] * fade;
    let r = 212, g = 218, b = 206;
    if (koiDepth[k] >= 0) {
      r = lerp(r, koiR[k] * 1.25, 0.6);
      g = lerp(g, koiG[k] * 1.25, 0.6);
      b = lerp(b, koiB[k] * 1.25, 0.6);
    }
    cellGlyph[k] = c;
    cellR[k] = lerp(cellR[k], r + lanternGlow[k] * 60, a);
    cellG[k] = lerp(cellG[k], g + lanternGlow[k] * 40, a);
    cellB[k] = lerp(cellB[k], b, a);
  }
}

/** rain streaks and food pellets */
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
  for (const p of pellets) {
    const k = cellAt(p.x, p.y);
    if (k < 0) continue;
    const a = Math.min(1, p.life / 3);
    cellGlyph[k] = "•";
    cellR[k] = lerp(cellR[k], 196, a);
    cellG[k] = lerp(cellG[k], 142, a);
    cellB[k] = lerp(cellB[k], 86, a);
  }
}

/** lanterns: a paper box, its reflection and a label in the grid; returns the glows and kanji
    that are painted separately (on top, in a serif font) */
function drawLanterns() {
  const glows = [], kanji = [];
  const box = ["╭─────╮", "│     │", "╰─────╯"];
  for (const L of lanterns) {
    const cx = Math.round(L.x / CW - 0.5), cy = Math.round(L.y / CH - 0.5);
    const flicker = 0.85 + 0.1 * Math.sin(L.phase * 7.3) + 0.05 * Math.sin(L.phase * 17), hv = L.hover;
    for (let rr = 0; rr < 3; rr++)
      for (let cc = 0; cc < 7; cc++) {
        const i = cx - 3 + cc, j = cy - 1 + rr;
        if (i < 0 || i >= COLS || j < 0 || j >= ROWS) continue;
        const k = j * COLS + i;
        cellGlyph[k] = box[rr][cc];
        cellR[k] = (232 + hv * 20) * flicker;
        cellG[k] = (186 + hv * 30) * flicker;
        cellB[k] = (128 + hv * 40) * flicker;
      }
    glows.push([(cx - 2) * CW, (cy - 1) * CH + CH * 0.5, 5 * CW, CH * 2, (0.22 + 0.12 * hv) * flicker * Math.min(1.6, L.intensity)]);
    kanji.push([(cx + 0.5) * CW, (cy + 0.5) * CH, L.info.kanji, flicker, hv]);

    // reflection: a wobbling column of ~ ≈ below it
    for (let n = 2; n <= 5; n++) {
      const j = cy + n;
      if (j >= ROWS) break;
      const w = Math.round(Math.sin(t * 2.2 + n * 1.3 + L.phase) * 0.9);
      for (const o of [0, w]) {
        const i = cx + o;
        if (i < 0 || i >= COLS) continue;
        const k = j * COLS + i, a = (1 - n / 6) * 0.55 * flicker;
        cellGlyph[k] = n % 2 ? "~" : "≈";
        cellR[k] = lerp(cellR[k], 230, a);
        cellG[k] = lerp(cellG[k], 150, a);
        cellB[k] = lerp(cellB[k], 70, a);
      }
    }

    // label above a map lantern ("→ about"), brighter on hover
    if (L.kind === "nav" && L.state === "float") {
      const s = "→ " + L.info.label, row = cy - 2, start = Math.round(L.x / CW - s.length / 2), a = Math.max(hv, 0.28);
      if (row >= 0 && row < ROWS)
        for (let n = 0; n < s.length; n++) {
          const i = start + n;
          if (i < 0 || i >= COLS || s[n] === " ") continue;
          const k = row * COLS + i;
          cellGlyph[k] = s[n];
          cellR[k] = lerp(cellR[k], 250, a);
          cellG[k] = lerp(cellG[k], 226, a);
          cellB[k] = lerp(cellB[k], 190, a);
        }
    }
  }
  return { glows, kanji };
}

/** puts it all on the canvas: background, lantern glows, the characters, then the kanji */
function paint({ glows, kanji }) {
  ctx.fillStyle = "#040c11";
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, w, h, a] of glows) {
    ctx.fillStyle = `rgba(255,150,60,${a})`;
    ctx.fillRect(x, y, w, h);
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w * 0.9);
    g.addColorStop(0, `rgba(255,190,110,${a * 0.9})`);
    g.addColorStop(1, "rgba(255,140,50,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.4, y - h * 0.6, w * 1.8, h * 2.2);
  }

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

  ctx.textAlign = "center";
  ctx.font = `600 ${Math.round(FS * 1.15)}px "Noto Serif JP",serif`;
  for (const [x, y, kj, flicker, hv] of kanji) {
    ctx.fillStyle = `rgba(255,${(232 + hv * 20) | 0},${(196 + hv * 40) | 0},${0.85 * flicker + 0.15})`;
    ctx.shadowColor = "rgba(255,160,70,.9)";
    ctx.shadowBlur = 10 + hv * 8;
    ctx.fillText(kj, x, y + 1);
  }
  ctx.shadowBlur = 0;
}

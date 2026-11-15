/* =============================================================================
   Autumn leaves: a few long olive leaves land, drift near the sides, then
   darken and sink.
   ============================================================================= */

let leaves = [];
let leafTimer = 2; // seconds until the next leaf may land

const LEAF_COLOURS = [[128, 124, 62], [112, 116, 58], [140, 134, 72], [100, 104, 54], [150, 140, 80]];
/** the leaf's outline: radius (× leaf radius) at angle th, where th = 0 is the tip */
const leafOutline = th => {
  const c = Math.cos(th), s = Math.sin(th), w = c > 0 ? 0.42 - 0.12 * c : 0.44;
  return 1 / Math.sqrt(c * c + (s / w) ** 2);
};

/** a free spot in the side bands, away from other leaves, lanterns and the name */
function leafSpot() {
  let x = 0, y = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = Math.random() < 0.5 ? rnd(W * 0.04, W * 0.24) : rnd(W * 0.76, W * 0.96);
    y = rnd(H * 0.1, H * 0.9);
    const clear =
      leaves.every(o => Math.hypot(o.x - x, o.y - y) > 170 * SC) &&
      lanterns.every(L => Math.hypot(L.x - x, L.y - y) > 170 * SC) &&
      !(scrollY < H * 0.5 && x > W * 0.14 && x < W * 0.86 && y > H * 0.14 && y < H * 0.5);
    if (clear) break;
  }
  return [x, y];
}

function updateLeaves(dt) {
  leafTimer -= dt;
  if (leafTimer < 0) {
    leafTimer = rnd(5, 11);
    const floating = leaves.filter(d => d.sink === 0).length;
    if (floating < Math.max(3, Math.round((5 * W * H) / 1.15e6))) {
      const [x, y] = leafSpot();
      leaves.push({
        x, y,
        fall: 1,                 // 1 = just let go above the water … 0 = landed
        vx: 0, vy: 0,
        rot: rnd(0, 6.28),
        spin: rnd(-0.12, 0.12),
        radius: rnd(42, 50) * SC,
        colour: LEAF_COLOURS[(Math.random() * LEAF_COLOURS.length) | 0],
        age: 0,
        life: rnd(40, 70),       // seconds on the water before it starts to sink
        sink: 0,                 // 0..1 while sinking
        swayPhase: rnd(0, 6),
        seed: (Math.random() * 200) | 0,
      });
    }
  }
  for (const d of leaves) {
    d.age += dt;
    if (d.fall > 0) {
      // floating down: sways, spins, then lands with a ripple
      d.fall = Math.max(0, d.fall - dt / 1.8);
      d.swayPhase += dt * 2.2;
      d.rot += dt * 0.7 * Math.sign(d.spin || 1);
      if (d.fall === 0) addRipple(d.x, d.y, d.radius + 38 * SC, 0.75, 42);
      continue;
    }
    if (d.age > d.life) d.sink = Math.min(1, d.sink + dt / 8);
    // a slow current, ripples push it, and it drifts back toward its side of the pond
    const fx = (noise(d.x * 0.004 + t * 0.05, d.y * 0.004) - 0.5) * 9 * SC;
    const fy = (noise(d.x * 0.004 + 40, d.y * 0.004 - t * 0.05) - 0.5) * 7 * SC;
    d.vx += (fx - d.vx) * dt * 0.35;
    d.vy += (fy - d.vy) * dt * 0.35;
    for (const r of ripples) {
      if (r.r <= 0) continue;
      const dx = d.x - r.x, dy = d.y - r.y, dd = Math.hypot(dx, dy) || 1, near = 1 - Math.abs(dd - r.r) / (22 * SC);
      if (near > 0) {
        const k = near * r.strength * (1 - r.r / r.max) * 22 * SC * dt;
        d.vx += (dx / dd) * k;
        d.vy += (dy / dd) * k;
      }
    }
    if (d.x > W * 0.27 && d.x < W * 0.73) d.vx += (d.x < W / 2 ? -1 : 1) * 6 * SC * dt;
    d.spin *= Math.exp(-dt * 0.7);
    d.rot += d.spin * dt;
    d.vx *= Math.exp(-dt * 0.7);
    d.vy *= Math.exp(-dt * 0.7);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
  }
  leaves = leaves.filter(d => d.sink < 1 && d.x > -90 && d.x < W + 90 && d.y > -110 && d.y < H + 110);
}

function renderLeaves() {
  for (const d of leaves) {
    const fall = d.fall;
    const cx = d.x + Math.sin(d.swayPhase) * 22 * SC * fall, cy = d.y - fall * 60 * SC;
    const R = d.radius * (1 + fall * 0.25) * (1 - d.sink * 0.22), ext = R * 1.7;
    const cs = Math.cos(d.rot), sn = Math.sin(d.rot), fade = fall > 0 ? 0.4 + 0.6 * (1 - fall) : 1;

    if (fall > 0) {
      // its shadow on the water while it floats down
      const si = (d.x / CW) | 0, sj = (d.y / CH) | 0, m = 1 - 0.35 * (1 - fall);
      for (let j = sj - 1; j <= sj + 1; j++)
        for (let i = si - 2; i <= si + 2; i++) {
          if (i < 0 || i >= COLS || j < 0 || j >= ROWS) continue;
          const k = j * COLS + i;
          cellR[k] *= m;
          cellG[k] *= m;
          cellB[k] *= m;
        }
    }

    const { i0, i1, j0, j1 } = cellRange(cx, cy, ext);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        // (u, v) = the cell in the leaf's own frame: u along it (tip at +u), v across
        const dx = (i + 0.5) * CW - cx, dy = (j + 0.5) * CH - cy, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
        const rr = Math.hypot(u, v) / R, th = Math.atan2(v, u), k = j * COLS + i;
        if (d.sink > 0 && hash2(i * 5 + d.seed, j * 3 + d.seed) < d.sink * 1.05) continue; // sinking: breaks up from the edges in
        let ch = null, shade = 1;
        if (u < -0.25 * R && u > -1.45 * R && Math.abs(v) < CW * 0.5) {
          ch = lineGlyph(d.rot); // stem
          shade = 0.6;
        }
        const lim = leafOutline(th);
        if (rr <= lim) {
          const e = rr / lim;
          const midrib = Math.abs(v) < CW * 0.45 && e < 0.92;
          const ph = (((u + Math.abs(v) * 1.1) / (R * 0.38)) % 1 + 1) % 1;
          const vein = !midrib && ph < 0.2 && e < 0.82 && u > -0.8 * R;
          ch = midrib ? lineGlyph(d.rot) : vein ? lineGlyph(d.rot + Math.atan2(Math.sign(v), 0.9)) : e > 0.8 ? "#" : "%";
          shade = midrib ? 0.5 : vein ? 0.62 : e > 0.8 ? 0.78 : 1;
        }
        if (!ch) continue;
        const m = shade * (0.85 + 0.3 * noise(i * 0.5 + d.seed, j * 0.5)), g = lanternGlow[k];
        const dark = d.sink * 0.85, a = fade * (1 - d.sink * 0.35);
        const r = lerp(d.colour[0] * m + g * 50, 10, dark), gg = lerp(d.colour[1] * m + g * 30, 24, dark), b = lerp(d.colour[2] * m, 30, dark);
        cellGlyph[k] = ch;
        cellR[k] = lerp(cellR[k], r, a);
        cellG[k] = lerp(cellG[k], gg, a);
        cellB[k] = lerp(cellB[k], b, a);
        cellTints.push(i, j, r * 0.55, gg * 0.55, b * 0.55, 0.42 * a);
      }
  }
}

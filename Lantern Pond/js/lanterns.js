/* =============================================================================
   Lanterns: the floating map of the site, one per section.
   ============================================================================= */

let lanterns = [];

/** half the width of the page's content column: lanterns live outside it, in the side margins */
const contentHalfWidth = () => Math.min(760, W * 0.9) / 2;

/** lantern i's resting place: alternating left / right margins, spread down the screen */
function lanternHome(i) {
  const n = CONFIG.lanterns.length, margin = Math.max(70, (W - 2 * contentHalfWidth()) / 4);
  return [i % 2 ? W - margin : margin, H * (0.42 + (0.46 * (i + 0.5)) / n)];
}

function makeLantern(info, kind, x, y, extra) {
  return {
    info,          // { kanji, label, target }
    kind,          // "nav": a map lantern
    x, y,
    homeX: 0, homeY: 0,
    vx: 0, vy: 0,
    phase: rnd(0, 6), // flicker
    state: "float",
    hover: 0,         // 0..1, eases toward 1 while the pointer is on it
    intensity: 1,     // brighter for a moment after it's clicked
    ...extra,
  };
}

function makeLanterns() {
  lanterns = CONFIG.lanterns.map((info, i) => {
    const [x, y] = lanternHome(i);
    return makeLantern(info, "nav", x, y, { homeX: x, homeY: y });
  });
}

/** the floating lantern under a point, if any */
const lanternAt = (x, y) =>
  lanterns.find(L => L.state === "float" && Math.abs(x - L.x) < 4.2 * CW && Math.abs(y - L.y) < 2 * CH) || null;

function updateLanterns(dt) {
  lanterns.forEach((L, i) => {
    L.phase += dt;
    L.hover = lerp(L.hover, hovered === L ? 1 : 0, 1 - Math.exp(-dt * 8));

    if (L.intensity > 1) L.intensity = Math.max(1, L.intensity - dt * 1.2);
    // drift on a slow current and spring gently home
    L.vx += ((noise(L.x * 0.004, t * 0.06 + i * 7) - 0.5) * 14 + (L.homeX - L.x) * 0.03) * dt;
    L.vy += ((noise(L.y * 0.004 + 5, t * 0.06 + i * 3) - 0.5) * 10 + (L.homeY - L.y) * 0.03) * dt;
    // koi bump it as they pass (bumps toward the middle barely count)
    for (const f of fish) {
      const h = f.nodes[0];
      if (Math.hypot(h.x - L.x, h.y - L.y) < 38 * SC) {
        const px = Math.cos(f.heading), k = px * (L.x < W / 2 ? -1 : 1) < 0 ? 0.015 : 0.05;
        L.vx += px * f.speed * k * dt * 10;
        L.vy += Math.sin(f.heading) * f.speed * k * 0.6 * dt * 10;
      }
    }
    // lanterns keep a little apart
    for (const o of lanterns) {
      if (o === L || o.state !== "float") continue;
      const d = Math.hypot(L.x - o.x, L.y - o.y);
      if (d < 90 * SC && d > 0) {
        L.vx += ((L.x - o.x) / d) * 8 * dt;
        L.vy += ((L.y - o.y) / d) * 8 * dt;
      }
    }
    L.vx *= Math.exp(-dt * 0.9);
    L.vy *= Math.exp(-dt * 0.9);
    L.x = clamp(L.x + L.vx * dt * 10, 50, W - 50);
    L.y = clamp(L.y + L.vy * dt * 10, 60, H - 60);
  });
}

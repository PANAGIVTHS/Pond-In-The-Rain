/* =============================================================================
   The koi: what a koi is, its colours, and where it likes to swim.
   (How they move is in simulation.js, how they're drawn is in render.js.)
   ============================================================================= */

let fish = [];

// body half-width along the spine, head → tail (× the koi's radius)
const BODY_PROFILE = [0.6, 0.86, 1, 0.98, 0.9, 0.78, 0.64, 0.5, 0.37, 0.26, 0.17];

const KOI_COLOURS = {
  white:  [238, 232, 220],
  red:    [228, 74, 40],
  black:  [30, 30, 38],
  gold:   [238, 180, 74],
  orange: [238, 122, 46],
  blue:   [108, 140, 168],
  yellow: [242, 212, 96],
  brown:  [176, 112, 62],
};

// Each variety colours a point on the body from: t = along the body (0 head … 1 tail),
// q = across it (-1 … 1), and two smooth noise values a, b (unique per koi) for patches.
const VARIETIES = (({ white, red, black, gold, orange, blue, yellow, brown }) => [
  /* kohaku   */ { body: (t, q, a) => (a > 0.53 ? red : white), fin: white },
  /* tancho   */ { body: (t, q) => (t < 0.17 && Math.abs(q) < 0.7 && Math.hypot((t - 0.085) * 6, q) < 0.62 ? red : white), fin: white },
  /* sanke    */ { body: (t, q, a, b) => (a > 0.56 ? red : b > 0.74 ? black : white), fin: white },
  /* showa    */ { body: (t, q, a, b) => (a > 0.48 ? black : b > 0.52 ? red : white), fin: black },
  /* ogon     */ { body: () => gold, fin: gold },
  /* asagi    */ { body: (t, q) => (Math.abs(q) > 0.64 ? orange : blue), fin: orange },
  /* yamabuki */ { body: () => yellow, fin: yellow },
  /* chagoi   */ { body: () => brown, fin: brown },
  /* kohaku   */ { body: (t, q, a) => (a > 0.47 ? red : white), fin: white },
])(KOI_COLOURS);

/** the colour of koi f's body at (t, q), with its personal patch pattern */
const koiBodyColour = (f, t, q) =>
  f.variety.body(t, q, noise(t * 3.4 + f.seed, q * 1.2 + f.seed * 1.7), noise(t * 8 + f.seed * 3, q * 2.6 + 11));

function makeFish(i) {
  const s = SC * rnd(0.8, 1.25) * (W < 640 ? 0.75 : 1); // size
  const x = rnd(W * 0.15, W * 0.85), y = rnd(H * 0.2, H * 0.85), heading = rnd(0, 6.28), segLen = 16.5 * s;
  const nodes = [];
  for (let k = 0; k < 11; k++) nodes.push({ x: x - Math.cos(heading) * segLen * k, y: y - Math.sin(heading) * segLen * k });
  return {
    nodes,                  // the spine: nodes[0] is the head, the rest follow its path
    heading,
    segLen,
    radius: 31 * s,         // body half-width at its widest
    speed: rnd(30, 44) * SC,
    cruise: rnd(29, 44) * SC, // its normal relaxed speed
    tailPhase: rnd(0, 6),
    seed: rnd(0, 50),       // makes its colour patches unique
    variety: VARIETIES[i % VARIETIES.length],
    depth: rnd(0.5, 1),     // 0 deep … 1 near the surface
    home: [0.5, 0.5],       // its home patch, as fractions of the screen
    goalX: x, goalY: y, goalTimer: 0, // the spot it's swimming to, and how long before it gets bored
    fleeTimer: 0, fleeAngle: 0,
    wakeTimer: 0,
  };
}

/** each koi wanders around its own home patch; patches are a loose grid so the pond fills evenly */
function assignHomes() {
  const n = fish.length, cols = Math.max(2, Math.round(Math.sqrt((n * W) / H))), rows = Math.ceil(n / cols);
  const slots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push([(c + 0.5) / cols, (r + 0.5) / rows]);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  fish.forEach((f, i) => (f.home = slots[i % slots.length]));
}

/** where a koi's home patch is right now: homes drift slowly */
function homeXY(f) {
  const x = W * clamp(f.home[0] + (noise(t * 0.015 + f.seed, 1) - 0.5) * 0.25, 0.08, 0.92);
  const y = H * clamp(f.home[1] + (noise(t * 0.015 + f.seed, 9) - 0.5) * 0.25, 0.1, 0.9);
  return [x, y];
}

/** places the koi in their home patches (on start) */
function spawnKoi() {
  for (let i = 0; i < CONFIG.fishCount * (W < 640 ? 0.6 : 1); i++) fish.push(makeFish(i));
  assignHomes();
  for (const f of fish) {
    const [x, y] = homeXY(f), a = rnd(0, 6.28);
    f.heading = a;
    f.goalX = x;
    f.goalY = y;
    f.nodes.forEach((n, k) => {
      n.x = x - Math.cos(a) * f.segLen * k;
      n.y = y - Math.sin(a) * f.segLen * k;
    });
  }
}

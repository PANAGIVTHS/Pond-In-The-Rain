/* =============================================================================
   The simulation, stepped once per frame: weather, then every koi.
   ============================================================================= */

function update(dt) {
  updateWeather(dt);
  for (const f of fish) updateKoi(f, dt);
}

function updateWeather(dt) {
  // rain: drops make small ripples; streaks fall across the surface
  if (rainOn) {
    rainAcc += dt * ((W * H) / 1e6) * 9;
    while (rainAcc > 1) {
      rainAcc--;
      const x = rnd(0, W), y = rnd(0, H);
      addRipple(x, y, rnd(14, 46) * SC, rnd(0.45, 0.9), rnd(28, 42));
    }
    if (streaks.length < 70 * (W / 1400))
      streaks.push({ x: rnd(-100, W), y: rnd(-H * 0.2, H * 0.6), vx: 90, vy: 620, life: rnd(0.25, 0.6) });
  }
  for (const s of streaks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  }
  streaks = streaks.filter(s => s.life > 0 && s.y < H);
  for (const r of ripples) r.r += r.speed * dt;
  ripples = ripples.filter(r => r.r < r.max);
}

/* ---- koi behaviour ------------------------------------------------------------
   Each frame a koi:
   1. picks what it's swimming toward: its current wander spot
   2. adds up steering: toward that goal and away from the walls
   3. turns toward that, never tighter than its body can follow, and swims;
      the body follows the path the head took
   ------------------------------------------------------------------------------ */

function updateKoi(f, dt) {
  const h = f.nodes[0];

  const goal = chooseGoal(f, h, dt);

  // steering: a direction built up from several pulls
  const steer = { x: goal.x - h.x, y: goal.y - h.y };
  const len = Math.hypot(steer.x, steer.y) || 1;
  steer.x /= len;
  steer.y /= len;
  const m = 70 * SC; // walls
  if (h.x < m) steer.x += ((m - h.x) / m) * 2;
  if (h.x > W - m) steer.x -= ((h.x - W + m) / m) * 2;
  if (h.y < m) steer.y += ((m - h.y) / m) * 2;
  if (h.y > H - m) steer.y -= ((h.y - H + m) / m) * 2;

  swim(f, h, steer, goal.urgency, dt);
}

/** turn toward the steering direction (limited by the body) and move; the body follows the head */
function swim(f, h, steer, urgency, dt) {
  let want = Math.atan2(steer.y, steer.x);
  if (f.fleeTimer > 0) {
    want = f.fleeAngle;
    f.fleeTimer -= dt;
  }
  const da = wrapAngle(want - f.heading);
  const fleeing = f.fleeTimer > 0;
  // the tightest circle the body can follow without overlapping itself
  const minTurnRadius = ((f.segLen * (f.nodes.length - 1)) / (2 * Math.PI)) * (fleeing ? 2.1 : 2.0);
  const maxTurn = Math.min(fleeing ? 4 : urgency ? 2.6 : 1.9, f.speed / minTurnRadius) * dt;
  f.heading += clamp(da, -maxTurn, maxTurn);

  const targetSpeed =
    f.cruise * (1 + urgency * 1.5) * (Math.abs(da) > 1.6 && !fleeing ? 1.15 : 1) + (fleeing ? 110 * SC : 0);
  f.speed = lerp(f.speed, targetSpeed, 1 - Math.exp(-dt * (fleeing ? 6 : 1.5)));
  f.tailPhase += dt * (1.2 + (f.speed * 0.055) / SC); // tail beat follows speed
  const moveAngle = f.heading + Math.sin(f.tailPhase) * 0.18; // a slight side-to-side
  h.x += Math.cos(moveAngle) * f.speed * dt;
  h.y += Math.sin(moveAngle) * f.speed * dt;

  // follow-the-leader: each node keeps one segment behind the one before it
  for (let k = 1; k < f.nodes.length; k++) {
    const p = f.nodes[k - 1], c = f.nodes[k], ex = c.x - p.x, ey = c.y - p.y, d = Math.hypot(ex, ey) || 1;
    c.x = p.x + (ex / d) * f.segLen;
    c.y = p.y + (ey / d) * f.segLen;
  }
  f.wakeTimer -= dt;
  if (f.speed > 60 * SC && f.wakeTimer < 0) {
    f.wakeTimer = 0.22;
    addRipple(h.x, h.y, 28 * SC, 0.4, 45);
  }
}

/** what the koi is heading for this frame: { x, y, urgency } */
function chooseGoal(f, h, dt) {
  // wandering: a new spot when it arrives, gets bored, or the spot is inside its turning circle
  f.goalTimer -= dt;
  const gd = Math.hypot(f.goalX - h.x, f.goalY - h.y);
  const ga = Math.abs(wrapAngle(Math.atan2(f.goalY - h.y, f.goalX - h.x) - f.heading));
  if (f.goalTimer < 0 || gd < 90 * SC || (gd < f.radius * 3.2 && ga > 0.9)) {
    f.goalTimer = rnd(5, 11);
    nextWanderSpot(f, h);
  }
  return { x: f.goalX, y: f.goalY, urgency: 0 };
}

/** pick the next spot to swim to: mostly ahead (within ~65° of heading),
    reflected off the walls rather than pinned against them */
function nextWanderSpot(f, h) {
  const angle = f.heading + rnd(-1.15, 1.15), dist = rnd(160, 320) * SC;
  const mx = 120 * SC, my = 110 * SC; // margins
  const reflect = (v, lo, hi) => {
    if (hi <= lo) return (lo + hi) / 2;
    for (let n = 0; n < 3; n++) {
      if (v < lo) v = 2 * lo - v;
      else if (v > hi) v = 2 * hi - v;
    }
    return clamp(v, lo, hi);
  };
  f.goalX = reflect(h.x + Math.cos(angle) * dist, mx, W - mx);
  f.goalY = reflect(h.y + Math.sin(angle) * dist, my, H - my);
}

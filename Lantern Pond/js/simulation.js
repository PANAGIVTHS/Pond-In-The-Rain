/* =============================================================================
   The simulation, stepped once per frame: weather, then every koi, lantern,
   spark and leaf.
   ============================================================================= */

function update(dt) {
  updateWeather(dt);
  for (const p of pellets) p.life -= dt;
  pellets = pellets.filter(p => p.life > 0);
  for (const f of fish) updateKoi(f, dt);
  updateLanterns(dt);
  for (const s of sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  }
  sparks = sparks.filter(s => s.life > 0);
  updateLeaves(dt);
}

function updateWeather(dt) {
  // rain: drops make small ripples (and the odd drip sound); streaks fall across the surface
  if (rainOn) {
    rainAcc += dt * ((W * H) / 1e6) * 9 * mood.rain;
    while (rainAcc > 1) {
      rainAcc--;
      const x = rnd(0, W), y = rnd(0, H);
      addRipple(x, y, rnd(14, 46) * SC, rnd(0.45, 0.9), rnd(28, 42));
      if (Math.random() < 0.28) drip(x, rnd(0.006, 0.022));
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

  // lightning: a double flicker (the card borders flash too), then thunder a moment later
  nextFlash -= dt;
  if (rainOn && nextFlash < 0) {
    nextFlash = rnd(35, 80) / Math.max(0.5, mood.rain);
    flash = 1;
    setTimeout(() => (flash = 0.7), 140);
    thunder();
    const blink = ms => {
      document.body.classList.add("flash");
      setTimeout(() => document.body.classList.remove("flash"), ms);
    };
    blink(180);
    setTimeout(() => blink(120), 300);
  }
  flash *= Math.exp(-dt * 5);
}

/* ---- koi behaviour ------------------------------------------------------------
   Each frame a koi:
   1. picks what it's swimming toward: pushing a stray lantern, visiting a clicked
      lantern, food, or its current wander spot
   2. adds up steering: toward that goal, beside its buddy, away from other koi,
      the name and the walls
   3. turns toward that, never tighter than its body can follow, and swims;
      the body follows the path the head took
   ------------------------------------------------------------------------------ */

function updateKoi(f, dt) {
  const h = f.nodes[0];

  let food = null, foodDist = 420 * SC; // nearest food it can sense
  for (const p of pellets) {
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d < foodDist) {
      foodDist = d;
      food = p;
    }
  }
  if (f.fleeTimer > 0) f.calmTimer = 2; // after a scare, 2 s before it'll do chores
  else if (f.calmTimer > 0) f.calmTimer -= dt;

  updateHerding(f, food, dt);
  const goal = chooseGoal(f, h, food, foodDist, dt);

  // steering: a direction built up from several pulls
  const steer = { x: goal.x - h.x, y: goal.y - h.y };
  const len = Math.hypot(steer.x, steer.y) || 1;
  steer.x /= len;
  steer.y /= len;
  updatePairing(f, food, dt, steer);
  keepApart(f, h, steer);
  if (titleVisible() && !food) avoidTitle(f, h, steer);
  const m = 70 * SC; // walls
  if (h.x < m) steer.x += ((m - h.x) / m) * 2;
  if (h.x > W - m) steer.x -= ((h.x - W + m) / m) * 2;
  if (h.y < m) steer.y += ((m - h.y) / m) * 2;
  if (h.y > H - m) steer.y -= ((h.y - H + m) / m) * 2;

  // left behind by scrolling: hurry straight back into view
  const offscreen = h.x < -20 || h.x > W + 20 || h.y < -20 || h.y > H + 20;
  if (offscreen) {
    if (f.goalY < 0 || f.goalY > H || f.goalX < 0 || f.goalX > W) {
      [f.goalX, f.goalY] = homeXY(f);
      f.goalTimer = rnd(4, 8);
    }
    const bx = f.goalX - h.x, by = f.goalY - h.y, bl = Math.hypot(bx, by) || 1;
    steer.x = bx / bl;
    steer.y = by / bl;
  }

  swim(f, h, steer, goal.urgency, offscreen, dt);
}

/** turn toward the steering direction (limited by the body) and move; the body follows the head */
function swim(f, h, steer, urgency, offscreen, dt) {
  let want = Math.atan2(steer.y, steer.x);
  if (f.fleeTimer > 0) {
    want = f.fleeAngle;
    f.fleeTimer -= dt;
  }
  const da = wrapAngle(want - f.heading);
  const fleeing = f.fleeTimer > 0;
  // the tightest circle the body can follow without overlapping itself
  const minTurnRadius = ((f.segLen * (f.nodes.length - 1)) / (2 * Math.PI)) * (fleeing ? 2.1 : 2.0);
  const maxTurn = Math.min(fleeing ? 4 : offscreen ? 3 : urgency ? 2.6 : 1.9, f.speed / minTurnRadius) * dt;
  f.heading += clamp(da, -maxTurn, maxTurn);

  const targetSpeed =
    f.cruise * (1 + urgency * 1.5) * (offscreen ? 3.2 : 1) * (Math.abs(da) > 1.6 && !fleeing ? 1.15 : 1) + (fleeing ? 110 * SC : 0);
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
function chooseGoal(f, h, food, foodDist, dt) {
  // pushing a stray lantern: come up on the middle side of it, give one firm push, then swim off
  if (f.herdLantern && !food) {
    const L = f.herdLantern, side = L.x < W / 2 ? -1 : 1;
    f.herdTimer += dt;
    const goal = { x: L.x - side * 42 * SC, y: L.y, urgency: 0.4 };
    if (Math.hypot(h.x - L.x, h.y - L.y) < 50 * SC || f.herdTimer > 8) {
      if (f.herdTimer <= 8) {
        const need = contentHalfWidth() + 70 * SC - Math.abs(L.x - W / 2);
        L.vx += side * clamp(need / 11, 4, 30);
        addRipple(L.x - side * 20 * SC, L.y, 40 * SC, 0.6, 45);
      }
      L.herdWait = rnd(6, 12);
      f.herdLantern = null;
      f.goalTimer = 0;
    }
    return goal;
  }
  // visiting a lantern you clicked: circle slowly around it
  if (f.visitTimer > 0 && f.visitLantern && !food) {
    f.visitTimer -= dt;
    f.orbit += dt * 0.9;
    return { x: f.visitLantern.x + Math.cos(f.orbit) * 45 * SC, y: f.visitLantern.y + Math.sin(f.orbit) * 30 * SC, urgency: 0.6 };
  }
  // food: race for it, and eat it on arrival
  if (food) {
    if (foodDist < 11 * SC) {
      food.life = 0;
      addRipple(food.x, food.y, 26 * SC, 0.7, 40);
      tick(food.x);
    }
    return { x: food.x, y: food.y, urgency: 1 };
  }
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

/** pick the next spot to swim to: mostly ahead (within ~65° of heading), pulled gently back
    toward home, and reflected off the walls rather than pinned against them */
function nextWanderSpot(f, h) {
  if (Math.random() < 0.04) {
    // a rare long trip: swap homes with another koi
    const o = fish[(Math.random() * fish.length) | 0];
    if (o !== f) [f.home, o.home] = [o.home, f.home];
  }
  const [homeX, homeY] = homeXY(f), angle = f.heading + rnd(-1.15, 1.15), dist = rnd(160, 320) * SC;
  const mx = 120 * SC, my = 110 * SC; // margins
  const reflect = (v, lo, hi) => {
    if (hi <= lo) return (lo + hi) / 2;
    for (let n = 0; n < 3; n++) {
      if (v < lo) v = 2 * lo - v;
      else if (v > hi) v = 2 * hi - v;
    }
    return clamp(v, lo, hi);
  };
  const pull = clamp(Math.hypot(homeX - h.x, homeY - h.y) / (Math.min(W, H) * 0.45), 0.15, 0.75);
  const ax = reflect(h.x + Math.cos(angle) * dist, mx, W - mx), ay = reflect(h.y + Math.sin(angle) * dist, my, H - my);
  f.goalX = reflect(lerp(ax, homeX, pull), mx, W - mx);
  f.goalY = reflect(lerp(ay, homeY, pull), my, H - my);
  // never a spot under the name: push it out past the box edge
  if (titleVisible())
    for (const b of titleBoxes) {
      const a = boxAway(b, f.goalX, f.goalY);
      if (a.d < f.radius) {
        if (a.ux) f.goalX = a.ux < 0 ? b.x0 - f.radius * 2 : b.x1 + f.radius * 2;
        else f.goalY = a.uy < 0 ? b.y0 - f.radius * 2 : b.y1 + f.radius * 2;
      }
    }
}

/** now and then a nearby koi gives a stray lantern (one drifted behind the page) a push back to the side */
function updateHerding(f, food, dt) {
  const L0 = f.herdLantern;
  if (L0 && (f.fleeTimer > 0 || food || !lanternInMiddle(L0) || !lanterns.includes(L0))) {
    f.herdLantern = null;
    f.goalTimer = 0;
  }
  if (f.herdLantern || f.calmTimer > 0 || food || f.visitTimer > 0 || fish.some(o => o.herdLantern)) return;
  for (const L of lanterns) {
    if (!lanternInMiddle(L) || (L.herdWait = (L.herdWait ?? rnd(4, 10)) - dt) > 0) continue;
    // the nearest koi that isn't busy does it
    let near = null, nd = 300 * SC;
    for (const o of fish) {
      if (o.fleeTimer > 0 || o.calmTimer > 0 || o.visitTimer > 0) continue;
      const d = Math.hypot(o.nodes[0].x - L.x, o.nodes[0].y - L.y);
      if (d < nd) {
        nd = d;
        near = o;
      }
    }
    if (near === f) {
      f.herdLantern = L;
      f.herdTimer = 0;
      break;
    }
    if (!near) L.herdWait = rnd(2, 4);
  }
}

/** swimming together: now and then two koi meeting on a similar heading cruise side by side for a while */
function updatePairing(f, food, dt, steer) {
  // the pair splits when its time is up, or either one gets distracted
  if ((f.buddy && (f.buddyTimer -= dt) <= 0) || (f.buddy && (f.fleeTimer > 0 || food || f.buddy.buddy !== f))) {
    if (f.buddy && f.buddy.buddy === f) {
      f.buddy.buddy = null;
      f.buddy.pairCooldown = rnd(15, 30);
    }
    f.buddy = null;
    f.pairCooldown = rnd(15, 30);
  }
  f.pairCooldown = (f.pairCooldown || 0) - dt;

  if (!f.buddy && f.pairCooldown <= 0 && !food && f.fleeTimer <= 0 && f.visitTimer <= 0 && !f.herdLantern)
    for (const o of fish) {
      if (o === f || o.buddy || o.pairCooldown > 0 || o.fleeTimer > 0 || o.herdLantern) continue;
      const oh = o.nodes[0], d = Math.hypot(oh.x - f.nodes[0].x, oh.y - f.nodes[0].y);
      if (d < (f.radius + o.radius) * 2.4 && Math.abs(wrapAngle(o.heading - f.heading)) < 0.8) {
        if (Math.random() < 0.35) {
          const time = rnd(5, 10);
          f.buddy = o;
          o.buddy = f;
          f.buddyTimer = o.buddyTimer = time;
        } else f.pairCooldown = rnd(4, 8);
        break;
      }
    }

  if (f.buddy) {
    const o = f.buddy, h = f.nodes[0], oh = o.nodes[0];
    const ex = h.x - oh.x, ey = h.y - oh.y, d = Math.hypot(ex, ey) || 1, want = (f.radius + o.radius) * 1.9;
    steer.x += Math.cos(o.heading) * 1.1; // match its heading
    steer.y += Math.sin(o.heading) * 1.1;
    const k = clamp((want - d) / want, -0.5, 0.9) * 2.6; // hold a little gap beside it
    steer.x += (ex / d) * k;
    steer.y += (ey / d) * k;
    if (f.depth < o.depth) {
      // the lower one follows the other's plan
      f.goalX = o.goalX + ex * 0.6;
      f.goalY = o.goalY + ey * 0.6;
      f.goalTimer = Math.max(f.goalTimer, 1);
    }
    f.cruise = lerp(f.cruise, o.cruise, 1 - Math.exp(-dt * 0.5));
  }
}

/** keep clear of other koi: their whole body, both where this koi's head is and where it's about to be,
    plus a wider berth between heads */
function keepApart(f, h, steer) {
  const aheadX = h.x + Math.cos(f.heading) * f.radius * 2, aheadY = h.y + Math.sin(f.heading) * f.radius * 2;
  const probes = [[h.x, h.y, 1.8], [aheadX, aheadY, 1.3]]; // [x, y, strength]
  for (const o of fish) {
    if (o === f) continue;
    const range = (f.radius + o.radius) * (o === f.buddy ? 1.1 : 1.7); // a pair keeps a smaller, but firm, gap
    for (let q = 1; q < o.nodes.length; q += 2) {
      const on = o.nodes[q];
      for (const [px, py, k] of probes) {
        const ex = px - on.x, ey = py - on.y, d = Math.hypot(ex, ey);
        if (d < range && d > 0.1) {
          const w = (1 - d / range) * k;
          steer.x += (ex / d) * w;
          steer.y += (ey / d) * w;
        }
      }
    }
    const oh = o.nodes[0], ex = h.x - oh.x, ey = h.y - oh.y, d = Math.hypot(ex, ey), headRange = 150 * SC;
    if (d < headRange && d > 0.1) {
      const w = (1 - d / headRange) * 2.2;
      steer.x += (ex / d) * w;
      steer.y += (ey / d) * w;
    }
  }
}

/** stay out from under the name: checked where it is and where it's heading */
function avoidTitle(f, h, steer) {
  for (const b of titleBoxes) {
    const aheadX = h.x + Math.cos(f.heading) * f.radius * 2.4, aheadY = h.y + Math.sin(f.heading) * f.radius * 2.4;
    for (const [px, py, k] of [[h.x, h.y, 1], [aheadX, aheadY, 0.8]]) {
      const a = boxAway(b, px, py), margin = f.radius * 1.8;
      if (a.d < margin) {
        const w = (a.d === 0 ? 4 : (1 - a.d / margin) * 2.8) * k;
        steer.x += a.ux * w;
        steer.y += a.uy * w;
      }
    }
  }
}

/* =============================================================================
   The simulation, stepped once per frame.
   ============================================================================= */

function update(dt) {
  updateWeather(dt);
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

/* =============================================================================
   How the pond and the page talk to each other:
   - scrolling drifts the pond (parallax) and stirs the water
   - each section sets the pond's mood (rain, warm dusk, moonlight)
   - a koi under a card tints its border; lanterns warm nearby cards
   ============================================================================= */

const glassEls = [...document.querySelectorAll(".glass")];
// sections that have a mood, in page order (used to find the one you're reading)
const moodSections = ["top", ...Object.keys(CONFIG.moods).filter(k => k !== "top")].map($).filter(Boolean);

function pageLink(dt) {
  scrollParallax();

  // the section whose top has passed the middle of the screen sets the mood
  let current = "top";
  for (const el of moodSections) {
    if (el.getBoundingClientRect().top < H * 0.55) current = el.id;
  }
  const m = CONFIG.moods[current] || CONFIG.moods.top, k = 1 - Math.exp(-dt * 1.2);
  mood.rain = lerp(mood.rain, m.rain, k);
  mood.warm = lerp(mood.warm, m.warm, k);
  mood.moon = lerp(mood.moon, m.moon, k);

  shadeEl.style.opacity = (clamp(scrollY / H, 0, 1) * 0.2).toFixed(3);
  navEl.classList.toggle("on", scrollY > H * 0.6);
  hintEl.style.display = scrollY > H * 0.3 ? "none" : "";

  cardTintTimer -= dt;
  if (cardTintTimer < 0) {
    cardTintTimer = 0.12;
    tintCards();
  }
}

/** the whole pond drifts at 35% of the scroll speed; fast scrolling stirs the water */
function scrollParallax() {
  const dy = scrollY - lastScrollY;
  lastScrollY = scrollY;
  if (!dy) return;
  const shift = -dy * 0.35;
  scrollPix -= shift;
  for (const f of fish) {
    for (const n of f.nodes) n.y += shift;
    f.goalY += shift;
  }
  for (const p of pellets) p.y += shift;
  for (const r of ripples) r.y += shift;
  for (const d of leaves) d.y += shift;
  for (const p of pads) {
    // lily pads wrap around top ↔ bottom
    p.y += shift;
    if (p.y < -p.radius * 1.2) p.y += H + p.radius * 2.4;
    else if (p.y > H + p.radius * 1.2) p.y -= H + p.radius * 2.4;
  }
  if (Math.abs(dy) > 6) for (let n = 0; n < 2; n++) addRipple(rnd(0, W), rnd(0, H), rnd(20, 40) * SC, 0.35, 40);
}

/** each visible card: border tinted by the koi most under it, warmth from nearby lanterns */
function tintCards() {
  for (const el of glassEls) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;

    let c = null, bestN = 0;
    for (const f of fish) {
      let n = 0;
      for (const p of f.nodes) if (p.x > r.left - 12 && p.x < r.right + 12 && p.y > r.top - 12 && p.y < r.bottom + 12) n++;
      if (n > bestN) {
        bestN = n;
        c = f.colour;
      }
    }
    el.style.setProperty("--tint", c ? `rgba(${c[0]},${c[1]},${c[2]},.8)` : "rgba(190,215,210,.13)");
    el.style.setProperty("--tglow", c ? `rgba(${c[0]},${c[1]},${c[2]},.16)` : "rgba(0,0,0,0)");

    let warm = 0;
    for (const L of lanterns) {
      const dx = Math.max(r.left - L.x, 0, L.x - r.right), dy = Math.max(r.top - L.y, 0, L.y - r.bottom);
      warm = Math.max(warm, clamp(1 - Math.hypot(dx, dy) / (200 * SC), 0, 1) * Math.min(1.5, L.intensity));
    }
    el.style.setProperty("--warm", Math.min(1, warm * 0.8 + mood.warm * 0.25).toFixed(2));
  }
}

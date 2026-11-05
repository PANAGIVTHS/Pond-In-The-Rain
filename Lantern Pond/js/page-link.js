/* =============================================================================
   How the pond and the page talk to each other:
   - scrolling drifts the pond (parallax) and stirs the water
   ============================================================================= */


function pageLink(dt) {
  scrollParallax();

  shadeEl.style.opacity = (clamp(scrollY / H, 0, 1) * 0.2).toFixed(3);
  navEl.classList.toggle("on", scrollY > H * 0.6);
  hintEl.style.display = scrollY > H * 0.3 ? "none" : "";
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
  for (const p of pads) {
    // lily pads wrap around top ↔ bottom
    p.y += shift;
    if (p.y < -p.radius * 1.2) p.y += H + p.radius * 2.4;
    else if (p.y > H + p.radius * 1.2) p.y -= H + p.radius * 2.4;
  }
  if (Math.abs(dy) > 6) for (let n = 0; n < 2; n++) addRipple(rnd(0, W), rnd(0, H), rnd(20, 40) * SC, 0.35, 40);
}

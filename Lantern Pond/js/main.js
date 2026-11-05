/* =============================================================================
   Start-up and the frame loop.
   ============================================================================= */

function frame(now) {
  const realDt = Math.min(0.05, (now - lastFrame) / 1000); // capped so a background tab doesn't jump
  const dt = still ? 0 : realDt;
  lastFrame = now;
  t += dt;
  pageLink(realDt); // the page keeps responding even while the pond is still
  update(dt);
  render();
  requestAnimationFrame(frame);
}

resize();
makeLanterns();
spawnKoi();
addEventListener("resize", resize);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize); // re-measure once the web fonts arrive
requestAnimationFrame(frame);

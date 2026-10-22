/* =============================================================================
   Start-up and the frame loop.
   ============================================================================= */

function frame(now) {
  t += Math.min(0.05, (now - lastFrame) / 1000); // capped so a background tab doesn't jump
  lastFrame = now;
  render();
  requestAnimationFrame(frame);
}

resize();
addEventListener("resize", resize);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize); // re-measure once the web fonts arrive
requestAnimationFrame(frame);

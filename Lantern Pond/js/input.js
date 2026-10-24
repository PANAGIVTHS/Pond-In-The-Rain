/* =============================================================================
   Input: the water.
   On the water: move = a small wake, click = a ripple that scares koi.
   ============================================================================= */

/** koi within radius of (x, y) dart away for `time` seconds */
function scare(x, y, radius, time) {
  for (const f of fish) {
    const h = f.nodes[0];
    if (Math.hypot(h.x - x, h.y - y) < radius) {
      f.fleeTimer = time;
      f.fleeAngle = Math.atan2(h.y - y, h.x - x);
    }
  }
}

/** a click on the water */
function poke(x, y) {
  addRipple(x, y, 150 * SC, 1.25, 70);
  addRipple(x, y, 105 * SC, 0.8, 62, 0.32);
  scare(x, y, 190 * SC, 0.9);
}

// ---- the water itself
canvas.addEventListener("pointermove", e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  const w = pointer.lastWake; // a small wake every so often as the pointer moves
  if (Math.hypot(pointer.x - w.x, pointer.y - w.y) > 34 * SC && t - w.t > 0.09) {
    w.x = pointer.x;
    w.y = pointer.y;
    w.t = t;
    addRipple(pointer.x, pointer.y, 24 * SC, 0.38, 34);
  }
});
canvas.addEventListener("pointerdown", e => {
  poke(e.clientX, e.clientY);
});

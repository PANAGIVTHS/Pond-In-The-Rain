/* =============================================================================
   Input: the water.
   On the water: move = a small wake, click = a ripple.
   ============================================================================= */

/** a click on the water */
function poke(x, y) {
  addRipple(x, y, 150 * SC, 1.25, 70);
  addRipple(x, y, 105 * SC, 0.8, 62, 0.32);
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

/* =============================================================================
   Input: the water, the lanterns and the contact form.
   On the water: move = a small wake, click = a ripple that scares koi,
   right-click / long-press = food, click a lantern = go to its section.
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

/** scatters six food pellets, each landing with a small ripple */
function feed(x, y) {
  for (let n = 0; n < 6; n++) {
    const px = x + rnd(-34, 34) * SC, py = y + rnd(-22, 22) * SC;
    pellets.push({ x: px, y: py, life: 14 });
    setTimeout(() => {
      addRipple(px, py, 16 * SC, 0.55, 30);
      tick(px);
    }, n * 45);
  }
}

/** a click on the water */
function poke(x, y) {
  addRipple(x, y, 150 * SC, 1.25, 70);
  addRipple(x, y, 105 * SC, 0.8, 62, 0.32);
  plop(x);
  scare(x, y, 190 * SC, 0.9);
}

/** a lantern was clicked: it rings and the page goes to its section */
function openLantern(L) {
  bell();
  L.intensity = 2.6;
  addRipple(L.x, L.y, 90 * SC, 1, 55);
  const el = $(L.info.target);
  if (el) el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
}

// ---- contact form: keystrokes are raindrops, sending releases a lantern
// (demo: it isn't connected to anything; hook it up to a form service to receive messages)
const formName = $("fName"), formMsg = $("fMsg"), formNote = $("fNote");
[formName, formMsg].forEach(inp =>
  inp.addEventListener("input", () => {
    const r = inp.getBoundingClientRect(), x = r.left + 14 + ((inp.value.length * 7.8) % Math.max(40, r.width - 28));
    addRipple(x, r.bottom - 8, 22 * SC, 0.6, 34);
    drip(x, 0.012);
  })
);
$("form").addEventListener("submit", e => {
  e.preventDefault();
  if (!formMsg.value.trim()) {
    formNote.textContent = "write a few words first ~";
    return;
  }
  const r = e.target.querySelector(".send").getBoundingClientRect(), x = r.left + r.width / 2;
  releaseLantern(x, r.top);
  addRipple(x, r.top, 120 * SC, 1.1, 60);
  bell();
  formNote.textContent = "✦ lantern released. (demo: this form is not connected yet, so nothing was sent; hook it up to a form service)";
  formMsg.value = "";
  formName.value = "";
});

// ---- the water itself
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("pointermove", e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  hovered = lanternAt(pointer.x, pointer.y);
  canvas.style.cursor = hovered ? "pointer" : "default";
  const w = pointer.lastWake; // a small wake every so often as the pointer moves
  if (Math.hypot(pointer.x - w.x, pointer.y - w.y) > 34 * SC && t - w.t > 0.09) {
    w.x = pointer.x;
    w.y = pointer.y;
    w.t = t;
    if (!hovered) addRipple(pointer.x, pointer.y, 24 * SC, 0.38, 34);
  }
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
});
canvas.addEventListener("pointerleave", () => {
  hovered = null;
});
canvas.addEventListener("pointerdown", e => {
  const x = e.clientX, y = e.clientY;
  const L = lanternAt(x, y);
  if (L) {
    openLantern(L);
    return;
  }
  if (e.button === 2) {
    feed(x, y);
    return;
  }
  if (e.pointerType === "touch") {
    pressTimer = setTimeout(() => {
      pressTimer = null;
      feed(x, y);
    }, 420);
    return;
  }
  poke(x, y);
});
canvas.addEventListener("pointerup", e => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
    poke(e.clientX, e.clientY);
  }
});

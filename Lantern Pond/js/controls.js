/* =============================================================================
   The buttons and the intro screen.
   ============================================================================= */

const btnRain = $("bRain"), btnStill = $("bStill");
const shadeEl = $("shade"), navEl = $("nav"), hintEl = $("hint");
btnStill.classList.add("off");

btnRain.onclick = () => {
  rainOn = !rainOn;
  btnRain.classList.toggle("off", !rainOn);
};

function setStill(v) {
  still = v;
  btnStill.classList.toggle("off", !v);
}
btnStill.onclick = () => setStill(!still);
try {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
} catch (e) {}

// ---- intro -------------------------------------------------------------------
document.body.classList.add("locked");
function enter() {
  $("intro").classList.add("gone");
  document.body.classList.remove("locked");
  setTimeout(() => (hintEl.style.opacity = 0.85), 1800);
  setTimeout(() => (hintEl.style.opacity = 0.35), 14000);
}

$("enterS").onclick = () => enter();

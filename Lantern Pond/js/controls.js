/* =============================================================================
   The buttons and the intro screen.
   ============================================================================= */

const btnRain = $("bRain"), btnSound = $("bSound"), btnStill = $("bStill");
const shadeEl = $("shade"), navEl = $("nav"), hintEl = $("hint");
btnSound.classList.add("off");
btnStill.classList.add("off");

btnRain.onclick = () => {
  rainOn = !rainOn;
  btnRain.classList.toggle("off", !rainOn);
  setRainSound(rainOn);
};
btnSound.onclick = () => setSound(!audio.on);

function setStill(v) {
  still = v;
  btnStill.classList.toggle("off", !v);
}
btnStill.onclick = () => setStill(!still);
try {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
} catch (e) {}

// ---- intro: "enter ♪" or "enter quietly" -----------------------------------
document.body.classList.add("locked");
function enter(withSound) {
  $("intro").classList.add("gone");
  document.body.classList.remove("locked");
  if (withSound) setSound(true);
  setTimeout(() => (hintEl.style.opacity = 0.85), 1800);
  setTimeout(() => (hintEl.style.opacity = 0.35), 14000);
}

$("enterS").onclick = () => enter(true);
$("enterQ").onclick = () => enter(false);

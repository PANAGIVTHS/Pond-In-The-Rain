/* =============================================================================
   The buttons, the intro screen, and project pages.
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
  route();
  setTimeout(() => (hintEl.style.opacity = 0.85), 1800);
  setTimeout(() => (hintEl.style.opacity = 0.35), 14000);
}

// ---- project pages ---------------------------------------------------------
// A <section class="projectPage" id="project-…"> is its own page: when the URL is #project-…
// only that section shows. Any other hash goes back to the normal page.
const projectPages = [...document.querySelectorAll(".projectPage")];
const inProjectView = () => document.body.classList.contains("proj-view");

function route() {
  const id = location.hash.slice(1), page = projectPages.find(p => p.id === id);
  document.body.classList.toggle("proj-view", !!page);
  projectPages.forEach(p => (p.hidden = p !== page));
  const el = page || (id && $(id));
  if (el && !$("intro").classList.contains("gone")) return; // wait until the visitor has entered
  if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
}
addEventListener("hashchange", route);
route();

// clicking a project card (anywhere but its links) opens its page
document.querySelectorAll(".proj[data-open]").forEach(card =>
  card.addEventListener("click", e => {
    if (!e.target.closest("a")) location.hash = card.dataset.open;
  })
);

$("enterS").onclick = () => enter(true);
$("enterQ").onclick = () => enter(false);

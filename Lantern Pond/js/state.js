/* =============================================================================
   Shared state of the pond (everything else reads and updates these).
   ============================================================================= */

let rainOn = true;          // the ☂ button
let still = false;          // the ◌ button: freezes the simulation
let t = 0;                  // simulation time in seconds (stops while still)
let lastFrame = performance.now();
let rainAcc = 0;            // fractional raindrops carried to the next frame

let lastScrollY = scrollY;
let scrollPix = 0;          // how far the pond has drifted from scrolling (moves the light net with it)

const pointer = { x: -999, y: -999, lastWake: { x: 0, y: 0, t: 0 } };
let hovered = null;         // the lantern under the pointer
let pressTimer = null;      // long-press to feed on touch screens

let ripples = [];           // { x, y, r, max, strength, speed } expanding rings
let pellets = [];           // food
let streaks = [];           // rain streaks

/** starts a ripple ring; delay (s) holds it back so rings can follow each other */
function addRipple(x, y, max, strength, speed = 40, delay = 0) {
  ripples.push({ x, y, r: -delay * speed, max, strength, speed });
}

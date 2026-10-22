/* =============================================================================
   Shared state of the pond (everything else reads and updates these).
   ============================================================================= */

let t = 0;                  // simulation time in seconds
let lastFrame = performance.now();

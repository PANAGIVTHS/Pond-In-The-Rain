/* =============================================================================
   Lantern Pond: settings
   The things you're most likely to want to change live here. The page text
   (about, projects, contact…) is in index.html.
   ============================================================================= */

const CONFIG = {
  // the name drawn on the water; use "\n" to split it over two lines
  name: "Panagiotis\nTsogkas",
  tagline: "hardware  ·  software  ·  games",
  // how the name is drawn: "ascii" (classic density ramp) or "soft" (shaded blocks)
  titleStyle: "ascii",
  fishCount: 8,

  // the lanterns are a floating map: clicking one glides to its section
  lanterns: [
    { kanji: "私", label: "about",   target: "about" },
    { kanji: "作", label: "work",    target: "projects" },
    { kanji: "道", label: "tools",   target: "tools" },
    { kanji: "文", label: "contact", target: "contact" },
  ],

  // the pond's mood in each section (by section id):
  // rain = how hard it rains, warm = dusk lantern light, moon = cool moonlight
  moods: {
    top:            { rain: 1,    warm: 0,    moon: 0 },
    about:          { rain: 0.8,  warm: 0.1,  moon: 0 },
    projects:       { rain: 0.55, warm: 0.55, moon: 0 },
    tools:          { rain: 1.7,  warm: 0,    moon: 0 },
    contact:        { rain: 0.35, warm: 0.1,  moon: 0.8 },
  },

  // sound
  volume: 0.28,        // master volume (0–1)
  rainVolume: 0.1,     // rain, relative to the other sounds
  thunderVolume: 0.18, // thunder (at its loudest about 3× the rain)
  bellVolume: 0.7,     // the lantern bell
};

/* =============================================================================
   Sound: everything is synthesised live with Web Audio (no sound files).
   Rain is filtered pink noise; drips, plops, ticks and the bell are oscillators;
   thunder is the same noise shaped into a crack and a long roll.
   ============================================================================= */

const audio = { ctx: null, on: false };

/** creates the audio graph on first use (browsers only allow it after a click) */
function initAudio() {
  if (audio.ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const a = new AC();
    audio.ctx = a;
    audio.master = a.createGain();
    audio.master.gain.value = 0;
    audio.master.connect(a.destination);

    // 4 s of stereo pink noise (Paul Kellet's filter), reused by the rain and the thunder
    const len = a.sampleRate * 4, buf = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.1;
        b6 = w * 0.115926;
      }
    }
    audio.noise = buf;

    // rain = a filtered hiss + a low wash, with slow gusts
    audio.rain = a.createGain();
    audio.rain.gain.value = rainOn ? CONFIG.rainVolume : 0;
    audio.rain.connect(audio.master);
    const hiss = a.createBufferSource();
    hiss.buffer = buf;
    hiss.loop = true;
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 650;
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    const hissGain = a.createGain();
    hissGain.gain.value = 0.42;
    hiss.connect(hp).connect(lp).connect(hissGain).connect(audio.rain);
    hiss.start();

    const wash = a.createBufferSource();
    wash.buffer = buf;
    wash.loop = true;
    wash.playbackRate.value = 0.37;
    const lp2 = a.createBiquadFilter();
    lp2.type = "lowpass";
    lp2.frequency.value = 420;
    const washGain = a.createGain();
    washGain.gain.value = 0.55;
    wash.connect(lp2).connect(washGain).connect(audio.rain);
    wash.start(0, 1.3);

    const gust = a.createOscillator();
    gust.frequency.value = 0.07;
    const gustDepth = a.createGain();
    gustDepth.gain.value = 0.12;
    gust.connect(gustDepth).connect(hissGain.gain);
    gust.start();

    // one-shot effects go through here
    audio.fx = a.createGain();
    audio.fx.gain.value = 1;
    audio.fx.connect(audio.master);
    return true;
  } catch (e) {
    audio.ctx = null;
    return false;
  }
}

function setSound(on) {
  audio.on = on;
  btnSound.classList.toggle("off", !on);
  if (on && !initAudio()) return;
  if (!audio.ctx) return;
  audio.ctx.resume && audio.ctx.resume();
  audio.master.gain.setTargetAtTime(on ? CONFIG.volume : 0, audio.ctx.currentTime, 0.5);
}

function setRainSound(on) {
  if (audio.ctx) audio.rain.gain.setTargetAtTime(on ? CONFIG.rainVolume : 0, audio.ctx.currentTime, 0.8);
}

const canPlay = () => audio.on && audio.ctx;

/** routes a sound left/right to match where it happened on screen */
function pan(node, x) {
  if (audio.ctx.createStereoPanner) {
    const p = audio.ctx.createStereoPanner();
    p.pan.value = clamp((x / W) * 2 - 1, -1, 1) * 0.7;
    node.connect(p);
    return p;
  }
  return node;
}

/** a raindrop / keystroke: a short falling sine */
function drip(x, vol) {
  if (!canPlay()) return;
  const a = audio.ctx, t = a.currentTime, o = a.createOscillator(), g = a.createGain(), f = rnd(1400, 3800);
  o.type = "sine";
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.07);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g);
  pan(g, x).connect(audio.fx);
  o.start(t);
  o.stop(t + 0.12);
}

/** clicking the water */
function plop(x) {
  if (!canPlay()) return;
  const a = audio.ctx, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(130, t + 0.2);
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g);
  pan(g, x).connect(audio.fx);
  o.start(t);
  o.stop(t + 0.3);
}

/** the lantern bell: a few inharmonic partials decaying at different rates */
function bell() {
  if (!canPlay()) return;
  const a = audio.ctx, t = a.currentTime;
  // [frequency ratio, volume, decay seconds]
  [[1, 0.11, 3.2], [2.01, 0.05, 2.4], [2.76, 0.045, 1.8], [5.4, 0.02, 1.1], [8.9, 0.01, 0.6]].forEach(([r, v, d]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 622 * r;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * CONFIG.bellVolume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(audio.fx);
    o.start(t);
    o.stop(t + d + 0.05);
  });
}

/** a food pellet landing / being eaten */
function tick(x) {
  if (!canPlay()) return;
  const a = audio.ctx, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = "triangle";
  o.frequency.value = rnd(900, 1300);
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g);
  pan(g, x).connect(audio.fx);
  o.start(t);
  o.stop(t + 0.06);
}

/** thunder arrives a moment after the flash: a crack, then a long rolling rumble */
function thunder() {
  if (!canPlay()) return;
  const a = audio.ctx, t0 = a.currentTime + rnd(1.0, 2.4);

  const crack = a.createBufferSource(), bp = a.createBiquadFilter(), crackGain = a.createGain();
  crack.buffer = audio.noise;
  crack.playbackRate.value = 0.8;
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.7;
  crackGain.gain.setValueAtTime(0, t0);
  crackGain.gain.linearRampToValueAtTime(0.9 * CONFIG.thunderVolume, t0 + 0.02);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  crack.connect(bp).connect(crackGain).connect(audio.fx);
  crack.start(t0, rnd(0, 3));
  crack.stop(t0 + 0.7);

  const roll = a.createBufferSource(), lp = a.createBiquadFilter(), rollGain = a.createGain();
  roll.buffer = audio.noise;
  roll.loop = true;
  roll.playbackRate.value = 0.35;
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1600, t0);
  lp.frequency.exponentialRampToValueAtTime(320, t0 + 4); // keeps the roll audible on small speakers
  rollGain.gain.setValueAtTime(0, t0);
  rollGain.gain.linearRampToValueAtTime(1.4 * CONFIG.thunderVolume, t0 + 0.25);
  rollGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5);
  roll.connect(lp).connect(rollGain).connect(audio.fx);
  roll.start(t0, rnd(0, 2));
  roll.stop(t0 + 5.7);
}

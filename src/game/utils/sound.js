// Tiny procedural sound-effect layer. The project has no audio asset pipeline,
// but every modern browser ships a Web Audio API, so short UI chimes can be
// synthesized on the fly with zero asset files and zero dependencies.

let sharedContext = null;
let masterGain = 1;
let sfxGain = 1;

/** Sets the master/SFX volume multipliers (0..1) applied to every sound effect below.
 * Called from App.jsx whenever the player changes audio settings. There's no music
 * system yet, so a music volume preference has nothing to scale here. */
export function setVolumes(master, sfx) {
  masterGain = Math.min(1, Math.max(0, master));
  sfxGain = Math.min(1, Math.max(0, sfx));
}

function getContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!sharedContext) sharedContext = new AudioCtx();
    if (sharedContext.state === 'suspended') sharedContext.resume();
    return sharedContext;
  } catch {
    return null;
  }
}

function tone(ctx, freq, startTime, duration, { type = 'sine', gain = 0.12 } = {}) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const scaledGain = gain * masterGain * sfxGain;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(scaledGain, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/** Bright two-note rising chime for a satisfying purchase confirmation. */
export function playPurchaseSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 660, now, 0.12, { type: 'triangle', gain: 0.14 });
  tone(ctx, 880, now + 0.08, 0.16, { type: 'triangle', gain: 0.16 });
}

/** Short low buzz for a denied purchase (insufficient funds / maxed out). */
export function playDeniedSound() {
  const ctx = getContext();
  if (!ctx) return;
  tone(ctx, 160, ctx.currentTime, 0.14, { type: 'square', gain: 0.08 });
}

/** Quick rising sweep when boost kicks in. */
export function playBoostSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(0.09 * masterGain * sfxGain, now + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

/** Short filtered noise burst for a tire screech (drifting / hard braking). */
export function playSkidSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const duration = 0.18;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.Q.value = 1.2;
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.06 * masterGain * sfxGain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration);
}

/** Low thud for a solid collision, scaled 0..1 by impact strength. */
export function playImpactSound(strength = 1) {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const amount = Math.min(1, Math.max(0.15, strength));
  tone(ctx, 90, now, 0.16, { type: 'square', gain: 0.05 + amount * 0.1 });
}

/** Quick high ding for narrowly avoiding traffic. */
export function playNearMissSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 1100, now, 0.09, { type: 'sine', gain: 0.07 });
  tone(ctx, 1500, now + 0.05, 0.1, { type: 'sine', gain: 0.06 });
}

/** Three-note ascending chime for collecting a time-refill pickup — distinct from the
 * purchase/boost cues so it reads as "time", not "money" or "speed". */
export function playTimeBonusSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 520, now, 0.1, { type: 'triangle', gain: 0.12 });
  tone(ctx, 700, now + 0.07, 0.1, { type: 'triangle', gain: 0.13 });
  tone(ctx, 940, now + 0.14, 0.16, { type: 'triangle', gain: 0.15 });
}

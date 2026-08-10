// Tiny procedural sound-effect layer. The project has no audio asset pipeline,
// but every modern browser ships a Web Audio API, so short UI chimes can be
// synthesized on the fly with zero asset files and zero dependencies.

let sharedContext = null;

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
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.015);
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

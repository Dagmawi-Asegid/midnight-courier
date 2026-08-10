import { lerp } from '../utils/math.js';

// Difficulty ramps smoothly across the first RAMP_NIGHTS nights, then holds steady — it never
// keeps escalating forever, so a long run can't quietly become unwinnable. Each axis moves from
// its `base` (night 1) to its `max` (night RAMP_NIGHTS and beyond); the player's own upgrades
// (speed/handling for traffic & obstacles, night length for shorter nights, destination indicator
// for tighter windows, etc.) directly counteract the corresponding axis, keeping the curve fair.
const RAMP_NIGHTS = 10;

const CURVE = {
  traffic: { base: 14, max: 26 },
  obstacles: { base: 16, max: 30 },
  nightDurationMultiplier: { base: 1, max: 0.82 },
  deliveryTimeMultiplier: { base: 1, max: 0.85 },
  routeDistanceBias: { base: 0, max: 0.35 },
  eventIntervalMultiplier: { base: 1, max: 0.6 },
  upgradeCostMultiplier: { base: 1, max: 1.35 },
  // More time-refill pickups on later nights — a small counterweight to shorter nights and
  // tighter delivery windows, keeping the curve fair the same way every other axis is countered.
  timePickupCount: { base: 6, max: 10 },
};

/** 0 on night 1, ramping linearly to 1 by RAMP_NIGHTS, then holding steady. */
export function difficultyProgress(night) {
  return Math.min(1, Math.max(0, (night - 1) / (RAMP_NIGHTS - 1)));
}

/** Resolves every difficulty-scaled value for a given night in one place. */
export function getDifficulty(night) {
  const t = difficultyProgress(night);
  const at = (key) => lerp(CURVE[key].base, CURVE[key].max, t);
  return {
    night,
    progress: t,
    trafficCount: Math.round(at('traffic')),
    obstacleCount: Math.round(at('obstacles')),
    nightDurationMultiplier: at('nightDurationMultiplier'),
    deliveryTimeMultiplier: at('deliveryTimeMultiplier'),
    routeDistanceBias: at('routeDistanceBias'),
    eventIntervalMultiplier: at('eventIntervalMultiplier'),
    upgradeCostMultiplier: at('upgradeCostMultiplier'),
    timePickupCount: Math.round(at('timePickupCount')),
  };
}

/** A short brief for the night-intro screen, plus tags for whichever axes have moved by a
 * meaningful amount from their night-1 baseline (not just any nonzero epsilon) — so an early
 * night with a barely-there bump doesn't read as "everything just got harder." */
export function describeNightChallenge(difficulty) {
  if (difficulty.progress <= 0) {
    return {
      tagline: "First shift. Keep it simple, learn the streets, and don't miss the easy ones.",
      tags: [],
    };
  }

  const tags = [];
  if (difficulty.trafficCount >= CURVE.traffic.base + 2) tags.push({ icon: '🚗', label: 'Heavier traffic' });
  if (difficulty.obstacleCount >= CURVE.obstacles.base + 3) tags.push({ icon: '🚧', label: 'More obstacles' });
  if (difficulty.nightDurationMultiplier <= 0.95) tags.push({ icon: '⏱️', label: 'Shorter night' });
  if (difficulty.deliveryTimeMultiplier <= 0.95) tags.push({ icon: '⌛', label: 'Tighter delivery windows' });
  if (difficulty.routeDistanceBias >= 0.08) tags.push({ icon: '🗺️', label: 'Longer routes' });
  if (difficulty.eventIntervalMultiplier <= 0.9) tags.push({ icon: '⚠️', label: 'More frequent events' });
  if (difficulty.upgradeCostMultiplier >= 1.08) tags.push({ icon: '💸', label: 'Pricier upgrades' });

  const tagline =
    difficulty.progress >= 1
      ? "The city's at full tilt tonight. Ride smart and lean on your upgrades."
      : 'The city is waking up — a little busier and a little less forgiving than last night.';

  return { tagline, tags };
}

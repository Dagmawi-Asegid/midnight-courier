import { lerp } from '../utils/math.js';

// Difficulty ramps smoothly across the first RAMP_LEVELS levels, then holds steady — it never
// keeps escalating forever, so a long run can't quietly become unwinnable. Each axis moves from
// its `base` (level 1) to its `max` (level RAMP_LEVELS and beyond); the player's own upgrades
// (speed/handling for traffic & obstacles, night length for shorter nights, destination indicator
// for tighter windows, etc.) directly counteract the corresponding axis, keeping the curve fair.
const RAMP_LEVELS = 20;
export const LEVEL_CAP = RAMP_LEVELS;

// Level length: starts at 10 minutes and steps down a minute per level toward a 3-minute floor,
// which it hits at level 8 and holds from there — long nights early when the player has the
// fewest deliveries-per-minute skills, tighter (but never punishing) later once upgrades and
// bigger time-refill pickups are in play.
const LEVEL_DURATION_START = 600; // seconds (10 min)
const LEVEL_DURATION_FLOOR = 180; // seconds (3 min)
const LEVEL_DURATION_STEP = 60; // seconds shaved off per level until the floor

const CURVE = {
  traffic: { base: 14, max: 26 },
  obstacles: { base: 16, max: 30 },
  deliveryTimeMultiplier: { base: 1, max: 0.85 },
  routeDistanceBias: { base: 0, max: 0.35 },
  eventIntervalMultiplier: { base: 1, max: 0.6 },
  upgradeCostMultiplier: { base: 1, max: 1.35 },
  // More, and bigger, time-refill pickups on later levels — a direct counterweight to shorter
  // nights, keeping the curve fair the same way every other axis is countered by an upgrade.
  timePickupCount: { base: 10, max: 20 },
  timeRefillSeconds: { base: 20, max: 30 },
};

/** 0 on level 1, ramping linearly to 1 by RAMP_LEVELS, then holding steady. */
export function difficultyProgress(level) {
  return Math.min(1, Math.max(0, (level - 1) / (RAMP_LEVELS - 1)));
}

/** Resolves every difficulty-scaled value for a given level in one place. */
export function getDifficulty(level) {
  const t = difficultyProgress(level);
  const at = (key) => lerp(CURVE[key].base, CURVE[key].max, t);
  return {
    night: level,
    level,
    progress: t,
    levelCap: RAMP_LEVELS,
    trafficCount: Math.round(at('traffic')),
    obstacleCount: Math.round(at('obstacles')),
    nightDurationSeconds: Math.max(LEVEL_DURATION_FLOOR, LEVEL_DURATION_START - (level - 1) * LEVEL_DURATION_STEP),
    deliveryTimeMultiplier: at('deliveryTimeMultiplier'),
    routeDistanceBias: at('routeDistanceBias'),
    eventIntervalMultiplier: at('eventIntervalMultiplier'),
    upgradeCostMultiplier: at('upgradeCostMultiplier'),
    timePickupCount: Math.round(at('timePickupCount')),
    timeRefillSeconds: Math.round(at('timeRefillSeconds')),
  };
}

/** A short brief for the level-intro screen, plus tags for whichever axes have moved by a
 * meaningful amount from their level-1 baseline (not just any nonzero epsilon) — so an early
 * level with a barely-there bump doesn't read as "everything just got harder." */
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
  if (difficulty.nightDurationSeconds <= LEVEL_DURATION_START - 60) tags.push({ icon: '⏱️', label: 'Shorter night' });
  if (difficulty.deliveryTimeMultiplier <= 0.95) tags.push({ icon: '⌛', label: 'Tighter delivery windows' });
  if (difficulty.routeDistanceBias >= 0.08) tags.push({ icon: '🗺️', label: 'Longer routes' });
  if (difficulty.eventIntervalMultiplier <= 0.9) tags.push({ icon: '⚠️', label: 'More frequent events' });
  if (difficulty.upgradeCostMultiplier >= 1.08) tags.push({ icon: '💸', label: 'Pricier upgrades' });
  if (difficulty.timeRefillSeconds > CURVE.timeRefillSeconds.base) {
    tags.push({ icon: '🟢', label: `Bigger time refills (+${difficulty.timeRefillSeconds}s)` });
  }

  const tagline =
    difficulty.progress >= 1
      ? "The city's at full tilt tonight. Ride smart and lean on your upgrades."
      : 'The city is waking up — a little busier and a little less forgiving than last night.';

  return { tagline, tags };
}

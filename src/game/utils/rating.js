// Extra cut of the night's earnings awarded for passing the level.
const PASS_BONUS_RATE = 0.4;

/**
 * The delivery goal shown on the briefing screen is the one number that matters: hit it (or
 * beat it) and the level is a full pass — 3 stars, the earnings bonus, and the next level
 * unlocks (see gameReducer's NIGHT_ENDED). Miss it and it's 0 — no partial credit in between, so
 * "did I pass?" always has one clear, unambiguous answer instead of depending on combo/efficiency
 * extras the player was never told about. Deeper performance (no failures, no damage, big combos)
 * is still recognized separately through achievements.
 */
export function computeNightRating({ deliveriesCompleted, deliveryGoal = 1 }) {
  return deliveriesCompleted >= deliveryGoal ? 3 : 0;
}

/** Extra cash awarded on top of the night's raw earnings for passing the level. */
export function computeNightBonus(money, rating) {
  return rating > 0 ? Math.round(money * PASS_BONUS_RATE) : 0;
}

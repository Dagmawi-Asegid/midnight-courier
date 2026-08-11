// How much of the night's earnings the player keeps as an extra bonus, based on their rating.
const BONUS_RATE_BY_RATING = { 1: 0.05, 2: 0.18, 3: 0.4 };

/**
 * 0-3 star rating. 0 means the level's delivery goal wasn't met — the level isn't passed, and
 * (see gameReducer's NIGHT_ENDED) the next level stays locked. Meeting the goal always earns at
 * least 1 star; 2-3 stars beyond that are based on the RATE of success (completed vs. failed
 * deliveries) and the best combo reached that night, not absolute totals — a careful, consistent
 * courier can always earn 3 stars once they clear the goal, even deep into a run.
 */
export function computeNightRating({ deliveriesCompleted, deliveriesFailed, bestCombo, deliveryGoal = 1 }) {
  if (deliveriesCompleted < deliveryGoal) return 0;

  const attempted = deliveriesCompleted + deliveriesFailed;
  const successRate = attempted === 0 ? 1 : deliveriesCompleted / attempted;
  const comboScore = Math.min(1, bestCombo / 6);
  const score = successRate * 2 + comboScore;

  if (score >= 2.3) return 3;
  if (score >= 1.3) return 2;
  return 1;
}

/** Extra cash awarded on top of the night's raw earnings for a good rating. */
export function computeNightBonus(money, rating) {
  return Math.round(money * (BONUS_RATE_BY_RATING[rating] ?? 0));
}

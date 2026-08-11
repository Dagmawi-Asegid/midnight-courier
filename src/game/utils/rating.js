// How much of the night's earnings the player keeps as an extra bonus, based on their rating.
const BONUS_RATE_BY_RATING = { 1: 0.05, 2: 0.18, 3: 0.4 };

/**
 * 1-3 star rating based on the RATE of success (completed vs. failed deliveries) and the best
 * combo reached that night — not absolute totals. That keeps it fair regardless of how much
 * difficulty has scaled up traffic/time/obstacles: a careful, consistent courier can always
 * earn 3 stars, even deep into a run. Finishing a night always earns at least 1 star.
 */
export function computeNightRating({ deliveriesCompleted, deliveriesFailed, bestCombo }) {
  const attempted = deliveriesCompleted + deliveriesFailed;
  if (attempted === 0) return 1;

  const successRate = deliveriesCompleted / attempted;
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

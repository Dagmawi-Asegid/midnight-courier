import { DeliveryPoint } from '../entities/DeliveryPoint.js';
import { clamp, dist } from '../utils/math.js';
import { chance, pick } from '../utils/random.js';
import { DELIVERY_TYPES, WORLD_HEIGHT, WORLD_WIDTH } from '../engine/constants.js';

const CROSS_DISTRICT_CHANCE = 0.7; // how often the drop-off is pushed into a different district than the pickup
const WORLD_DIAGONAL = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT);
const MIN_TIME_LIMIT = 12; // seconds — floor so even the shortest hop gives time to react and ride there
const CANDIDATE_COUNT = 3; // how many jobs are offered at once in the selection panel
export const AUTO_SELECT_TIMEOUT = 7; // seconds before the game picks for you, so the run never stalls

const SIDE_OFFSETS = {
  n: (b) => ({ x: b.x + b.w / 2, y: b.y - 22 }),
  s: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h + 22 }),
  e: (b) => ({ x: b.x + b.w + 22, y: b.y + b.h / 2 }),
  w: (b) => ({ x: b.x - 22, y: b.y + b.h / 2 }),
};

const TYPE_LIST = Object.values(DELIVERY_TYPES);
const TYPE_WEIGHT_TOTAL = TYPE_LIST.reduce((sum, t) => sum + t.weight, 0);

function pickDeliveryType(rng) {
  let r = rng() * TYPE_WEIGHT_TOTAL;
  for (const type of TYPE_LIST) {
    if (r < type.weight) return type;
    r -= type.weight;
  }
  return TYPE_LIST[0];
}

/**
 * Drives the offer -> accept -> ride -> deliver loop. Whenever there's no active order, up to
 * `CANDIDATE_COUNT` candidate jobs are generated and offered together in a selection panel so
 * the player can weigh pay/distance/risk before committing to one — but choosing is never
 * mandatory: leaving it too long auto-selects the first candidate so a distracted or exploring
 * player is never soft-locked without a job. Once a job is chosen, the flow is unchanged from
 * before: accepting at the pickup starts a per-delivery countdown, and arriving at the drop-off
 * within that window auto-completes the delivery — no button needed, matching the "ride there
 * and arrive" fantasy. Running out of time fails the order (lost payout, streak reset) and
 * immediately offers a fresh set of candidates so the night keeps moving.
 *
 * `difficulty` (see engine/difficulty.js) tightens per-delivery time limits and biases
 * drop-offs to be farther away as the run progresses — two of the night-over-night
 * difficulty knobs, alongside traffic/obstacle counts and event frequency.
 */
export class DeliverySystem {
  constructor(city, rng, interactRadius, difficulty = {}) {
    this.city = city;
    this.rng = rng;
    this.interactRadius = interactRadius;
    this.timeMultiplier = difficulty.deliveryTimeMultiplier ?? 1;
    this.minRouteDistance = (difficulty.routeDistanceBias ?? 0) * WORLD_DIAGONAL;
    this.phase = 'toPickup'; // 'selecting' | 'toPickup' | 'toDropoff'
    this.order = null;
    this.candidates = [];
    this.selectionTimer = 0;
    this._lastBuildingId = null;
    this._queueCandidates();
  }

  setInteractRadius(radius) {
    this.interactRadius = radius;
  }

  /** Picks a district (optionally biased away from `excludeDistrict`), then a building within it. */
  _pickBuilding(excludeId, excludeDistrict) {
    const districtIds = Object.keys(this.city.buildingsByDistrict).filter(
      (id) => this.city.buildingsByDistrict[id].length > 0
    );
    let districtId;
    if (excludeDistrict && districtIds.length > 1 && chance(this.rng, CROSS_DISTRICT_CHANCE)) {
      const others = districtIds.filter((id) => id !== excludeDistrict);
      districtId = pick(this.rng, others.length ? others : districtIds);
    } else {
      districtId = pick(this.rng, districtIds);
    }

    const pool = this.city.buildingsByDistrict[districtId];
    let building;
    let attempts = 0;
    do {
      building = pick(this.rng, pool);
      attempts++;
    } while (building.id === excludeId && attempts < 8 && pool.length > 1);
    return building;
  }

  _randomSpot(excludeId, excludeDistrict) {
    const building = this._pickBuilding(excludeId, excludeDistrict);
    const side = pick(this.rng, ['n', 's', 'e', 'w']);
    const { x, y } = SIDE_OFFSETS[side](building);
    return { x, y, buildingId: building.id, district: building.district };
  }

  /** Rolls one complete candidate job (pickup + drop-off + pay/time terms) without touching
   * `this.order` — the caller decides whether/when it becomes the active job. */
  _generateOrder(excludeBuildingId) {
    const pickupSpot = this._randomSpot(excludeBuildingId);
    const pickup = new DeliveryPoint('pickup', pickupSpot.x, pickupSpot.y);

    // At higher difficulty, re-roll a too-close drop-off a few times to bias toward longer hauls.
    let dropoffSpot;
    let distance;
    let attempts = 0;
    do {
      dropoffSpot = this._randomSpot(pickupSpot.buildingId, pickupSpot.district);
      distance = dist(pickup.x, pickup.y, dropoffSpot.x, dropoffSpot.y);
      attempts++;
    } while (distance < this.minRouteDistance && attempts < 6);

    const dropoff = new DeliveryPoint('dropoff', dropoffSpot.x, dropoffSpot.y);
    const type = pickDeliveryType(this.rng);
    const distancePay = distance * type.payPerDistance;
    const potentialPay = Math.round((type.basePay + distancePay) * type.riskMultiplier);
    const timeLimit = Math.max(
      MIN_TIME_LIMIT,
      Math.round((type.timeBuffer + distance * type.timeFactor) * this.timeMultiplier)
    );

    return {
      type,
      pickup,
      dropoff,
      pickupBuildingId: pickupSpot.buildingId,
      dropoffBuildingId: dropoffSpot.buildingId,
      distance,
      basePay: type.basePay,
      distancePay,
      potentialPay,
      timeLimit,
      timeRemaining: timeLimit,
    };
  }

  /** Rolls a fresh batch of candidate jobs and opens the selection window. */
  _queueCandidates() {
    this.candidates = Array.from({ length: CANDIDATE_COUNT }, () => this._generateOrder(this._lastBuildingId));
    this.order = null;
    this.phase = 'selecting';
    this.selectionTimer = 0;
  }

  /** Commits to one of the currently offered candidates (called directly by the engine in
   * response to a player click, not through the per-frame `update()` return value). */
  selectCandidate(index) {
    const chosen = this.candidates[index];
    if (!chosen) return;
    this.order = chosen;
    this.candidates = [];
    this._lastBuildingId = chosen.dropoffBuildingId;
    this.phase = 'toPickup';
  }

  /** Advances markers, per-delivery timer and arrival checks. Returns an event or null. */
  update(dt, player, interactPressed) {
    if (this.phase === 'selecting') {
      this.selectionTimer += dt;
      if (this.selectionTimer >= AUTO_SELECT_TIMEOUT) {
        const order = this.candidates[0];
        this.selectCandidate(0);
        return { type: 'autoSelected', order };
      }
      return null;
    }

    const order = this.order;
    order.pickup.update(dt);
    order.dropoff.update(dt);

    if (this.phase === 'toPickup') {
      const d = dist(player.x, player.y, order.pickup.x, order.pickup.y);
      if (d <= this.interactRadius && interactPressed) {
        this.phase = 'toDropoff';
        order.timeRemaining = order.timeLimit;
        return { type: 'accepted', order };
      }
      return null;
    }

    order.timeRemaining -= dt;
    if (order.timeRemaining <= 0) {
      const failedOrder = order;
      this._queueCandidates();
      return { type: 'failed', order: failedOrder };
    }

    const d = dist(player.x, player.y, order.dropoff.x, order.dropoff.y);
    if (d <= this.interactRadius) {
      const timeFraction = clamp(order.timeRemaining / order.timeLimit, 0, 1);
      const timeBonus = (order.basePay + order.distancePay) * timeFraction * 0.5;
      const subtotal = Math.round((order.basePay + order.distancePay + timeBonus) * order.type.riskMultiplier);
      const completedOrder = order;
      this._queueCandidates();
      return { type: 'delivered', order: completedOrder, subtotal, timeFraction };
    }
    return null;
  }

  get activeMarker() {
    if (!this.order) return null;
    return this.phase === 'toPickup' ? this.order.pickup : this.order.dropoff;
  }
}

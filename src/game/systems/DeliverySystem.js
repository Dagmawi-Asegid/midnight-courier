import { DeliveryPoint } from '../entities/DeliveryPoint.js';
import { clamp, dist } from '../utils/math.js';
import { chance, pick } from '../utils/random.js';
import { DELIVERY_TYPES } from '../engine/constants.js';

const CROSS_DISTRICT_CHANCE = 0.7; // how often the drop-off is pushed into a different district than the pickup

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
 * Drives the accept -> ride -> deliver loop. One active order at a time.
 * Both the pickup and drop-off are generated together (and shown together)
 * so the player can weigh the job before committing. Accepting at the
 * pickup starts a per-delivery countdown; arriving at the drop-off within
 * that window auto-completes the delivery — no button needed, matching the
 * "ride there and arrive" fantasy. Running out of time fails the order
 * (lost payout, streak reset) and immediately queues a new one so the night
 * keeps moving.
 */
export class DeliverySystem {
  constructor(city, rng, interactRadius) {
    this.city = city;
    this.rng = rng;
    this.interactRadius = interactRadius;
    this.phase = 'toPickup'; // 'toPickup' | 'toDropoff'
    this.order = null;
    this._lastBuildingId = null;
    this._queueOrder();
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

  _queueOrder() {
    const pickupSpot = this._randomSpot(this._lastBuildingId);
    const dropoffSpot = this._randomSpot(pickupSpot.buildingId, pickupSpot.district);
    const pickup = new DeliveryPoint('pickup', pickupSpot.x, pickupSpot.y);
    const dropoff = new DeliveryPoint('dropoff', dropoffSpot.x, dropoffSpot.y);
    const type = pickDeliveryType(this.rng);
    const distance = dist(pickup.x, pickup.y, dropoff.x, dropoff.y);
    const distancePay = distance * type.payPerDistance;
    const potentialPay = Math.round((type.basePay + distancePay) * type.riskMultiplier);
    const timeLimit = Math.round(type.timeBuffer + distance * type.timeFactor);

    this._lastBuildingId = dropoffSpot.buildingId;
    this.order = {
      type,
      pickup,
      dropoff,
      distance,
      basePay: type.basePay,
      distancePay,
      potentialPay,
      timeLimit,
      timeRemaining: timeLimit,
    };
    this.phase = 'toPickup';
  }

  /** Advances markers, per-delivery timer and arrival checks. Returns an event or null. */
  update(dt, player, interactPressed) {
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
      this._queueOrder();
      return { type: 'failed', order: failedOrder };
    }

    const d = dist(player.x, player.y, order.dropoff.x, order.dropoff.y);
    if (d <= this.interactRadius) {
      const timeFraction = clamp(order.timeRemaining / order.timeLimit, 0, 1);
      const timeBonus = (order.basePay + order.distancePay) * timeFraction * 0.5;
      const subtotal = Math.round((order.basePay + order.distancePay + timeBonus) * order.type.riskMultiplier);
      const completedOrder = order;
      this._queueOrder();
      return { type: 'delivered', order: completedOrder, subtotal, timeFraction };
    }
    return null;
  }

  get activeMarker() {
    return this.phase === 'toPickup' ? this.order.pickup : this.order.dropoff;
  }
}

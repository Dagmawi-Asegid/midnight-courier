export const TIME_PICKUP_RADIUS = 14;

/** A collectible green fuel-tank sitting on a road lane — ride into it for a time refill. The
 * refill amount is set per-spawn (it scales up on harder levels, see difficulty.js
 * `timeRefillSeconds`) rather than being a fixed constant. Purely static and one-shot per night
 * (no respawn): `collected` flips true and it stops being drawn/checked once ridden through. */
export class TimePickup {
  constructor(x, y, seconds, pulseSeed = 0) {
    this.x = x;
    this.y = y;
    this.seconds = seconds;
    this.radius = TIME_PICKUP_RADIUS;
    this.pulseSeed = pulseSeed;
    this.collected = false;
  }
}

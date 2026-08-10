export const TIME_PICKUP_SECONDS = 20;
export const TIME_PICKUP_RADIUS = 14;

/** A collectible green fuel-tank sitting on a road lane — ride into it for a +20s time refill.
 * Purely static and one-shot per night (no respawn): `collected` flips true and it stops being
 * drawn/checked once the player rides through it. */
export class TimePickup {
  constructor(x, y, pulseSeed = 0) {
    this.x = x;
    this.y = y;
    this.radius = TIME_PICKUP_RADIUS;
    this.pulseSeed = pulseSeed;
    this.collected = false;
  }
}

/** A pickup or drop-off marker rendered on the map and checked for proximity. */
export class DeliveryPoint {
  constructor(kind, x, y) {
    this.kind = kind; // 'pickup' | 'dropoff'
    this.x = x;
    this.y = y;
    this.pulse = 0;
  }

  update(dt) {
    this.pulse += dt;
  }
}

export const OBSTACLE_TYPES = {
  cone: { radius: 9, color: '#ff7a2f' },
  barrier: { radius: 16, color: '#e8c93f' },
  pothole: { radius: 13, color: '#05070a' },
  dumpster: { radius: 18, color: '#2f3a2f' },
  crate: { radius: 14, color: '#8a6a3f' },
  parkedCar: { radius: 17, color: '#8a8f9a' },
};

/**
 * Static hazard placed on or beside a road. Colliding slows the bike.
 * `angle` is only used by types that render as an oriented sprite (parked
 * cars); `color` can be overridden per instance so curbside cars vary.
 */
export class Obstacle {
  constructor(type, x, y, options = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = OBSTACLE_TYPES[type].radius;
    this.color = options.color || OBSTACLE_TYPES[type].color;
    this.angle = options.angle || 0;
  }
}

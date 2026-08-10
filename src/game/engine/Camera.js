import { clamp, lerp } from '../utils/math.js';

/** Smooth-follow camera clamped to the world bounds. */
export class Camera {
  constructor(worldWidth, worldHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = 0;
    this.viewHeight = 0;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  resize(viewWidth, viewHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  follow(targetX, targetY, dt) {
    const desiredX = targetX - this.viewWidth / 2;
    const desiredY = targetY - this.viewHeight / 2;
    const smoothing = 1 - Math.pow(0.001, dt);
    this.x = lerp(this.x, desiredX, smoothing);
    this.y = lerp(this.y, desiredY, smoothing);

    const maxX = Math.max(0, this.worldWidth - this.viewWidth);
    const maxY = Math.max(0, this.worldHeight - this.viewHeight);
    this.x = clamp(this.x, 0, maxX);
    this.y = clamp(this.y, 0, maxY);
  }

  worldToScreen(x, y) {
    return { x: x - this.x, y: y - this.y };
  }
}

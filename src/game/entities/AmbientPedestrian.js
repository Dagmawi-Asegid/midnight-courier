/**
 * Purely decorative crowd filler — wanders in a loose loop around a fixed
 * anchor point (a club entrance, a stoop, a plaza bench) so districts feel
 * populated. Never collides with anything and is cheap to update: no
 * gameplay state, just a bobbing walk cycle and a soft random drift.
 */
const DEFAULT_PALETTE = ['#ffe9b0', '#c9d4ff'];

export class AmbientPedestrian {
  constructor(x, y, rng, palette) {
    this.anchorX = x;
    this.anchorY = y;
    this.x = x;
    this.y = y;
    this.wanderRadius = 12 + rng() * 26;
    this.speed = 8 + rng() * 10;
    this.angle = rng() * Math.PI * 2;
    this.turnSpeed = (rng() - 0.5) * 0.7;
    this.walkClock = rng() * Math.PI * 2;
    const colors = palette && palette.length ? palette : DEFAULT_PALETTE;
    this.color = colors[Math.floor(rng() * colors.length)];
    this._rng = rng;
  }

  update(dt) {
    this.angle += this.turnSpeed * dt;
    this.walkClock += dt * 6;
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const dx = this.anchorX - nx;
    const dy = this.anchorY - ny;
    if (Math.hypot(dx, dy) > this.wanderRadius) {
      this.angle = Math.atan2(dy, dx) + (this._rng() - 0.5) * 0.6;
      return;
    }
    this.x = nx;
    this.y = ny;
  }
}

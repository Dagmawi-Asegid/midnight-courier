/**
 * Purely decorative crowd filler — walks back and forth along a short stretch
 * of sidewalk near a fixed anchor point (a club entrance, a stoop, a plaza
 * bench) so districts feel populated. Never collides with anything and is
 * cheap to update: no gameplay state, just a bobbing walk cycle, occasional
 * pauses, and a rare little step-out-and-back "crossing" detour for variety.
 */
const DEFAULT_PALETTE = ['#ffe9b0', '#c9d4ff'];
const PAUSE_CHANCE_PER_SEC = 0.12; // rolled only near the end of a walk leg
const CROSS_CHANCE_ON_PAUSE = 0.18;

export class AmbientPedestrian {
  constructor(x, y, rng, palette, axis = 'x') {
    this.anchorX = x;
    this.anchorY = y;
    this.x = x;
    this.y = y;
    this.axis = axis; // 'x': walk parallel to a n/s building edge; 'y': parallel to an e/w edge
    this.walkRange = 16 + rng() * 28;
    this.dir = rng() < 0.5 ? 1 : -1;
    this.speed = 8 + rng() * 10;
    this.walkClock = rng() * Math.PI * 2;
    this.state = 'walk';
    this.pauseTimer = rng() * 1.5;
    this.crossElapsed = 0;
    const colors = palette && palette.length ? palette : DEFAULT_PALETTE;
    this.color = colors[Math.floor(rng() * colors.length)];
    this._rng = rng;
  }

  update(dt) {
    if (this.state === 'pause') {
      this.walkClock += dt * 2;
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) {
        this.state = this._rng() < CROSS_CHANCE_ON_PAUSE ? 'cross' : 'walk';
        this.crossElapsed = 0;
      }
      return;
    }

    if (this.state === 'cross') {
      // A brief step toward the curb and back — reads as "checking the street" without
      // ever going far enough to actually reach traffic or the player.
      this.walkClock += dt * 4;
      this.crossElapsed += dt;
      const t = Math.min(1, this.crossElapsed / 1.4);
      const out = Math.sin(t * Math.PI) * 16;
      if (this.axis === 'x') {
        this.x = this.anchorX;
        this.y = this.anchorY + out;
      } else {
        this.y = this.anchorY;
        this.x = this.anchorX + out;
      }
      if (t >= 1) this.state = 'walk';
      return;
    }

    this.walkClock += dt * 6;
    const along = this.axis === 'x' ? this.x - this.anchorX : this.y - this.anchorY;
    const atEnd = Math.abs(along) >= this.walkRange;
    if (atEnd) this.dir = -Math.sign(along) || this.dir;
    const delta = this.dir * this.speed * dt;
    if (this.axis === 'x') this.x += delta;
    else this.y += delta;

    if (atEnd && this._rng() < PAUSE_CHANCE_PER_SEC) {
      this.state = 'pause';
      this.pauseTimer = 0.6 + this._rng() * 1.8;
    }
  }
}

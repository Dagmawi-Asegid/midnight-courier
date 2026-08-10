import { clamp } from '../utils/math.js';
import { BOOST_CONFIG } from '../engine/constants.js';

/**
 * Player-controlled courier bike. Uses vehicle-style controls: up/down
 * throttle & brake along the current heading, left/right steer, plus an
 * optional Shift boost that trades a depleting meter for burst speed.
 */
export class Player {
  constructor(x, y, stats) {
    this.x = x;
    this.y = y;
    this.heading = -Math.PI / 2; // facing up
    this.speed = 0;
    this.stats = stats;
    this.bumpFlash = 0; // seconds remaining of collision flash feedback
    this.carrying = null; // active package payload, set by DeliverySystem
    this.boostMeter = 1; // 0..1
    this.isBoosting = false;
  }

  setStats(stats) {
    this.stats = stats;
  }

  update(dt, input) {
    const { maxSpeed, acceleration, brakePower, friction, turnSpeed } = this.stats;

    const drainPerSecond = this.stats.boostDrainPerSecond ?? BOOST_CONFIG.drainPerSecond;
    const regenPerSecond = this.stats.boostRegenPerSecond ?? BOOST_CONFIG.regenPerSecond;
    this.isBoosting = !!(input.boost && input.up && this.boostMeter > 0);
    if (this.isBoosting) {
      this.boostMeter = clamp(this.boostMeter - drainPerSecond * dt, 0, 1);
    } else {
      this.boostMeter = clamp(this.boostMeter + regenPerSecond * dt, 0, 1);
    }
    const effMaxSpeed = this.isBoosting ? maxSpeed * BOOST_CONFIG.speedMultiplier : maxSpeed;
    const effAcceleration = this.isBoosting ? acceleration * BOOST_CONFIG.accelMultiplier : acceleration;

    if (input.up) {
      this.speed += effAcceleration * dt;
    } else if (input.down) {
      this.speed -= brakePower * dt;
    } else if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - friction * dt);
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + friction * dt);
    }
    this.speed = clamp(this.speed, -maxSpeed * 0.45, effMaxSpeed);

    // Steering authority scales with speed so the bike doesn't spin in place.
    const speedFactor = clamp(Math.abs(this.speed) / (maxSpeed * 0.4), 0.25, 1);
    const turnDir = (this.speed < 0 ? -1 : 1) * speedFactor;
    if (input.left) this.heading -= turnSpeed * dt * turnDir;
    if (input.right) this.heading += turnSpeed * dt * turnDir;

    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;

    if (this.bumpFlash > 0) this.bumpFlash = Math.max(0, this.bumpFlash - dt);
  }

  /** Called by the collision system when the bike hits something solid. */
  bump(pushX, pushY) {
    this.x += pushX;
    this.y += pushY;
    this.speed *= -0.35;
    this.bumpFlash = 0.35;
  }

  /** Called by world events (e.g. a collected shortcut) to top up the boost meter. */
  refillBoost() {
    this.boostMeter = 1;
  }
}

import { clamp } from '../utils/math.js';
import { BOOST_CONFIG } from '../engine/constants.js';

// Steering authority scales with speed so the bike doesn't spin in place, but the floor is
// high enough that even a near-stop turn is crisp — needed to thread narrow streets/alleys
// without the old 0.25 floor making low-speed steering feel like wading through mud.
const TURN_FACTOR_MIN = 0.42;
// How fast actual velocity conforms to the heading-aligned "desired" velocity. High values are
// effectively instant (straight-line riding, low-speed maneuvering); the low value only kicks
// in while carving a hard turn or stomping the brake at speed, producing a brief, controllable
// slide instead of the bike snapping onto its new heading like it's on rails.
const TRACTION_NORMAL = 22;
const TRACTION_SLIDING = 5;
const SLIDE_SPEED_RATIO = 0.45;
const SLIDE_MIN_SPEED = 20;
// Collision response: only the velocity component driving into the surface gets cancelled and
// bounced back (soft restitution, matching the old scalar knockback's feel), while the
// along-the-wall component just loses a little energy — so grazing a wall at an angle keeps
// most of your speed (skillful driving is rewarded) but a head-on hit stings.
const IMPACT_RESTITUTION = 0.35;
const WALL_SLIDE_DAMPING = 0.9;

/**
 * Player-controlled courier bike. Uses vehicle-style controls: up/down
 * throttle & brake along the current heading, left/right steer, plus an
 * optional Shift boost that trades a depleting meter for burst speed.
 *
 * Movement is driven by a real velocity vector (vx/vy) that's blended toward the
 * heading-aligned "throttle" speed each frame rather than snapping to it outright — that gap is
 * what produces drift under hard turns/braking and a believable bounce off collisions.
 * `speed` remains a plain signed scalar (forward speed along heading) for everything outside
 * this file that already reads it (HUD-adjacent checks, near-miss/checkpoint speed gates).
 */
export class Player {
  constructor(x, y, stats) {
    this.x = x;
    this.y = y;
    this.heading = -Math.PI / 2; // facing up
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.isDrifting = false;
    this.impactStrength = 0; // 0..1, set by bump(), consumed by consumeImpact()
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

    const speedRatio = Math.abs(this.speed) / maxSpeed;
    const speedFactor = clamp(speedRatio / 0.4, TURN_FACTOR_MIN, 1);
    const turnDir = (this.speed < 0 ? -1 : 1) * speedFactor;
    if (input.left) this.heading -= turnSpeed * dt * turnDir;
    if (input.right) this.heading += turnSpeed * dt * turnDir;

    const turningHard = (input.left || input.right) && speedRatio > SLIDE_SPEED_RATIO;
    const brakingHard = input.down && speedRatio > SLIDE_SPEED_RATIO;
    this.isDrifting = (turningHard || brakingHard) && Math.abs(this.speed) > SLIDE_MIN_SPEED;

    const desiredVX = Math.cos(this.heading) * this.speed;
    const desiredVY = Math.sin(this.heading) * this.speed;
    const traction = this.isDrifting ? TRACTION_SLIDING : TRACTION_NORMAL;
    const blend = clamp(traction * dt, 0, 1);
    this.vx += (desiredVX - this.vx) * blend;
    this.vy += (desiredVY - this.vy) * blend;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.bumpFlash > 0) this.bumpFlash = Math.max(0, this.bumpFlash - dt);
  }

  /** Called by the collision system when the bike hits something solid. `pushX/pushY` is the
   * separation vector needed to move the bike clear of the obstacle. */
  bump(pushX, pushY) {
    this.x += pushX;
    this.y += pushY;

    const len = Math.hypot(pushX, pushY) || 1;
    const nx = pushX / len;
    const ny = pushY / len;
    const vn = this.vx * nx + this.vy * ny; // velocity component along the push-out direction

    if (vn < 0) {
      // Moving into the surface: cancel that component and bounce a fraction of it back out.
      const newVn = -IMPACT_RESTITUTION * vn;
      this.vx += (newVn - vn) * nx;
      this.vy += (newVn - vn) * ny;
      this.impactStrength = Math.min(1, Math.max(this.impactStrength, Math.abs(vn) / (this.stats.maxSpeed || 200)));
    }
    // Scrub a little energy from the along-the-wall component too, so grinding a wall isn't free.
    const vnAfter = this.vx * nx + this.vy * ny;
    this.vx = nx * vnAfter + (this.vx - nx * vnAfter) * WALL_SLIDE_DAMPING;
    this.vy = ny * vnAfter + (this.vy - ny * vnAfter) * WALL_SLIDE_DAMPING;

    this.speed = this.vx * Math.cos(this.heading) + this.vy * Math.sin(this.heading);
    this.bumpFlash = 0.35;
  }

  /** One-shot read of this frame's worst collision strength (0..1), consumed by impact
   * shake/sound polish so a single hit doesn't retrigger every frame it's checked. */
  consumeImpact() {
    const impact = this.impactStrength;
    this.impactStrength = 0;
    return impact;
  }

  /** Called by world events (e.g. a collected shortcut) to top up the boost meter. */
  refillBoost() {
    this.boostMeter = 1;
  }
}

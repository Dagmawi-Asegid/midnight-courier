import { COMBO_CONFIG } from '../engine/constants.js';

/**
 * Tracks the delivery streak: consecutive on-time drop-offs raise a payout
 * multiplier. The streak decays if the player doesn't land another delivery
 * within the window, or resets outright on a failed/penalized delivery.
 * `perStackBonus` is added on top of the base per-stack rate by the Combo
 * Mastery upgrade, so a maxed-out courier earns noticeably more per streak.
 */
export class ComboSystem {
  constructor(perStackBonus = 0) {
    this.count = 0;
    this.timer = 0;
    this.multiplier = 1;
    this.perStack = COMBO_CONFIG.perStack + perStackBonus;
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer = Math.max(0, this.timer - dt);
      if (this.timer === 0) this._reset();
    }
  }

  registerSuccess() {
    this.count += 1;
    this.timer = COMBO_CONFIG.window;
    this.multiplier = 1 + Math.min(this.count, COMBO_CONFIG.maxStacks) * this.perStack;
    return this.multiplier;
  }

  registerFailure() {
    this._reset();
  }

  _reset() {
    this.count = 0;
    this.timer = 0;
    this.multiplier = 1;
  }
}

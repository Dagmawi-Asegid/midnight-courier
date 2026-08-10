const CAR_COLORS = ['#c94b4b', '#4b8cc9', '#e0e0e0', '#c9a84b', '#7a4bc9'];

/**
 * Simple NPC car that patrols a straight road lane and wraps around the
 * world when it drives off the edge. No pathfinding — just enough motion to
 * make the streets feel alive and give the player something to dodge.
 */
export class NPCVehicle {
  constructor({ axis, lanePos, start, speed, bound, colorSeed }) {
    this.axis = axis; // 'h' (moves along x) or 'v' (moves along y)
    this.lanePos = lanePos;
    this.pos = start;
    this.speed = speed; // signed: direction of travel
    this.bound = bound; // world extent along travel axis
    this.color = CAR_COLORS[colorSeed % CAR_COLORS.length];
    this.width = axis === 'h' ? 30 : 16;
    this.height = axis === 'h' ? 16 : 30;
    this.radius = 15;
    this.syncPosition();
  }

  syncPosition() {
    if (this.axis === 'h') {
      this.x = this.pos;
      this.y = this.lanePos;
    } else {
      this.x = this.lanePos;
      this.y = this.pos;
    }
  }

  update(dt) {
    this.pos += this.speed * dt;
    if (this.speed > 0 && this.pos > this.bound + 60) this.pos = -60;
    if (this.speed < 0 && this.pos < -60) this.pos = this.bound + 60;
    this.syncPosition();
  }

  get heading() {
    if (this.axis === 'h') return this.speed >= 0 ? 0 : Math.PI;
    return this.speed >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

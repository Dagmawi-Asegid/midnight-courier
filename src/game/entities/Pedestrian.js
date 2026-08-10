/**
 * A jaywalker spawned by the "pedestrians crossing" world event. Walks in a
 * straight line across a road and is removed by the event system once it's
 * well clear (or immediately once it startles the player).
 */
export class Pedestrian {
  constructor(originX, originY, crossesHorizontalRoad, laneIndex, speedScale = 1) {
    const lane = (laneIndex - 0.5) * 22;
    const speed = 24 * speedScale;
    if (crossesHorizontalRoad) {
      this.x = originX + lane;
      this.y = originY - 70;
      this.vx = 0;
      this.vy = speed;
    } else {
      this.x = originX - 70;
      this.y = originY + lane;
      this.vx = speed;
      this.vy = 0;
    }
    this.radius = 8;
    this.hit = false;
    this.walkClock = lane;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.walkClock += dt * 8;
  }
}

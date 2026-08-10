import { ROAD_WIDTH, VEHICLE_TYPES } from '../engine/constants.js';
import { getTrafficLightPhase } from '../engine/trafficLightPhase.js';
import { clamp } from '../utils/math.js';

const LEGACY_CAR_COLORS = ['#c94b4b', '#4b8cc9', '#e0e0e0', '#c9a84b', '#7a4bc9'];

const STOP_LOOKAHEAD = 140; // px before an intersection a vehicle starts reacting to its light
const STOP_LINE_OFFSET = ROAD_WIDTH / 2 + 26; // how far before the intersection center it stops
const FOLLOW_DISTANCE = 85; // px gap NPCs try to keep from whatever's ahead in their lane
const MIN_GAP = 26; // closer than this and they're fully stopped
const ACCEL = 90; // px/s^2 easing up toward cruise speed
const BRAKE = 230; // px/s^2 easing down when something's ahead — brakes harder than it accelerates

/**
 * NPC car that patrols a straight road lane and wraps around the world when it drives off
 * the edge. No pathfinding, but it does react to its immediate surroundings: speed eases
 * toward a per-type cruise speed, and drops toward zero when a red/yellow light or a slower
 * vehicle is ahead in the same lane — all cheap nearest-ahead distance checks, no simulation
 * of other traffic's intentions.
 */
export class NPCVehicle {
  constructor({ axis, lanePos, start, speed, bound, color, colorSeed, type = 'car', length, lightPhaseSeed }) {
    this.axis = axis; // 'h' (moves along x) or 'v' (moves along y)
    this.lanePos = lanePos;
    this.pos = start;
    this.cruiseSpeed = speed; // signed target speed
    this.speed = speed; // signed current speed, eases toward cruiseSpeed
    this.bound = bound; // world extent along travel axis
    this.type = type;
    this.color = color || LEGACY_CAR_COLORS[(colorSeed ?? 0) % LEGACY_CAR_COLORS.length];
    this.length = length || 30;
    // Local x is always "forward" once `heading` rotates the sprite into place, so the
    // long dimension goes on width regardless of travel axis — the earlier axis-conditional
    // version put the long side on height for 'v' vehicles, drawing them sideways to the road.
    this.width = this.length;
    this.height = 16;
    this.radius = 15;
    this.stopped = false;
    const def = VEHICLE_TYPES[type];
    this.lightBar = def?.lightBar || null;
    this.roofSign = !!def?.roofSign;
    this.lightPhaseSeed = lightPhaseSeed ?? 0;
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

  /** Distance to the stop line of the nearest red/yellow light ahead on this lane, or Infinity. */
  _lightStopDistance(city, time) {
    const dir = Math.sign(this.cruiseSpeed) || 1;
    let best = Infinity;
    for (const light of city.trafficLights) {
      const onLane =
        this.axis === 'h' ? Math.abs(light.y - this.lanePos) < ROAD_WIDTH * 0.6 : Math.abs(light.x - this.lanePos) < ROAD_WIDTH * 0.6;
      if (!onLane) continue;
      const lightPos = this.axis === 'h' ? light.x : light.y;
      const stopDist = (lightPos - this.pos) * dir - STOP_LINE_OFFSET;
      if (stopDist < -20 || stopDist > STOP_LOOKAHEAD) continue;
      if (getTrafficLightPhase(time, light) === 'green') continue;
      best = Math.min(best, Math.max(0, stopDist));
    }
    return best;
  }

  /** Distance to the nearest other vehicle directly ahead in this lane. Static hazards
   * (cones, potholes, parked cars…) are deliberately not checked here: they never move, and
   * a vehicle has no way to change lanes around one, so treating them like a followable
   * vehicle would let it queue up at minimum gap and freeze there permanently. Those hazards
   * stay a player-only dodge challenge; NPCs simply drive through them. */
  _aheadDistance(vehicleLists) {
    const dir = Math.sign(this.cruiseSpeed) || 1;
    let best = Infinity;

    if (vehicleLists) {
      for (const list of vehicleLists) {
        for (const other of list) {
          if (other === this || other.axis !== this.axis) continue;
          if (Math.abs(other.lanePos - this.lanePos) > 12) continue;
          const otherDir = Math.sign(other.cruiseSpeed ?? 1) || 1;
          if (otherDir !== dir) continue;
          const gap = (other.pos - this.pos) * dir - this.length * 0.5 - (other.length || 30) * 0.5;
          if (gap > 0 && gap < best) best = gap;
        }
      }
    }

    return best;
  }

  update(dt, context) {
    const cruiseMag = Math.abs(this.cruiseSpeed);
    let desiredMag = cruiseMag;

    if (context?.city) {
      const lightDist = this._lightStopDistance(context.city, context.time ?? 0);
      if (lightDist < STOP_LOOKAHEAD) {
        const eased = lightDist <= MIN_GAP ? 0 : cruiseMag * clamp((lightDist - MIN_GAP) / (STOP_LOOKAHEAD - MIN_GAP), 0, 1);
        desiredMag = Math.min(desiredMag, eased);
      }
    }

    const aheadDist = this._aheadDistance(context?.vehicleLists);
    if (aheadDist < FOLLOW_DISTANCE) {
      const eased = aheadDist <= MIN_GAP ? 0 : cruiseMag * clamp((aheadDist - MIN_GAP) / (FOLLOW_DISTANCE - MIN_GAP), 0, 1);
      desiredMag = Math.min(desiredMag, eased);
    }

    const dir = Math.sign(this.cruiseSpeed) || 1;
    const currentMag = Math.abs(this.speed);
    const rate = currentMag > desiredMag ? BRAKE : ACCEL;
    const nextMag =
      currentMag > desiredMag ? Math.max(desiredMag, currentMag - rate * dt) : Math.min(desiredMag, currentMag + rate * dt);
    this.speed = dir * nextMag;
    this.stopped = nextMag < 4;

    this.pos += this.speed * dt;
    if (dir > 0 && this.pos > this.bound + 60) this.pos = -60;
    if (dir < 0 && this.pos < -60) this.pos = this.bound + 60;
    this.syncPosition();
  }

  get heading() {
    const dir = Math.sign(this.cruiseSpeed) || 1;
    if (this.axis === 'h') return dir >= 0 ? 0 : Math.PI;
    return dir >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

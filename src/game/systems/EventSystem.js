import { EVENT_DEFS, EVENT_SPAWN_INTERVAL } from '../engine/constants.js';
import { Obstacle } from '../entities/Obstacle.js';
import { NPCVehicle } from '../entities/NPCVehicle.js';
import { Pedestrian } from '../entities/Pedestrian.js';
import { pick, range } from '../utils/random.js';
import { dist } from '../utils/math.js';

const TYPE_LIST = Object.values(EVENT_DEFS);
const WEIGHT_TOTAL = TYPE_LIST.reduce((sum, d) => sum + d.weight, 0);

function pickEventDef(rng) {
  let r = rng() * WEIGHT_TOTAL;
  for (const def of TYPE_LIST) {
    if (r < def.weight) return def;
    r -= def.weight;
  }
  return TYPE_LIST[0];
}

/**
 * Occasionally spawns one world event near the player at a time — a road
 * blockage, a burst of traffic, a bonus shortcut, a speed-trap checkpoint,
 * or jaywalking pedestrians — and cleans it up when its duration elapses.
 * Keeping only one event live at once keeps this cheap and easy to reason
 * about; the rest of the sim just merges its entity lists in for a frame.
 * `difficulty.eventIntervalMultiplier` shrinks the gap between events as the run
 * progresses (see engine/difficulty.js), so later nights feel busier and less calm.
 */
export class EventSystem {
  constructor(city, rng, difficulty = {}) {
    this.city = city;
    this.rng = rng;
    this.current = null;
    this.intervalMultiplier = difficulty.eventIntervalMultiplier ?? 1;
    this.spawnTimer = this._rollSpawnTimer();
    this.obstacles = [];
    this.vehicles = [];
    this.pedestrians = [];
    this.shortcut = null;
    this.checkpoint = null;
  }

  _rollSpawnTimer() {
    return range(this.rng, EVENT_SPAWN_INTERVAL[0], EVENT_SPAWN_INTERVAL[1]) * this.intervalMultiplier;
  }

  /** Finds a road intersection near the player so spawns are guaranteed drivable. */
  _nearIntersection(player, maxDist) {
    const { cols, rows } = this.city.roadCenters;
    const nearCols = cols.filter((c) => Math.abs(c - player.x) < maxDist);
    const nearRows = rows.filter((r) => Math.abs(r - player.y) < maxDist);
    const x = nearCols.length ? pick(this.rng, nearCols) : pick(this.rng, cols);
    const y = nearRows.length ? pick(this.rng, nearRows) : pick(this.rng, rows);
    return { x, y };
  }

  _spawnEvent(def, player) {
    this.current = { def, elapsed: 0, duration: range(this.rng, def.minDuration, def.maxDuration) };

    switch (def.id) {
      case 'roadBlocked':
      case 'construction': {
        const p = this._nearIntersection(player, 500);
        const type = def.id === 'construction' ? 'barrier' : 'cone';
        this.obstacles.push(new Obstacle(type, p.x + 16, p.y - 8), new Obstacle(type, p.x - 14, p.y + 18));
        break;
      }
      case 'traffic': {
        const p = this._nearIntersection(player, 500);
        for (let i = 0; i < 3; i++) {
          const horizontal = this.rng() < 0.5;
          this.vehicles.push(
            horizontal
              ? new NPCVehicle({
                  axis: 'h',
                  lanePos: p.y + (i - 1) * 20,
                  start: p.x - 300 + i * 90,
                  speed: range(this.rng, 90, 150),
                  bound: this.city.width,
                  colorSeed: i + 11,
                })
              : new NPCVehicle({
                  axis: 'v',
                  lanePos: p.x + (i - 1) * 20,
                  start: p.y - 300 + i * 90,
                  speed: range(this.rng, 90, 150),
                  bound: this.city.height,
                  colorSeed: i + 11,
                })
          );
        }
        break;
      }
      case 'shortcut': {
        const p = this._nearIntersection(player, 450);
        this.shortcut = { x: p.x, y: p.y, collected: false };
        break;
      }
      case 'checkpoint': {
        const p = this._nearIntersection(player, 450);
        this.checkpoint = { x: p.x, y: p.y, radius: 60, triggered: false };
        break;
      }
      case 'pedestrian': {
        const p = this._nearIntersection(player, 450);
        const crossesHorizontalRoad = this.rng() < 0.5;
        // Slight per-pedestrian pace variance so a pair crossing together doesn't move in lockstep.
        this.pedestrians.push(
          new Pedestrian(p.x, p.y, crossesHorizontalRoad, 0, 0.85 + this.rng() * 0.3),
          new Pedestrian(p.x, p.y, crossesHorizontalRoad, 1, 0.85 + this.rng() * 0.3)
        );
        break;
      }
      default:
        break;
    }
  }

  _clearEvent() {
    this.obstacles = [];
    this.vehicles = [];
    this.pedestrians = [];
    this.shortcut = null;
    this.checkpoint = null;
    this.current = null;
  }

  /** Advances the active event (if any) or counts down to the next one. Returns notifications. */
  update(dt, player) {
    const notifications = [];

    if (this.current) {
      const ev = this.current;
      ev.elapsed += dt;

      for (const p of this.pedestrians) p.update(dt);

      if (ev.def.id === 'checkpoint' && this.checkpoint && !this.checkpoint.triggered) {
        const d = dist(player.x, player.y, this.checkpoint.x, this.checkpoint.y);
        if (d < this.checkpoint.radius && Math.abs(player.speed) > player.stats.maxSpeed * 0.7) {
          this.checkpoint.triggered = true;
          notifications.push({ kind: 'penalty', seconds: 6, reason: 'Caught speeding through a checkpoint' });
        }
      }

      if (ev.def.id === 'shortcut' && this.shortcut && !this.shortcut.collected) {
        const d = dist(player.x, player.y, this.shortcut.x, this.shortcut.y);
        if (d < 30) {
          this.shortcut.collected = true;
          notifications.push({ kind: 'boostRefill' });
        }
      }

      if (ev.def.id === 'pedestrian') {
        for (const p of this.pedestrians) {
          if (!p.hit && dist(player.x, player.y, p.x, p.y) < p.radius + player.stats.radius) {
            p.hit = true;
            notifications.push({ kind: 'penalty', seconds: 3, reason: 'Startled a pedestrian', pedestrian: p });
          }
        }
      }

      const doneEarly =
        (ev.def.id === 'checkpoint' && this.checkpoint?.triggered) ||
        (ev.def.id === 'shortcut' && this.shortcut?.collected);

      if (ev.elapsed >= ev.duration || doneEarly) {
        notifications.push({ kind: 'ended', def: ev.def });
        this._clearEvent();
        this.spawnTimer = this._rollSpawnTimer();
      }
    } else {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const def = pickEventDef(this.rng);
        this._spawnEvent(def, player);
        notifications.push({ kind: 'started', def });
      }
    }

    return notifications;
  }
}

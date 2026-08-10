import { Camera } from './Camera.js';
import { InputManager } from './InputManager.js';
import { AMBIENT_PEDESTRIAN_MAX, CELL_SIZE, DISTRICTS, NIGHT_BASE_DURATION } from './constants.js';
import { Player } from '../entities/Player.js';
import { AmbientPedestrian } from '../entities/AmbientPedestrian.js';
import { City } from '../world/City.js';
import { drawCity } from '../world/CityRenderer.js';
import {
  drawAmbientPedestrians,
  drawDeliveryMarker,
  drawEventZones,
  drawNPCVehicles,
  drawObstacles,
  drawPedestrians,
  drawPlayer,
} from '../world/EntityRenderer.js';
import { DeliverySystem } from '../systems/DeliverySystem.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { EventSystem } from '../systems/EventSystem.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';
import { resolvePlayerCollisions } from '../systems/CollisionSystem.js';
import { spawnObstacles, spawnTraffic } from '../systems/TrafficSystem.js';
import { createRng } from '../utils/random.js';
import { dist } from '../utils/math.js';

const HUD_UPDATE_INTERVAL = 0.08;

/**
 * Owns the full simulation for a single night: world, player, traffic,
 * deliveries, timer and rendering. Framework-agnostic — React only talks to
 * it through the constructor config and the callbacks it invokes.
 */
export class GameEngine {
  constructor(canvas, { citySeed, nightSeed, stats, nightDuration, onHudUpdate, onNightEnd, onEvent }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHudUpdate = onHudUpdate;
    this.onNightEnd = onNightEnd;
    this.onEvent = onEvent;

    this.city = new City(citySeed);
    this.rng = createRng(nightSeed);
    const spawn = this._findSpawnPoint();
    this.player = new Player(spawn.x, spawn.y, stats);
    this.deliverySystem = new DeliverySystem(this.city, this.rng, stats.interactRadius);
    this.combo = new ComboSystem(stats.comboPerStackBonus);
    this.events = new EventSystem(this.city, this.rng);
    this.effects = new EffectsSystem();
    this.npcVehicles = spawnTraffic(this.city, this.rng, 14);
    this.obstacles = spawnObstacles(this.city, this.rng, 16).concat(this.city.parkedVehicles);
    this.ambientPedestrians = this._spawnAmbientPedestrians();
    this.camera = new Camera(this.city.width, this.city.height);
    this.input = new InputManager(window);

    this.timeRemaining = nightDuration ?? NIGHT_BASE_DURATION;
    this.money = 0;
    this.deliveriesCompleted = 0;
    this.running = false;
    this.time = 0;
    this._hudAccumulator = 0;
    this._shakeMag = 0;
    this._rafId = null;
    this._lastTs = null;

    this._loop = this._loop.bind(this);
    this._resize = this._resize.bind(this);
  }

  /** Picks a guaranteed-drivable spawn point at a road intersection near the city center. */
  _findSpawnPoint() {
    const { cols, rows } = this.city.roadCenters;
    const midCol = cols[Math.floor(cols.length / 2)];
    const midRow = rows[Math.floor(rows.length / 2)];
    return { x: midCol, y: midRow };
  }

  /** Instantiates decorative crowd pedestrians from the city's anchor points, capped for performance. */
  _spawnAmbientPedestrians() {
    const anchors = this.city.ambientAnchors;
    let chosen = anchors;
    if (anchors.length > AMBIENT_PEDESTRIAN_MAX) {
      const indices = anchors.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      chosen = indices.slice(0, AMBIENT_PEDESTRIAN_MAX).map((i) => anchors[i]);
    }
    return chosen.map((a) => new AmbientPedestrian(a.x, a.y, this.rng, DISTRICTS[a.district]?.pedestrianPalette));
  }

  /** Which district the player is currently standing in — also where a future audio manager
   * would hook in to switch each district's `musicTheme` background track. */
  _currentDistrict() {
    const cx = Math.floor(this.player.x / CELL_SIZE);
    const cy = Math.floor(this.player.y / CELL_SIZE);
    const district = DISTRICTS[this.city.districtAt(cx, cy)];
    return { id: district.id, label: district.label, musicTheme: district.musicTheme };
  }

  start() {
    this.input.attach();
    window.addEventListener('resize', this._resize);
    this._resize();
    this.running = true;
    this._lastTs = performance.now();
    this._rafId = requestAnimationFrame(this._loop);
    this._pushHud(true);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.input.detach();
    window.removeEventListener('resize', this._resize);
  }

  /** Nudges the camera with a brief decaying shake for high-impact moments. */
  triggerShake(magnitude) {
    this._shakeMag = Math.max(this._shakeMag, magnitude);
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(w, h);
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
    this._lastTs = ts;
    this.time += dt;

    this._update(dt);
    this._draw();

    if (this.timeRemaining <= 0) {
      this._endNight();
      return;
    }
    this._rafId = requestAnimationFrame(this._loop);
  }

  _update(dt) {
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.combo.update(dt);
    this._shakeMag = Math.max(0, this._shakeMag - dt * 50);

    this.player.update(dt, this.input.state);
    for (const v of this.npcVehicles) v.update(dt);
    for (const p of this.ambientPedestrians) p.update(dt);
    resolvePlayerCollisions(this.player, this.city, this.obstacles, this.npcVehicles, this.events.obstacles, this.events.vehicles);

    this._updateWorldEvents(dt);
    this._updateDelivery(dt);

    this.effects.update(dt);
    this.camera.follow(this.player.x, this.player.y, dt);

    this._hudAccumulator += dt;
    if (this._hudAccumulator >= HUD_UPDATE_INTERVAL) {
      this._hudAccumulator = 0;
      this._pushHud(false);
    }
  }

  _updateWorldEvents(dt) {
    const notifications = this.events.update(dt, this.player);
    for (const n of notifications) {
      if (n.kind === 'penalty') {
        this.timeRemaining = Math.max(0, this.timeRemaining - n.seconds);
        this.combo.registerFailure();
        this.triggerShake(n.pedestrian ? 5 : 8);
        if (n.pedestrian) {
          const dx = this.player.x - n.pedestrian.x;
          const dy = this.player.y - n.pedestrian.y;
          const d = Math.hypot(dx, dy) || 1;
          this.player.bump((dx / d) * 6, (dy / d) * 6);
        }
        this.effects.spawnText(this.player.x, this.player.y - 20, `-${n.seconds}s`, '#ff6a6a');
        this.onEvent?.({ type: 'penalty', seconds: n.seconds, reason: n.reason });
      } else if (n.kind === 'boostRefill') {
        this.player.refillBoost();
        this.effects.spawnText(this.player.x, this.player.y - 20, 'BOOST FULL', '#7dfcff');
        this.onEvent?.({ type: 'boostRefill' });
      } else if (n.kind === 'started') {
        this.onEvent?.({ type: 'worldEvent', phase: 'start', def: n.def });
      } else if (n.kind === 'ended') {
        this.onEvent?.({ type: 'worldEvent', phase: 'end', def: n.def });
      }
    }
  }

  _updateDelivery(dt) {
    const interactPressed = this.input.consumeInteract();
    const event = this.deliverySystem.update(dt, this.player, interactPressed);
    if (!event) return;

    if (event.type === 'accepted') {
      this.player.carrying = true;
      this.effects.spawnRing(event.order.pickup.x, event.order.pickup.y, '#ffd23f');
      this.onEvent?.({ type: 'accepted', order: event.order });
    } else if (event.type === 'delivered') {
      this.player.carrying = null;
      const comboMultiplier = this.combo.registerSuccess();
      const rewardMultiplier = this.player.stats.rewardMultiplier || 1;
      const reward = Math.round(event.subtotal * comboMultiplier * rewardMultiplier);
      this.money += reward;
      this.deliveriesCompleted += 1;
      this.effects.spawnRing(event.order.dropoff.x, event.order.dropoff.y, event.order.type.color);
      this.effects.spawnText(event.order.dropoff.x, event.order.dropoff.y - 20, `+$${reward}`, '#9dffb0');
      if (this.combo.count > 1) {
        this.effects.spawnText(event.order.dropoff.x, event.order.dropoff.y - 40, `COMBO x${this.combo.count}`, '#ffd23f');
      }
      this.onEvent?.({
        type: 'delivered',
        reward,
        order: event.order,
        comboMultiplier,
        comboCount: this.combo.count,
      });
    } else if (event.type === 'failed') {
      this.combo.registerFailure();
      this.triggerShake(6);
      this.effects.spawnText(event.order.dropoff.x, event.order.dropoff.y - 20, 'MISSED', '#ff6a6a');
      this.onEvent?.({ type: 'missed', order: event.order, potential: event.order.potentialPay });
    }
  }

  _districtLabelAt(point) {
    const cx = Math.floor(point.x / CELL_SIZE);
    const cy = Math.floor(point.y / CELL_SIZE);
    return DISTRICTS[this.city.districtAt(cx, cy)].label;
  }

  _computeNav() {
    const order = this.deliverySystem.order;
    if (!order) return null;
    const target = this.deliverySystem.phase === 'toPickup' ? order.pickup : order.dropoff;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    return {
      kind: this.deliverySystem.phase === 'toPickup' ? 'pickup' : 'dropoff',
      bearing: Math.atan2(dy, dx),
      distance: dist(this.player.x, this.player.y, target.x, target.y),
      pickupDistrict: this._districtLabelAt(order.pickup),
      dropoffDistrict: this._districtLabelAt(order.dropoff),
    };
  }

  /** Nearest undiscovered-looking shortcut within the Shortcut Radar upgrade's radius, or null. */
  _computeShortcutPing() {
    const radius = this.player.stats.shortcutDetectionRadius || 0;
    if (radius <= 0 || this.city.alleys.length === 0) return null;

    let bestDist = Infinity;
    let bestX = 0;
    let bestY = 0;
    for (const alley of this.city.alleys) {
      const ax = alley.x + alley.w / 2;
      const ay = alley.y + alley.h / 2;
      const d = dist(this.player.x, this.player.y, ax, ay);
      if (d < bestDist) {
        bestDist = d;
        bestX = ax;
        bestY = ay;
      }
    }
    if (bestDist > radius) return null;
    return {
      bearing: Math.atan2(bestY - this.player.y, bestX - this.player.x),
      distance: bestDist,
    };
  }

  _pushHud(force) {
    if (!this.onHudUpdate) return;
    const order = this.deliverySystem.order;
    this.onHudUpdate({
      timeRemaining: this.timeRemaining,
      money: this.money,
      deliveriesCompleted: this.deliveriesCompleted,
      phase: this.deliverySystem.phase,
      carrying: !!this.player.carrying,
      order: order && {
        type: order.type,
        potentialPay: order.potentialPay,
        timeLimit: order.timeLimit,
        timeRemaining: order.timeRemaining,
      },
      nav: this._computeNav(),
      navPrecision: this.player.stats.navPrecision || 0,
      mapInfoLevel: this.player.stats.mapInfoLevel || 0,
      shortcutPing: this._computeShortcutPing(),
      combo: { count: this.combo.count, multiplier: this.combo.multiplier },
      boost: { meter: this.player.boostMeter, isBoosting: this.player.isBoosting },
      district: this._currentDistrict(),
      force,
    });
  }

  _endNight() {
    this.running = false;
    this.onNightEnd?.({
      money: this.money,
      deliveriesCompleted: this.deliveriesCompleted,
    });
  }

  _draw() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.camera.viewWidth, this.camera.viewHeight);
    const shakeX = this._shakeMag > 0.05 ? (Math.random() - 0.5) * this._shakeMag : 0;
    const shakeY = this._shakeMag > 0.05 ? (Math.random() - 0.5) * this._shakeMag : 0;
    ctx.translate(Math.round(-this.camera.x + shakeX), Math.round(-this.camera.y + shakeY));

    drawCity(ctx, this.city, this.camera, this.time);
    drawDeliveryMarker(ctx, this.deliverySystem, this.time);
    drawEventZones(ctx, this.events, this.time);
    drawAmbientPedestrians(ctx, this.ambientPedestrians, this.camera);
    drawObstacles(ctx, this.obstacles, this.camera);
    drawObstacles(ctx, this.events.obstacles, this.camera);
    drawPedestrians(ctx, this.events.pedestrians, this.camera);
    drawNPCVehicles(ctx, this.npcVehicles, this.camera);
    drawNPCVehicles(ctx, this.events.vehicles, this.camera);
    drawPlayer(ctx, this.player);
    this.effects.draw(ctx);

    ctx.restore();
    this._drawVignette();
  }

  _drawVignette() {
    const { ctx, camera } = this;
    const gradient = ctx.createRadialGradient(
      camera.viewWidth / 2,
      camera.viewHeight / 2,
      camera.viewHeight * 0.35,
      camera.viewWidth / 2,
      camera.viewHeight / 2,
      camera.viewHeight * 0.85
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, camera.viewWidth, camera.viewHeight);
  }
}

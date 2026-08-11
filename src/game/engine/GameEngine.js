import { Camera } from './Camera.js';
import { InputManager } from './InputManager.js';
import { AMBIENT_PEDESTRIAN_MAX, CELL_SIZE, DISTRICTS, NIGHT_BASE_DURATION } from './constants.js';
import { getDifficulty } from './difficulty.js';
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
  drawTimePickups,
} from '../world/EntityRenderer.js';
import { AUTO_SELECT_TIMEOUT, DeliverySystem } from '../systems/DeliverySystem.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { EventSystem } from '../systems/EventSystem.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';
import { resolvePlayerCollisions } from '../systems/CollisionSystem.js';
import { spawnObstacles, spawnTimePickups, spawnTraffic } from '../systems/TrafficSystem.js';
import { SkidTrailSystem } from '../systems/SkidTrailSystem.js';
import { createRng } from '../utils/random.js';
import { clamp, dist } from '../utils/math.js';
import {
  playBoostSound,
  playImpactSound,
  playNearMissSound,
  playSkidSound,
  playTimeBonusSound,
} from '../utils/sound.js';

const HUD_UPDATE_INTERVAL = 0.08;
const NEAR_MISS_BAND = 24; // px beyond the actual collision radius that counts as "close"
const NEAR_MISS_MIN_SPEED = 60; // px/s — only credit a near miss if the player was actually moving
const BOOST_ZOOM = 1.045; // subtle push-in while boosting — noticeable without disorienting
const ZOOM_LERP = 6; // per-second closing rate toward the target zoom
const SKID_SOUND_COOLDOWN = 0.35; // don't retrigger the screech every single drifting frame
const IMPACT_SOUND_THRESHOLD = 0.12; // ignore near-zero grazes so only real hits make noise

/**
 * Owns the full simulation for a single night: world, player, traffic,
 * deliveries, timer and rendering. Framework-agnostic — React only talks to
 * it through the constructor config and the callbacks it invokes.
 */
export class GameEngine {
  constructor(
    canvas,
    { citySeed, nightSeed, stats, nightDuration, difficulty, settings, onHudUpdate, onNightEnd, onEvent }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHudUpdate = onHudUpdate;
    this.onNightEnd = onNightEnd;
    this.onEvent = onEvent;
    this.difficulty = difficulty ?? getDifficulty(1);

    // Player preferences (graphics/accessibility/camera feel) — applied once at construction.
    // Settings changed mid-night take effect on the next night/restart, except camera
    // sensitivity which GameCanvas pushes live onto `this.camera.sensitivity`.
    const graphics = settings?.graphics ?? {};
    const accessibility = settings?.accessibility ?? {};
    this.effectsEnabled = graphics.effects ?? true;
    this.shadowsEnabled = graphics.shadows ?? true;
    this.reducedShakeFactor = accessibility.reducedShake ? 0.2 : 1;
    const qualityDensity = { low: 0.5, medium: 0.75, high: 1 }[graphics.quality] ?? 1;

    this.city = new City(citySeed);
    this.rng = createRng(nightSeed);
    const spawn = this._findSpawnPoint();
    this.player = new Player(spawn.x, spawn.y, stats);
    this.deliverySystem = new DeliverySystem(this.city, this.rng, stats.interactRadius, this.difficulty);
    this.combo = new ComboSystem(stats.comboPerStackBonus);
    this.events = new EventSystem(this.city, this.rng, this.difficulty);
    this.effects = new EffectsSystem();
    this.npcVehicles = spawnTraffic(this.city, this.rng, this.difficulty.trafficCount);
    this.obstacles = spawnObstacles(this.city, this.rng, this.difficulty.obstacleCount).concat(this.city.parkedVehicles);
    this.timePickups = spawnTimePickups(
      this.city,
      this.rng,
      this.difficulty.timePickupCount,
      this.difficulty.timeRefillSeconds
    );
    this.ambientPedestrians = this._spawnAmbientPedestrians(qualityDensity);
    this.skidTrail = new SkidTrailSystem();
    this.camera = new Camera(this.city.width, this.city.height);
    this.camera.sensitivity = settings?.gameplay?.cameraSensitivity ?? 1;
    this.input = new InputManager(window);

    this.timeRemaining = nightDuration ?? NIGHT_BASE_DURATION;
    this.money = 0;
    this.deliveriesCompleted = 0;
    this.deliveriesFailed = 0;
    this.bestCombo = 0;
    this.distanceTraveled = 0;
    // Lifetime-achievement tracking for this level only — aggregated into career stats by the
    // reducer once the level ends (see achievements.js).
    this._maxSpeedThisNight = 0;
    this._shortcutsThisNight = 0;
    this._longestDeliveryMeters = 0;
    this._tookDamageThisNight = false;
    this.running = false;
    this.paused = false;
    this.photoMode = false;
    this._photoPanVX = 0;
    this._photoPanVY = 0;
    this.time = 0;
    this._hudAccumulator = 0;
    this._shakeMag = 0;
    this._wasBoosting = false;
    this._skidCooldown = 0;
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

  /** Instantiates decorative crowd pedestrians from the city's anchor points, capped for
   * performance — the cap itself shrinks further under a lower Graphics Quality setting. */
  _spawnAmbientPedestrians(densityScale = 1) {
    const anchors = this.city.ambientAnchors;
    const cap = Math.round(AMBIENT_PEDESTRIAN_MAX * densityScale);
    let chosen = anchors;
    if (anchors.length > cap) {
      const indices = anchors.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      chosen = indices.slice(0, cap).map((i) => anchors[i]);
    }
    return chosen.map((a) => new AmbientPedestrian(a.x, a.y, this.rng, DISTRICTS[a.district]?.pedestrianPalette, a.axis));
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

  /** Nudges the camera with a brief decaying shake for high-impact moments. Scaled down (not
   * eliminated) by the Reduced Screen Shake accessibility setting, so impacts still register. */
  triggerShake(magnitude) {
    this._shakeMag = Math.max(this._shakeMag, magnitude * this.reducedShakeFactor);
  }

  /** Freezes simulation (timer, physics, AI) while still rendering the last frame — the pause
   * menu overlays on top rather than the screen going blank. */
  pause() {
    this.paused = true;
  }

  /** Resumes simulation. Resetting `_lastTs` here (rather than letting the next `_loop` tick
   * compute a huge elapsed-since-pause dt) is what keeps the game from "catching up" with a
   * lurch — the frame right after resuming behaves like any other frame. */
  resume() {
    this.paused = false;
    this._lastTs = performance.now();
  }

  /** Photo mode: the world stays frozen (same `paused` mechanism as the pause menu — timer,
   * physics and AI all stop) but WASD/arrows are repurposed to freely pan the camera instead of
   * driving, so the player can compose a shot of a frozen moment from any angle. Must be called
   * while already paused; entering/exiting doesn't itself change the paused state so it composes
   * cleanly with the pause menu (open pause → photo mode → back to pause → resume). */
  enterPhotoMode() {
    this.photoMode = true;
    this._photoPanVX = 0;
    this._photoPanVY = 0;
  }

  exitPhotoMode() {
    this.photoMode = false;
  }

  /** Multiplicative zoom step (e.g. from a mouse wheel), clamped to a sane cinematic range. */
  adjustPhotoZoom(factor) {
    this.camera.zoom = clamp(this.camera.zoom * factor, 0.4, 2.5);
  }

  /** Smoothed free-pan camera movement for photo mode — eased acceleration toward the target
   * direction (rather than snapping straight to full speed) so panning reads as deliberate
   * camera-operator movement instead of a rigid cursor drag. Holding boost pans faster. */
  _updatePhotoCamera(dt) {
    const { state } = this.input;
    const panSpeed = state.boost ? 900 : 380;
    let dx = 0;
    let dy = 0;
    if (state.left) dx -= 1;
    if (state.right) dx += 1;
    if (state.up) dy -= 1;
    if (state.down) dy += 1;
    const len = Math.hypot(dx, dy) || 1;
    const targetVX = (dx / len) * panSpeed;
    const targetVY = (dy / len) * panSpeed;
    const ease = clamp(6 * dt, 0, 1);
    this._photoPanVX += (targetVX - this._photoPanVX) * ease;
    this._photoPanVY += (targetVY - this._photoPanVY) * ease;

    const maxX = Math.max(0, this.camera.worldWidth - this.camera.viewWidth);
    const maxY = Math.max(0, this.camera.worldHeight - this.camera.viewHeight);
    this.camera.x = clamp(this.camera.x + this._photoPanVX * dt, 0, maxX);
    this.camera.y = clamp(this.camera.y + this._photoPanVY * dt, 0, maxY);
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
    this._vignetteGradient = null; // stale after a resize — rebuilt lazily on next draw
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
    this._lastTs = ts;

    if (!this.paused) {
      this.time += dt;
      this._update(dt);
    } else if (this.photoMode) {
      this._updatePhotoCamera(dt);
    }
    this._draw();

    if (!this.paused && this.timeRemaining <= 0) {
      this._endNight();
      return;
    }
    this._rafId = requestAnimationFrame(this._loop);
  }

  _update(dt) {
    const prevX = this.player.x;
    const prevY = this.player.y;

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.combo.update(dt);
    this._shakeMag = Math.max(0, this._shakeMag - dt * 50);

    this.player.update(dt, this.input.state);
    this._maxSpeedThisNight = Math.max(this._maxSpeedThisNight, Math.abs(this.player.speed));

    if (this.player.isBoosting && !this._wasBoosting) playBoostSound();
    this._wasBoosting = this.player.isBoosting;
    const targetZoom = this.player.isBoosting ? BOOST_ZOOM : 1;
    this.camera.zoom += (targetZoom - this.camera.zoom) * clamp(ZOOM_LERP * dt, 0, 1);

    if (this.player.isDrifting) {
      if (this.effectsEnabled) {
        const perpX = -Math.sin(this.player.heading) * 4;
        const perpY = Math.cos(this.player.heading) * 4;
        this.skidTrail.addMark(prevX + perpX, prevY + perpY, this.player.x + perpX, this.player.y + perpY);
        this.skidTrail.addMark(prevX - perpX, prevY - perpY, this.player.x - perpX, this.player.y - perpY);
      }
      if (this._skidCooldown <= 0) {
        playSkidSound();
        this._skidCooldown = SKID_SOUND_COOLDOWN;
      }
    }
    this._skidCooldown = Math.max(0, this._skidCooldown - dt);
    if (this.effectsEnabled) this.skidTrail.update(dt);

    // Shared per-frame context so every vehicle's lightweight AI (stop for red lights, don't
    // rear-end the car ahead) can see the same world without each one re-deriving it.
    const vehicleContext = {
      city: this.city,
      time: this.time,
      vehicleLists: [this.npcVehicles, this.events.vehicles],
    };
    for (const v of this.npcVehicles) v.update(dt, vehicleContext);
    for (const v of this.events.vehicles) v.update(dt, vehicleContext);
    for (const p of this.ambientPedestrians) p.update(dt);
    resolvePlayerCollisions(this.player, this.city, this.obstacles, this.npcVehicles, this.events.obstacles, this.events.vehicles);

    const impact = this.player.consumeImpact();
    if (impact > IMPACT_SOUND_THRESHOLD) {
      playImpactSound(impact);
      this.triggerShake(2 + impact * 10);
      this._tookDamageThisNight = true;
    }
    this._updateNearMisses();
    this._updateTimePickups();

    this.distanceTraveled += dist(prevX, prevY, this.player.x, this.player.y);

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

  /** Rewards close, skillful dodges: if the player grazes just outside a vehicle's collision
   * radius without hitting it, that vehicle gets a one-shot "close call" cue. A per-vehicle
   * armed flag means it only fires once per approach — lingering in the band doesn't spam it,
   * and driving away and back in lets it trigger again. */
  _updateNearMisses() {
    if (Math.abs(this.player.speed) < NEAR_MISS_MIN_SPEED) return;
    const lists = [this.npcVehicles, this.events.vehicles];
    for (const list of lists) {
      for (const v of list) {
        const collideThreshold = this.player.stats.radius + v.radius;
        const closeThreshold = collideThreshold + NEAR_MISS_BAND;
        const d = dist(this.player.x, this.player.y, v.x, v.y);
        if (d >= closeThreshold) {
          v._nearMissArmed = true;
        } else if (d >= collideThreshold && v._nearMissArmed) {
          v._nearMissArmed = false;
          this._triggerNearMiss();
        }
      }
    }
  }

  _triggerNearMiss() {
    this.effects.spawnText(this.player.x, this.player.y - 24, 'CLOSE CALL', '#7dfcff');
    this.triggerShake(3);
    playNearMissSound();
    this.onEvent?.({ type: 'nearMiss' });
  }

  /** Cheap proximity check against the night's scattered time-refill pickups — a handful of
   * static points, so a plain per-frame loop is fine (same cost class as near-miss checks). */
  _updateTimePickups() {
    for (const p of this.timePickups) {
      if (p.collected) continue;
      const d = dist(this.player.x, this.player.y, p.x, p.y);
      if (d <= this.player.stats.radius + p.radius) {
        p.collected = true;
        this.timeRemaining += p.seconds;
        this.effects.spawnText(p.x, p.y - 18, `+${p.seconds}s`, '#7dff5c');
        this.effects.spawnRing(p.x, p.y, '#7dff5c');
        playTimeBonusSound();
        this.onEvent?.({ type: 'timeBonus', seconds: p.seconds });
      }
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
        this._shortcutsThisNight += 1;
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
      this.bestCombo = Math.max(this.bestCombo, this.combo.count);
      this._longestDeliveryMeters = Math.max(this._longestDeliveryMeters, event.order.distance / 8);
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
      this.deliveriesFailed += 1;
      this.combo.registerFailure();
      this.triggerShake(6);
      this.effects.spawnText(event.order.dropoff.x, event.order.dropoff.y - 20, 'MISSED', '#ff6a6a');
      this.onEvent?.({ type: 'missed', order: event.order, potential: event.order.potentialPay });
    } else if (event.type === 'autoSelected') {
      this.onEvent?.({ type: 'autoSelected', order: event.order });
    }
  }

  /** Called by the UI when the player picks a job from the delivery-selection panel. */
  selectDelivery(index) {
    this.deliverySystem.selectCandidate(index);
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

  /** Compact per-candidate summary for the delivery-selection panel — just what's needed to
   * weigh one job against another, not the full pickup/dropoff point objects. */
  _candidateSummaries() {
    return this.deliverySystem.candidates.map((c) => ({
      type: c.type,
      potentialPay: c.potentialPay,
      timeLimit: c.timeLimit,
      distanceMeters: Math.round(c.distance / 8),
      pickupDistrict: this._districtLabelAt(c.pickup),
      dropoffDistrict: this._districtLabelAt(c.dropoff),
    }));
  }

  _pushHud(force) {
    if (!this.onHudUpdate) return;
    const order = this.deliverySystem.order;
    const nav = this._computeNav();
    this.onHudUpdate({
      timeRemaining: this.timeRemaining,
      money: this.money,
      deliveriesCompleted: this.deliveriesCompleted,
      deliveryGoal: this.difficulty.deliveryGoal ?? null,
      speed: Math.round(Math.abs(this.player.speed)),
      phase: this.deliverySystem.phase,
      carrying: !!this.player.carrying,
      order: order && {
        type: order.type,
        potentialPay: order.potentialPay,
        timeLimit: order.timeLimit,
        timeRemaining: order.timeRemaining,
      },
      candidates: this.deliverySystem.phase === 'selecting' ? this._candidateSummaries() : null,
      selectionProgress: clamp(this.deliverySystem.selectionTimer / AUTO_SELECT_TIMEOUT, 0, 1),
      nav,
      navPrecision: this.player.stats.navPrecision || 0,
      mapInfoLevel: this.player.stats.mapInfoLevel || 0,
      shortcutPing: this._computeShortcutPing(),
      combo: { count: this.combo.count, multiplier: this.combo.multiplier },
      boost: { meter: this.player.boostMeter, isBoosting: this.player.isBoosting },
      district: this._currentDistrict(),
      minimap: {
        playerX: this.player.x,
        playerY: this.player.y,
        heading: this.player.heading,
        dest: nav && order ? { x: nav.kind === 'pickup' ? order.pickup.x : order.dropoff.x, y: nav.kind === 'pickup' ? order.pickup.y : order.dropoff.y, color: order.type.color } : null,
        shortcut: this.events.shortcut && !this.events.shortcut.collected ? this.events.shortcut : null,
      },
      force,
    });
  }

  _endNight() {
    this.running = false;
    this.onNightEnd?.({
      money: this.money,
      deliveriesCompleted: this.deliveriesCompleted,
      deliveriesFailed: this.deliveriesFailed,
      bestCombo: this.bestCombo,
      distanceTraveled: this.distanceTraveled,
      maxSpeedReached: Math.round(this._maxSpeedThisNight),
      shortcutsCollected: this._shortcutsThisNight,
      longestDeliveryMeters: Math.round(this._longestDeliveryMeters),
      tookDamage: this._tookDamageThisNight,
    });
  }

  _draw() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.camera.viewWidth, this.camera.viewHeight);
    const shakeX = this._shakeMag > 0.05 ? (Math.random() - 0.5) * this._shakeMag : 0;
    const shakeY = this._shakeMag > 0.05 ? (Math.random() - 0.5) * this._shakeMag : 0;
    if (this.camera.zoom !== 1) {
      ctx.translate(this.camera.viewWidth / 2, this.camera.viewHeight / 2);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.viewWidth / 2, -this.camera.viewHeight / 2);
    }
    ctx.translate(Math.round(-this.camera.x + shakeX), Math.round(-this.camera.y + shakeY));

    drawCity(ctx, this.city, this.camera, this.time);
    if (this.effectsEnabled) this.skidTrail.draw(ctx);
    drawTimePickups(ctx, this.timePickups, this.camera, this.time);
    drawDeliveryMarker(ctx, this.deliverySystem, this.time);
    drawEventZones(ctx, this.events, this.time);
    drawAmbientPedestrians(ctx, this.ambientPedestrians, this.camera);
    drawObstacles(ctx, this.obstacles, this.camera);
    drawObstacles(ctx, this.events.obstacles, this.camera);
    drawPedestrians(ctx, this.events.pedestrians, this.camera);
    drawNPCVehicles(ctx, this.npcVehicles, this.camera, this.time);
    drawNPCVehicles(ctx, this.events.vehicles, this.camera, this.time);
    drawPlayer(ctx, this.player, this.effectsEnabled);
    this.effects.draw(ctx);

    ctx.restore();
    if (this.shadowsEnabled) this._drawVignette();
  }

  /** The vignette shape only depends on viewport size, which rarely changes — cache the gradient
   * across frames instead of allocating a new CanvasGradient every single frame, and only rebuild
   * it (via `_resize`) when the viewport actually does change. */
  _drawVignette() {
    const { ctx, camera } = this;
    if (!this._vignetteGradient) {
      this._vignetteGradient = ctx.createRadialGradient(
        camera.viewWidth / 2,
        camera.viewHeight / 2,
        camera.viewHeight * 0.35,
        camera.viewWidth / 2,
        camera.viewHeight / 2,
        camera.viewHeight * 0.85
      );
      this._vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
      this._vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = this._vignetteGradient;
    ctx.fillRect(0, 0, camera.viewWidth, camera.viewHeight);
  }
}

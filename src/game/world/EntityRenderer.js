import { isVisible } from '../utils/viewport.js';

const PICKUP_COLOR = '#ffd23f';

function drawBeacon(ctx, point, color, time, active, opacity = 1) {
  const bob = Math.sin(time * 3 + point.pulse) * 4;
  const y = point.y + bob;

  ctx.save();
  ctx.globalAlpha = 0.85 * opacity;
  const beamGradient = ctx.createLinearGradient(point.x, y - 90, point.x, y);
  beamGradient.addColorStop(0, 'rgba(0,0,0,0)');
  beamGradient.addColorStop(1, color);
  ctx.fillStyle = beamGradient;
  ctx.fillRect(point.x - 3, y - 90, 6, 90);

  ctx.shadowColor = color;
  ctx.shadowBlur = 20 * opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (active) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = (0.4 + 0.2 * Math.sin(time * 4)) * opacity;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Draws both legs of the active order — pickup and destination — so the
 * player can see (and weigh) the whole job, with the current target
 * highlighted and the other one shown dim as a preview. */
export function drawDeliveryMarker(ctx, deliverySystem, time) {
  const { order, phase } = deliverySystem;
  if (!order) return;
  const pickupActive = phase === 'toPickup';
  drawBeacon(ctx, order.pickup, PICKUP_COLOR, time, pickupActive, pickupActive ? 1 : 0.35);
  drawBeacon(ctx, order.dropoff, order.type.color, time, !pickupActive, !pickupActive ? 1 : 0.35);
}

export function drawPedestrians(ctx, pedestrians, camera) {
  for (const p of pedestrians) {
    if (p.hit) continue;
    if (camera && !isVisible(camera, p.x, p.y, 20)) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(p.walkClock) * 2;
    ctx.fillStyle = '#22252f';
    ctx.fillRect(-3, bob + 3, 6, 9);
    ctx.fillStyle = '#ffe9b0';
    ctx.shadowColor = '#ffe9b0';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Decorative crowd filler outside clubs, plazas and stoops — cheap silhouettes with no shadow blur. */
export function drawAmbientPedestrians(ctx, pedestrians, camera) {
  for (const p of pedestrians) {
    if (!isVisible(camera, p.x, p.y, 20)) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(p.walkClock) * 2;
    ctx.fillStyle = '#20222b';
    ctx.fillRect(-3, bob + 3, 6, 8);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, bob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Draws the temporary zones from the current world event: a speed-trap
 * ring for checkpoints and a glowing pickup for shortcuts. */
export function drawEventZones(ctx, events, time) {
  if (events.checkpoint && !events.checkpoint.triggered) {
    const cp = events.checkpoint;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 5);
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (events.shortcut && !events.shortcut.collected) {
    const sc = events.shortcut;
    const pulse = 0.6 + 0.4 * Math.sin(time * 6);
    ctx.save();
    ctx.shadowColor = '#7dff5c';
    ctx.shadowBlur = 24 * pulse;
    ctx.fillStyle = '#c8ffb0';
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Green fuel-canister pickups scattered on the roads — ride through one for a +20s refill. */
export function drawTimePickups(ctx, pickups, camera, time) {
  for (const p of pickups) {
    if (p.collected) continue;
    if (camera && !isVisible(camera, p.x, p.y, 20)) continue;
    const pulse = 0.6 + 0.4 * Math.sin(time * 4 + p.pulseSeed);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#7dff5c';
    ctx.shadowBlur = 16 * pulse;
    ctx.fillStyle = '#1c2e1c';
    ctx.fillRect(-6, -9, 12, 18);
    ctx.fillStyle = '#7dff5c';
    ctx.fillRect(-5, -8, 10, 16);
    ctx.fillStyle = '#183018';
    ctx.fillRect(-3, -12, 6, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eaffe0';
    ctx.font = '700 8px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+20', 0, 3);
    ctx.restore();
  }
}

function drawParkedCar(ctx, o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.angle);
  const w = 30;
  const h = 15;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w, h);
  ctx.fillStyle = o.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(180, 210, 255, 0.25)';
  ctx.fillRect(-w * 0.15, -h / 2 + 1, w * 0.35, h - 2);
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(w / 2 - 3, -h / 2 - 1, 2, 2);
  ctx.fillRect(w / 2 - 3, h / 2 - 1, 2, 2);
  ctx.restore();
}

export function drawObstacles(ctx, obstacles, camera) {
  for (const o of obstacles) {
    if (camera && !isVisible(camera, o.x, o.y, 30)) continue;
    if (o.type === 'parkedCar') {
      drawParkedCar(ctx, o);
      continue;
    }
    ctx.save();
    ctx.fillStyle = o.color;
    if (o.type === 'pothole') {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, o.radius, o.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.type === 'dumpster' || o.type === 'crate') {
      ctx.fillRect(o.x - o.radius, o.y - o.radius * 0.8, o.radius * 2, o.radius * 1.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(o.x - o.radius, o.y - o.radius * 0.8, o.radius * 2, o.radius * 1.6);
    } else {
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Roof-mounted "TAXI" sign, drawn centered over the cab. */
function drawRoofSign(ctx, v) {
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-5, -v.height / 2 - 4, 10, 4);
  ctx.fillStyle = '#ffe9a8';
  ctx.shadowColor = '#ffe9a8';
  ctx.shadowBlur = 6;
  ctx.fillRect(-3.5, -v.height / 2 - 3, 7, 2);
  ctx.shadowBlur = 0;
}

/** Alternating red/blue (or red/white) light bar for police and ambulance, flashing
 * fast enough to read clearly but cheap enough to just be a time-keyed on/off swap. */
function drawLightBar(ctx, v, time) {
  const [colorA, colorB] = v.lightBar;
  const on = Math.floor((time + v.lightPhaseSeed) * 6) % 2 === 0;
  const color = on ? colorA : colorB;
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-6, -v.height / 2 - 4, 12, 4);
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.fillStyle = color;
  ctx.fillRect(on ? -5 : 0.5, -v.height / 2 - 3.5, 4.5, 3);
  ctx.shadowBlur = 0;
}

export function drawNPCVehicles(ctx, vehicles, camera, time = 0) {
  for (const v of vehicles) {
    if (camera && !isVisible(camera, v.x, v.y, 30)) continue;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.heading);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-v.width / 2 + 2, -v.height / 2 + 2, v.width, v.height);
    ctx.fillStyle = v.color;
    ctx.fillRect(-v.width / 2, -v.height / 2, v.width, v.height);

    if (v.type === 'delivery') {
      // Boxy cargo body: a slightly taller, paler panel over the rear two-thirds of the van.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-v.width / 2 + 2, -v.height / 2 - 1, v.width * 0.65, v.height + 2);
    }

    // Headlight glow at the front of the vehicle.
    ctx.shadowColor = '#fff7d6';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff7d6';
    ctx.fillRect(v.width / 2 - 3, -v.height / 2 + 1, 3, 3);
    ctx.fillRect(v.width / 2 - 3, v.height / 2 - 4, 3, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff4b4b';
    ctx.fillRect(-v.width / 2, -v.height / 2 + 1, 2, 2);
    ctx.fillRect(-v.width / 2, v.height / 2 - 3, 2, 2);

    if (v.lightBar) drawLightBar(ctx, v, time);
    else if (v.roofSign) drawRoofSign(ctx, v);

    ctx.restore();
  }
}

export function drawPlayer(ctx, player, effectsEnabled = true) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.heading);

  if (player.isBoosting && effectsEnabled) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#7dfcff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const len = 14 + i * 7;
      const offset = -6 + i * 5;
      ctx.beginPath();
      ctx.moveTo(-8, offset);
      ctx.lineTo(-8 - len, offset);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Headlight cone.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#d9f3ff';
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.lineTo(90, -32);
  ctx.lineTo(90, 32);
  ctx.lineTo(4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (player.bumpFlash > 0) {
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur = 24;
  } else if (player.isBoosting) {
    ctx.shadowColor = '#7dfcff';
    ctx.shadowBlur = 26;
  } else {
    ctx.shadowColor = '#5ad1ff';
    ctx.shadowBlur = 14;
  }

  ctx.fillStyle = player.bumpFlash > 0 ? '#ff8080' : '#e7f7ff';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -9);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 9);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0d14';
  ctx.beginPath();
  ctx.arc(-6, -7, 3.2, 0, Math.PI * 2);
  ctx.arc(-6, 7, 3.2, 0, Math.PI * 2);
  ctx.fill();

  if (player.carrying) {
    ctx.fillStyle = '#ffd23f';
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 10;
    ctx.fillRect(-4, -4, 8, 8);
  }
  ctx.restore();
}

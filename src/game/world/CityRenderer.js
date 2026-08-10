import { CELL_SIZE, DISTRICTS, ROAD_WIDTH } from '../engine/constants.js';
import { getTrafficLightPhase } from '../engine/trafficLightPhase.js';
import { CULL_MARGIN, isVisible } from '../utils/viewport.js';

/** Draws the asphalt grid, lane markings and curb lines. */
function drawRoads(ctx, city, camera) {
  ctx.fillStyle = '#1a1c24';
  ctx.fillRect(
    Math.max(0, camera.x - CULL_MARGIN),
    Math.max(0, camera.y - CULL_MARGIN),
    Math.min(city.width, camera.viewWidth + CULL_MARGIN * 2),
    Math.min(city.height, camera.viewHeight + CULL_MARGIN * 2)
  );

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);

  for (const colX of city.roadCenters.cols) {
    if (colX < camera.x - CULL_MARGIN || colX > camera.x + camera.viewWidth + CULL_MARGIN) continue;
    ctx.beginPath();
    ctx.moveTo(colX, Math.max(0, camera.y - CULL_MARGIN));
    ctx.lineTo(colX, Math.min(city.height, camera.y + camera.viewHeight + CULL_MARGIN));
    ctx.stroke();
  }
  for (const rowY of city.roadCenters.rows) {
    if (rowY < camera.y - CULL_MARGIN || rowY > camera.y + camera.viewHeight + CULL_MARGIN) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, camera.x - CULL_MARGIN), rowY);
    ctx.lineTo(Math.min(city.width, camera.x + camera.viewWidth + CULL_MARGIN), rowY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Subtle curb highlight along road edges for depth.
  ctx.strokeStyle = 'rgba(120, 140, 190, 0.12)';
  ctx.lineWidth = 1;
  for (const colX of city.roadCenters.cols) {
    if (colX < camera.x - CULL_MARGIN || colX > camera.x + camera.viewWidth + CULL_MARGIN) continue;
    ctx.beginPath();
    ctx.moveTo(colX - ROAD_WIDTH / 2, 0);
    ctx.lineTo(colX - ROAD_WIDTH / 2, city.height);
    ctx.moveTo(colX + ROAD_WIDTH / 2, 0);
    ctx.lineTo(colX + ROAD_WIDTH / 2, city.height);
    ctx.stroke();
  }
}

/** Low-alpha per-district color wash over the ground so each area reads with its own mood. */
function drawDistrictTint(ctx, city, camera) {
  const grid = city.districtGrid;
  for (let cy = 0; cy < grid.length; cy++) {
    const originY = cy * CELL_SIZE;
    if (originY + CELL_SIZE < camera.y - CULL_MARGIN || originY > camera.y + camera.viewHeight + CULL_MARGIN) continue;
    for (let cx = 0; cx < grid[cy].length; cx++) {
      const originX = cx * CELL_SIZE;
      if (originX + CELL_SIZE < camera.x - CULL_MARGIN || originX > camera.x + camera.viewWidth + CULL_MARGIN) continue;
      ctx.fillStyle = DISTRICTS[grid[cy][cx]].groundTint;
      ctx.fillRect(originX, originY, CELL_SIZE, CELL_SIZE);
    }
  }
}

function drawCrosswalkBand(ctx, centerX, centerY, axis, length) {
  const stripeCount = 5;
  const stripeThickness = 5;
  const gap = 6;
  const totalLen = stripeCount * stripeThickness + (stripeCount - 1) * gap;
  const start = -totalLen / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let i = 0; i < stripeCount; i++) {
    const offset = start + i * (stripeThickness + gap);
    if (axis === 'v') {
      ctx.fillRect(centerX - length / 2, centerY + offset, length, stripeThickness);
    } else {
      ctx.fillRect(centerX + offset, centerY - length / 2, stripeThickness, length);
    }
  }
}

/** Crosswalk stripes on all four approaches of every visible intersection. */
function drawIntersections(ctx, city, camera) {
  const crossLen = ROAD_WIDTH * 0.68;
  const setback = ROAD_WIDTH / 2 + 16;
  for (const colX of city.roadCenters.cols) {
    if (colX < camera.x - CULL_MARGIN || colX > camera.x + camera.viewWidth + CULL_MARGIN) continue;
    for (const rowY of city.roadCenters.rows) {
      if (rowY < camera.y - CULL_MARGIN || rowY > camera.y + camera.viewHeight + CULL_MARGIN) continue;
      drawCrosswalkBand(ctx, colX, rowY - setback, 'v', crossLen);
      drawCrosswalkBand(ctx, colX, rowY + setback, 'v', crossLen);
      drawCrosswalkBand(ctx, colX - setback, rowY, 'h', crossLen);
      drawCrosswalkBand(ctx, colX + setback, rowY, 'h', crossLen);
    }
  }
}

/** Fills each building's full lot as sidewalk concrete before the building itself is drawn on top. */
function drawSidewalks(ctx, city, camera) {
  const drawn = new Set();
  for (const b of city.buildings) {
    const key = `${b.blockX}-${b.blockY}`;
    if (drawn.has(key)) continue;
    if (!isVisible(camera, b.blockX + b.blockSize / 2, b.blockY + b.blockSize / 2, b.blockSize)) continue;
    drawn.add(key);
    ctx.fillStyle = '#22242c';
    ctx.fillRect(b.blockX, b.blockY, b.blockSize, b.blockSize);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.blockX + 1, b.blockY + 1, b.blockSize - 2, b.blockSize - 2);
  }
}

/** Lighter cyan-tinted pavement marking a shortcut cut through a block. */
function drawAlleys(ctx, city, camera, time) {
  for (const a of city.alleys) {
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    if (!isVisible(camera, cx, cy, Math.max(a.w, a.h))) continue;

    ctx.fillStyle = '#2a2d3a';
    ctx.fillRect(a.x, a.y, a.w, a.h);

    ctx.save();
    ctx.strokeStyle = 'rgba(125, 252, 255, 0.35)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (a.orientation === 'h') {
      ctx.moveTo(a.x, cy);
      ctx.lineTo(a.x + a.w, cy);
    } else {
      ctx.moveTo(cx, a.y);
      ctx.lineTo(cx, a.y + a.h);
    }
    ctx.stroke();
    ctx.restore();

    const pulse = 0.6 + 0.4 * Math.sin(time * 3 + a.x * 0.01);
    const mouths =
      a.orientation === 'h'
        ? [{ x: a.x + 8, y: cy }, { x: a.x + a.w - 8, y: cy }]
        : [{ x: cx, y: a.y + 8 }, { x: cx, y: a.y + a.h - 8 }];
    for (const m of mouths) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = '#7dfcff';
      ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = '#7dfcff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawVendorCart(ctx, d) {
  ctx.save();
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(d.x - 9, d.y - 4, 18, 8);
  ctx.fillStyle = '#e8a23f';
  ctx.fillRect(d.x - 10, d.y - 9, 20, 4);
  ctx.shadowColor = '#ffcf7d';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255, 207, 125, 0.6)';
  ctx.beginPath();
  ctx.arc(d.x, d.y - 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEntranceGlow(ctx, d, time) {
  const pulse = 0.55 + 0.25 * Math.sin(time * 2 + d.x * 0.02);
  ctx.save();
  const gradient = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, 30);
  gradient.addColorStop(0, `rgba(255, 200, 120, ${0.32 * pulse})`);
  gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(d.x, d.y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlazas(ctx, city, camera, time) {
  for (const p of city.plazas) {
    if (!isVisible(camera, p.x + p.size / 2, p.y + p.size / 2, p.size)) continue;
    ctx.fillStyle = '#101a14';
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.strokeStyle = 'rgba(120, 255, 170, 0.08)';
    ctx.lineWidth = 6;
    ctx.strokeRect(p.x + 3, p.y + 3, p.size - 6, p.size - 6);
  }

  for (const d of city.roadDecor) {
    if (!isVisible(camera, d.x, d.y, 30)) continue;
    if (d.type === 'tree') {
      ctx.fillStyle = '#0d2a18';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#12331d';
      ctx.beginPath();
      ctx.arc(d.x - 4, d.y - 4, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.type === 'fountain') {
      ctx.fillStyle = '#0c1622';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80, 200, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    } else if (d.type === 'vendorCart') {
      drawVendorCart(ctx, d);
    } else if (d.type === 'entranceGlow') {
      drawEntranceGlow(ctx, d, time);
    }
  }
}

function drawBuildingWindows(ctx, b, time) {
  for (const win of b.windows) {
    if (!win.lit) continue;
    const flicker = 0.75 + 0.25 * Math.sin(time * win.flickerSpeed + win.flickerSeed);
    const wx = b.x + win.cx * b.w;
    const wy = b.y + win.cy * b.h;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = win.color;
    ctx.fillRect(wx - 3, wy - 4, 6, 8);
    ctx.globalAlpha = 1;
  }
}

/** Small silhouette of a jebena (Ethiopian coffee pot) marking a coffee house's arched sign. */
function drawJebenaIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(15, 10, 6, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-1.5, -4, 3, 4.5);
  ctx.beginPath();
  ctx.arc(0, -4.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4.5, -1);
  ctx.lineTo(8.5, -3);
  ctx.lineTo(7, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Plain rectangle for club/office signage, or a rounded café-awning silhouette for `style: 'arch'`. */
function drawSignBody(ctx, sx, sy, w, h, style) {
  ctx.beginPath();
  if (style === 'arch') {
    const r = w / 2;
    ctx.moveTo(sx - r, sy + h / 2);
    ctx.lineTo(sx - r, sy);
    ctx.arc(sx, sy, r, Math.PI, 0, false);
    ctx.lineTo(sx + r, sy + h / 2);
    ctx.closePath();
  } else {
    ctx.rect(sx - w / 2, sy - h / 2, w, h);
  }
  ctx.fill();
}

function drawBuildingSigns(ctx, b, time) {
  if (!b.signs || b.signs.length === 0) return;
  for (const sign of b.signs) {
    const pulse = 0.8 + 0.2 * Math.sin(time * 1.6 + b.x * 0.01 + sign.side.charCodeAt(0));
    let sx = b.x + b.w / 2;
    let sy = b.y;
    if (sign.side === 's') sy = b.y + b.h;
    if (sign.side === 'e') {
      sx = b.x + b.w;
      sy = b.y + b.h / 2;
    }
    if (sign.side === 'w') {
      sx = b.x;
      sy = b.y + b.h / 2;
    }

    ctx.save();
    ctx.shadowColor = sign.color;
    ctx.shadowBlur = 22 * pulse;
    ctx.fillStyle = sign.color;
    ctx.globalAlpha = 0.9 * pulse;
    drawSignBody(ctx, sx, sy, 34, 12, sign.style);
    ctx.restore();

    if (sign.icon === 'jebena') {
      ctx.save();
      ctx.globalAlpha = pulse;
      drawJebenaIcon(ctx, sx, sy + 1);
      ctx.restore();
    }
  }
}

function drawBuildings(ctx, city, camera, time) {
  for (const b of city.buildings) {
    if (!isVisible(camera, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;

    // Ground shadow for a subtle sense of height.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);

    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

    if (b.roofDetail) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.15, b.w * 0.18, b.h * 0.12);
    }

    drawBuildingWindows(ctx, b, time);
    drawBuildingSigns(ctx, b, time);
  }
}

function drawStreetlights(ctx, city, camera) {
  for (const s of city.streetlights) {
    if (!isVisible(camera, s.x, s.y, 60)) continue;
    ctx.save();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(s.x - 2, s.y - 18, 4, 22);

    const gradient = ctx.createRadialGradient(s.x, s.y - 20, 2, s.x, s.y - 20, 46);
    gradient.addColorStop(0, 'rgba(255, 224, 150, 0.55)');
    gradient.addColorStop(1, 'rgba(255, 224, 150, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 20, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const PHASE_COLORS = { green: '#3fff6a', yellow: '#ffd23f', red: '#ff3b3b' };

/** Signal boxes at busier intersections — NPC traffic actually obeys these (see NPCVehicle). */
function drawTrafficLights(ctx, city, camera, time) {
  for (const t of city.trafficLights) {
    if (!isVisible(camera, t.x, t.y, 40)) continue;

    const color = PHASE_COLORS[getTrafficLightPhase(time, t)];
    const px = t.x + ROAD_WIDTH / 2 + 10;
    const py = t.y - ROAD_WIDTH / 2 - 10;

    ctx.save();
    ctx.fillStyle = '#0a0b10';
    ctx.fillRect(px - 2, py - 4, 4, 26);
    ctx.fillStyle = '#14161c';
    ctx.fillRect(px - 6, py - 20, 12, 18);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py - 11, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawCity(ctx, city, camera, time) {
  drawRoads(ctx, city, camera);
  drawDistrictTint(ctx, city, camera);
  drawIntersections(ctx, city, camera);
  drawSidewalks(ctx, city, camera);
  drawAlleys(ctx, city, camera, time);
  drawPlazas(ctx, city, camera, time);
  drawBuildings(ctx, city, camera, time);
  drawStreetlights(ctx, city, camera);
  drawTrafficLights(ctx, city, camera, time);
}

import { clamp } from '../utils/math.js';

function circleRectPush(cx, cy, radius, rect) {
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);

  // Circle center is fully inside the rect (closest point == center): push
  // out toward whichever edge is nearest instead of leaving it embedded.
  if (cx === closestX && cy === closestY) {
    const distLeft = cx - rect.x;
    const distRight = rect.x + rect.w - cx;
    const distTop = cy - rect.y;
    const distBottom = rect.y + rect.h - cy;
    const min = Math.min(distLeft, distRight, distTop, distBottom);
    if (min === distLeft) return { x: -(distLeft + radius), y: 0 };
    if (min === distRight) return { x: distRight + radius, y: 0 };
    if (min === distTop) return { x: 0, y: -(distTop + radius) };
    return { x: 0, y: distBottom + radius };
  }

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius) return null;
  const d = Math.sqrt(distSq);
  const overlap = radius - d;
  return { x: (dx / d) * overlap, y: (dy / d) * overlap };
}

function circleCirclePush(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const distSq = dx * dx + dy * dy;
  const minDist = ar + br;
  if (distSq >= minDist * minDist || distSq === 0) return null;
  const d = Math.sqrt(distSq);
  const overlap = minDist - d;
  return { x: (dx / d) * overlap, y: (dy / d) * overlap };
}

/**
 * Resolves player collisions against buildings, obstacles and NPC traffic.
 * Only checks entities within a small radius of the player for cheap
 * per-frame broad-phasing on a city with ~80 buildings. `extraObstacles`
 * and `extraVehicles` let temporary world-event hazards join the checks
 * without the caller having to allocate a merged array every frame.
 */
export function resolvePlayerCollisions(player, city, obstacles, npcVehicles, extraObstacles, extraVehicles) {
  const reach = 140;

  for (const b of city.buildings) {
    if (Math.abs(b.x + b.w / 2 - player.x) > reach + b.w / 2) continue;
    if (Math.abs(b.y + b.h / 2 - player.y) > reach + b.h / 2) continue;
    const push = circleRectPush(player.x, player.y, player.stats.radius, b);
    if (push) player.bump(push.x, push.y);
  }

  const checkObstacles = (list) => {
    for (const o of list) {
      if (Math.abs(o.x - player.x) > reach || Math.abs(o.y - player.y) > reach) continue;
      const push = circleCirclePush(player.x, player.y, player.stats.radius, o.x, o.y, o.radius);
      if (push) player.bump(push.x * 0.6, push.y * 0.6);
    }
  };
  checkObstacles(obstacles);
  if (extraObstacles && extraObstacles.length) checkObstacles(extraObstacles);

  const checkVehicles = (list) => {
    for (const v of list) {
      if (Math.abs(v.x - player.x) > reach || Math.abs(v.y - player.y) > reach) continue;
      const push = circleCirclePush(player.x, player.y, player.stats.radius, v.x, v.y, v.radius);
      if (push) player.bump(push.x, push.y);
    }
  };
  checkVehicles(npcVehicles);
  if (extraVehicles && extraVehicles.length) checkVehicles(extraVehicles);

  player.x = clamp(player.x, player.stats.radius, city.width - player.stats.radius);
  player.y = clamp(player.y, player.stats.radius, city.height - player.stats.radius);
}

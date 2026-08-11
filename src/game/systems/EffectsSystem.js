let effectId = 0;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Lightweight pool of transient floating-text and ring-pulse effects used
 * for game-feel moments (payouts, combos, misses). Cheap by design: plain
 * objects, filtered each frame, no allocations beyond the spawned item.
 */
export class EffectsSystem {
  constructor() {
    this.items = [];
  }

  spawnText(x, y, text, color = '#ffffff') {
    this.items.push({ id: effectId++, kind: 'text', x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  spawnRing(x, y, color = '#ffffff') {
    this.items.push({ id: effectId++, kind: 'ring', x, y, color, life: 0.5, maxLife: 0.5 });
  }

  update(dt) {
    if (this.items.length === 0) return;
    // In-place compaction instead of .filter() — avoids allocating a new array every frame
    // whenever effects are active (payouts/combos/misses can spawn several per second).
    let write = 0;
    for (let read = 0; read < this.items.length; read++) {
      const item = this.items[read];
      item.life -= dt;
      if (item.kind === 'text') item.y -= dt * 26;
      if (item.life > 0) this.items[write++] = item;
    }
    this.items.length = write;
  }

  draw(ctx) {
    for (const item of this.items) {
      const t = clamp01(item.life / item.maxLife);
      ctx.save();
      if (item.kind === 'text') {
        ctx.globalAlpha = t;
        ctx.font = '700 15px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = item.color;
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 10;
        ctx.fillText(item.text, item.x, item.y);
      } else {
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(item.x, item.y, (1 - t) * 40 + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

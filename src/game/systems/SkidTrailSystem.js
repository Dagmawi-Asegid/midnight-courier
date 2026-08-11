const MAX_MARKS = 160; // hard cap so a long drift can't grow the pool unbounded
const MARK_LIFE = 1.6;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Lightweight pool of fading tire-skid segments left behind while the player drifts or
 * brake-slides. Same style as EffectsSystem: plain objects, filtered each frame, capped so a
 * long drift can't grow the draw cost unbounded — oldest marks just drop off.
 */
export class SkidTrailSystem {
  constructor() {
    this.marks = [];
  }

  addMark(x1, y1, x2, y2) {
    this.marks.push({ x1, y1, x2, y2, life: MARK_LIFE });
    if (this.marks.length > MAX_MARKS) this.marks.shift();
  }

  update(dt) {
    if (this.marks.length === 0) return;
    // In-place compaction instead of .filter() — avoids allocating a new array every frame
    // while the player is drifting (which can add marks continuously for seconds at a time).
    let write = 0;
    for (let read = 0; read < this.marks.length; read++) {
      const m = this.marks[read];
      m.life -= dt;
      if (m.life > 0) this.marks[write++] = m;
    }
    this.marks.length = write;
  }

  draw(ctx) {
    if (this.marks.length === 0) return;
    ctx.save();
    ctx.strokeStyle = '#0a0a0d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const m of this.marks) {
      ctx.globalAlpha = clamp01(m.life / MARK_LIFE) * 0.45;
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

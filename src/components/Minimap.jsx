import { useEffect, useRef } from 'react';

const SIZE = 168;
const PADDING = 6;

/** Renders the city's static geometry (roads, plazas, shortcut alleys) once per city into an
 * offscreen canvas — this never changes during a night, so redrawing every HUD tick would be
 * pure waste. The visible canvas just blits this cached layer each update, then draws the
 * handful of things that actually move on top of it. */
function buildStaticLayer(city) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const scale = (SIZE - PADDING * 2) / Math.max(city.width, city.height);
  const toMap = (x, y) => ({ x: PADDING + x * scale, y: PADDING + y * scale });

  ctx.fillStyle = 'rgba(6, 8, 16, 0.9)';
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  for (const colX of city.roadCenters.cols) {
    const a = toMap(colX, 0);
    const b = toMap(colX, city.height);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const rowY of city.roadCenters.rows) {
    const a = toMap(0, rowY);
    const b = toMap(city.width, rowY);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(125, 252, 255, 0.35)';
  for (const plaza of city.plazas) {
    const p = toMap(plaza.x, plaza.y);
    const s = plaza.size * scale;
    ctx.fillRect(p.x, p.y, s, s);
  }

  ctx.fillStyle = 'rgba(125, 255, 92, 0.65)';
  for (const alley of city.alleys) {
    const p = toMap(alley.x + alley.w / 2, alley.y + alley.h / 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  return { canvas, scale };
}

/** Whole-city top-down radar: player position/heading, the active delivery target, road
 * layout and shortcut alleys. The city is small and fixed-size, so unlike a scrolling minimap
 * this always shows the entire map at once — no windowing/clamping logic needed. */
export default function Minimap({ city, minimap }) {
  const canvasRef = useRef(null);
  const staticRef = useRef(null);

  useEffect(() => {
    if (!city) return;
    staticRef.current = buildStaticLayer(city);
  }, [city]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = staticRef.current;
    if (!canvas || !layer || !minimap) return;
    const ctx = canvas.getContext('2d');
    const { scale } = layer;
    const toMap = (x, y) => ({ x: PADDING + x * scale, y: PADDING + y * scale });

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(layer.canvas, 0, 0);

    if (minimap.shortcut) {
      const s = toMap(minimap.shortcut.x, minimap.shortcut.y);
      const pulse = 3 + Math.sin(performance.now() / 180) * 1.5;
      ctx.fillStyle = '#c8ffb0';
      ctx.shadowColor = '#7dff5c';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (minimap.dest) {
      const d = toMap(minimap.dest.x, minimap.dest.y);
      ctx.fillStyle = minimap.dest.color || '#ffd23f';
      ctx.shadowColor = minimap.dest.color || '#ffd23f';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    const p = toMap(minimap.playerX, minimap.playerY);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(minimap.heading);
    ctx.fillStyle = '#7dfcff';
    ctx.shadowColor = '#7dfcff';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -3.5);
    ctx.lineTo(-4, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [minimap]);

  return (
    <div className="minimap">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
    </div>
  );
}

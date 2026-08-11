import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/GameEngine.js';
import { CITY_SEED } from '../game/engine/constants.js';
import HUD from './HUD.jsx';
import PauseMenu from './PauseMenu.jsx';
import PhotoModeOverlay from './PhotoModeOverlay.jsx';

let toastId = 0;

function toastForEvent(event) {
  switch (event.type) {
    case 'accepted':
      return { text: `${event.order.type.icon} ${event.order.type.label} order accepted!`, kind: 'info' };
    case 'delivered': {
      const comboText = event.comboCount > 1 ? ` · Combo ×${event.comboCount}` : '';
      return { text: `+$${event.reward} delivered!${comboText}`, kind: 'success' };
    }
    case 'missed':
      return { text: `Missed delivery — lost $${event.potential}`, kind: 'warning' };
    case 'penalty':
      return { text: `${event.reason} (-${event.seconds}s)`, kind: 'warning' };
    case 'boostRefill':
      return { text: 'Boost refilled!', kind: 'info' };
    case 'timeBonus':
      return { text: `⏱️ +${event.seconds}s time refill!`, kind: 'success' };
    case 'autoSelected':
      return { text: `${event.order.type.icon} Auto-picked: ${event.order.type.label}`, kind: 'info' };
    default:
      return null;
  }
}

/** The three mutually-exclusive overlays that can sit on top of the live canvas. 'none' is
 * normal play; 'pause' and 'photo' both freeze the engine (see GameEngine.pause/enterPhotoMode)
 * but swap in a different UI — this keeps the transitions between them (e.g. pause → photo mode
 * → back to pause) simple state changes rather than juggling separate booleans. */
export default function GameCanvas({ stats, nightDuration, night, difficulty, settings, onNightEnd, onSettingsChange, onRestart, onQuitToMenu }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [city, setCity] = useState(null);
  const [overlay, setOverlay] = useState('none');
  const [hud, setHud] = useState({
    timeRemaining: nightDuration,
    money: 0,
    deliveriesCompleted: 0,
    speed: 0,
    phase: 'toPickup',
    carrying: false,
    order: null,
    candidates: null,
    selectionProgress: 0,
    nav: null,
    navPrecision: 0,
    mapInfoLevel: 0,
    shortcutPing: null,
    combo: { count: 0, multiplier: 1 },
    boost: { meter: 1, isBoosting: false },
    minimap: null,
  });
  const [toasts, setToasts] = useState([]);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current, {
      citySeed: CITY_SEED,
      nightSeed: night * 7919 + 13,
      stats,
      nightDuration,
      difficulty,
      settings,
      onHudUpdate: (data) => setHud(data),
      onNightEnd: (summary) => onNightEnd(summary),
      onEvent: (event) => {
        if (event.type === 'worldEvent') {
          if (event.phase === 'start') {
            setBanner({ icon: event.def.icon, label: event.def.label });
          } else {
            setBanner((prev) => (prev?.label === event.def.label ? null : prev));
          }
          return;
        }
        const toast = toastForEvent(event);
        if (!toast) return;
        const id = toastId++;
        setToasts((prev) => [...prev, { id, ...toast }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 1800);
      },
    });
    engineRef.current = engine;
    setCity(engine.city);
    engine.start();

    return () => engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night]);

  // A separate top-level listener (not InputManager, which only tracks gameplay keys) so Escape
  // works regardless of which movement keys happen to be held at the moment. Escape backs out
  // one level at a time: photo mode -> pause -> playing, matching the "open pause, then jump
  // into photo mode" entry path.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Escape') return;
      setOverlay((prev) => {
        if (prev === 'photo') {
          engineRef.current?.exitPhotoMode();
          engineRef.current?.resume();
          return 'none';
        }
        if (prev === 'pause') {
          engineRef.current?.resume();
          return 'none';
        }
        engineRef.current?.pause();
        return 'pause';
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Mouse wheel zoom, only listened for while photo mode is actually active.
  useEffect(() => {
    if (overlay !== 'photo') return;
    const onWheel = (e) => {
      e.preventDefault();
      engineRef.current?.adjustPhotoZoom(1 - e.deltaY * 0.001);
    };
    const canvas = canvasRef.current;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [overlay]);

  const handlePauseClick = () => {
    engineRef.current?.pause();
    setOverlay('pause');
  };
  const handleResume = () => {
    engineRef.current?.resume();
    setOverlay('none');
  };
  const handleEnterPhotoMode = () => {
    engineRef.current?.enterPhotoMode();
    setOverlay('photo');
  };
  const handleExitPhotoMode = () => {
    engineRef.current?.exitPhotoMode();
    engineRef.current?.resume();
    setOverlay('none');
  };
  const handleCapture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `midnight-courier-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  const handleSelectDelivery = (index) => engineRef.current?.selectDelivery(index);

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      {overlay !== 'photo' && (
        <HUD hud={hud} nightDuration={nightDuration} night={night} city={city} onPause={handlePauseClick} onSelectDelivery={handleSelectDelivery} />
      )}
      {overlay === 'none' && banner && (
        <div className="event-banner">
          <span className="event-banner-icon">{banner.icon}</span>
          {banner.label}
        </div>
      )}
      {overlay === 'none' && (
        <div className="toast-layer">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
      )}
      {overlay === 'pause' && (
        <PauseMenu
          settings={settings}
          onSettingsChange={onSettingsChange}
          onResume={handleResume}
          onRestart={onRestart}
          onQuitToMenu={onQuitToMenu}
          onPhotoMode={handleEnterPhotoMode}
        />
      )}
      {overlay === 'photo' && <PhotoModeOverlay onCapture={handleCapture} onExit={handleExitPhotoMode} />}
    </div>
  );
}

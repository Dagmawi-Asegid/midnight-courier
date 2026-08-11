import { useState } from 'react';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05, format }) {
  return (
    <label className="settings-slider">
      <span className="settings-slider-head">
        <span>{label}</span>
        <span className="settings-slider-value">{format ? format(value) : Math.round(value * 100) + '%'}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="settings-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt[0].toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}

const CONTROLS = [
  { keys: ['W', 'A', 'S', 'D'], desc: 'or arrow keys — ride' },
  { keys: ['SHIFT'], desc: 'boost' },
  { keys: ['SPACE', 'E'], desc: 'accept / deliver' },
  { keys: ['ESC'], desc: 'pause' },
];

/** Full settings UI shared by two entry points: a standalone screen from the main menu
 * (`variant="menu"`) and an embedded panel inside the pause menu (`variant="pause"`). Every
 * control writes straight through `onChange` and is persisted by the caller immediately —
 * there's no separate "Apply" step, so a setting always reflects what's actually in effect. */
export default function SettingsScreen({ settings, onChange, onBack, onResetSave, variant = 'menu' }) {
  const set = (section, key) => (value) => onChange(section, key, value);
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className={variant === 'menu' ? 'screen settings-screen' : 'settings-panel'}>
      {variant === 'menu' && <h2 className="settings-title">Settings</h2>}
      {variant === 'pause' && <h3 className="pause-panel-title">Settings</h3>}

      <div className="settings-scroll">
        <section className="settings-section">
          <h4 className="settings-section-title">Graphics</h4>
          <Select
            label="Quality"
            value={settings.graphics.quality}
            options={['low', 'medium', 'high']}
            onChange={set('graphics', 'quality')}
          />
          <Toggle label="Effects (skid marks, speed lines)" checked={settings.graphics.effects} onChange={set('graphics', 'effects')} />
          <Toggle label="Shadows & vignette" checked={settings.graphics.shadows} onChange={set('graphics', 'shadows')} />
        </section>

        <section className="settings-section">
          <h4 className="settings-section-title">Audio</h4>
          <Slider label="Master Volume" value={settings.audio.master} onChange={set('audio', 'master')} />
          <Slider label="Music Volume" value={settings.audio.music} onChange={set('audio', 'music')} />
          <p className="settings-caption">No score is playing yet — this is ready for when one is.</p>
          <Slider label="SFX Volume" value={settings.audio.sfx} onChange={set('audio', 'sfx')} />
        </section>

        <section className="settings-section">
          <h4 className="settings-section-title">Gameplay</h4>
          <Slider
            label="Camera Sensitivity"
            value={settings.gameplay.cameraSensitivity}
            min={0.5}
            max={2}
            step={0.1}
            format={(v) => `${v.toFixed(1)}×`}
            onChange={set('gameplay', 'cameraSensitivity')}
          />
          <div className="settings-controls-grid">
            {CONTROLS.map((row) => (
              <div key={row.desc} className="settings-controls-row">
                <span className="settings-controls-keys">
                  {row.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
                <span className="settings-controls-desc">{row.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h4 className="settings-section-title">Accessibility</h4>
          <Toggle
            label="Reduced Screen Shake"
            checked={settings.accessibility.reducedShake}
            onChange={set('accessibility', 'reducedShake')}
          />
          <Toggle
            label="Reduced Flashing"
            checked={settings.accessibility.reducedFlashing}
            onChange={set('accessibility', 'reducedFlashing')}
          />
          <Toggle
            label="High Contrast UI"
            checked={settings.accessibility.highContrast}
            onChange={set('accessibility', 'highContrast')}
          />
        </section>

        {onResetSave && (
          <section className="settings-section settings-section--danger">
            <h4 className="settings-section-title">Save Data</h4>
            {confirmingReset ? (
              <div className="settings-reset-confirm">
                <p>This erases all money, upgrades, level progress and achievements. This can't be undone.</p>
                <div className="settings-reset-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingReset(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={onResetSave}>
                    Erase everything
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmingReset(true)}>
                Reset Save
              </button>
            )}
          </section>
        )}
      </div>

      <button className="btn btn-ghost" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

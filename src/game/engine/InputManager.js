const MOVE_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Tracks keyboard state for movement + interaction, independent of React. */
export class InputManager {
  constructor(target = window) {
    this.target = target;
    this.state = { up: false, down: false, left: false, right: false, boost: false };
    this.interactPressed = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  attach() {
    this.target.addEventListener('keydown', this._onKeyDown);
    this.target.addEventListener('keyup', this._onKeyUp);
  }

  detach() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(e) {
    const action = MOVE_KEYS[e.code];
    if (action) {
      this.state[action] = true;
      e.preventDefault();
    }
    if (e.code === 'Space' || e.code === 'KeyE') {
      this.interactPressed = true;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.state.boost = true;
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    const action = MOVE_KEYS[e.code];
    if (action) {
      this.state[action] = false;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.state.boost = false;
      e.preventDefault();
    }
  }

  /** Consumes the one-shot interact press (Space/E) so it fires once per tap. */
  consumeInteract() {
    const pressed = this.interactPressed;
    this.interactPressed = false;
    return pressed;
  }
}

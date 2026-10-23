// Standard Home Assistant card actions: tap_action, hold_action and
// double_tap_action. The card only detects the gesture and fires `hass-action`;
// Home Assistant runs the action itself, so every action type it knows
// (more-info, navigate, url, perform-action, toggle, assist, confirmation)
// works without code here.

export const HOLD_MS = 500;
export const DOUBLE_TAP_MS = 250;
// A pointer that travels further than this is scrolling, not tapping.
const MOVE_PX = 10;

export function hasAction(actionConfig) {
  return Boolean(actionConfig && actionConfig.action) && actionConfig.action !== 'none';
}

/**
 * Turns pointer events into 'tap', 'hold' and 'double_tap'. `getOptions()`
 * says which gestures are configured: without a hold action a long press is a
 * tap, and without a double-tap action a tap fires at once instead of waiting
 * to see whether a second one follows.
 */
export class GestureDetector {
  constructor(onAction, getOptions) {
    this.onAction = onAction;
    this.getOptions = getOptions;
    this.start = null;
    this.held = false;
    this.holdTimer = null;
    this.tapTimer = null;
  }

  down(x, y) {
    this.cancelHold();
    this.start = { x, y };
    this.held = false;
    if (this.getOptions().hold) {
      this.holdTimer = setTimeout(() => {
        this.holdTimer = null;
        this.held = true;
        this.onAction('hold');
      }, HOLD_MS);
    }
  }

  move(x, y) {
    if (this.start && Math.hypot(x - this.start.x, y - this.start.y) > MOVE_PX) {
      this.cancel();
    }
  }

  up() {
    if (!this.start) {
      return;
    }
    this.start = null;
    this.cancelHold();
    if (this.held) {
      this.held = false;
      return;
    }
    if (!this.getOptions().doubleTap) {
      this.onAction('tap');
    } else if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
      this.onAction('double_tap');
    } else {
      this.tapTimer = setTimeout(() => {
        this.tapTimer = null;
        this.onAction('tap');
      }, DOUBLE_TAP_MS);
    }
  }

  cancel() {
    this.cancelHold();
    this.start = null;
  }

  cancelHold() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  dispose() {
    this.cancel();
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
  }
}

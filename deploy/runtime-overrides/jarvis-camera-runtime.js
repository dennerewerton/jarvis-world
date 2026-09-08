import ioManager from './io-manager.js';
import cameraManager from './camera-manager.js';
import {getRenderer} from './renderer.js';

// Jarvis World camera focus for Discord Activities.
// Native Pointer Lock is intentionally avoided because it can stall the Activity iframe.
let focused = false;
let edgeX = 0;
let edgeY = 0;

const isTextInputFocused = () => {
  const el = document.activeElement;
  return !!el && (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable ||
    el.getAttribute?.('contenteditable') !== null
  );
};

const setCursor = value => {
  const renderer = getRenderer();
  if (renderer?.domElement) renderer.domElement.style.cursor = value;
  document.documentElement.style.cursor = value;
  if (document.body) document.body.style.cursor = value;
};

const setFocused = value => {
  focused = !!value;
  edgeX = 0;
  edgeY = 0;
  // Keep the legacy soft-focus flag disabled. This module owns camera look.
  ioManager.jarvisCameraFocus = false;
  setCursor(focused ? 'none' : '');
};

const isQuoteToggle = event => (
  event.code === 'Quote' ||
  event.code === 'Backquote' ||
  event.key === "'" ||
  event.key === '"' ||
  event.key === '`' ||
  event.which === 192 ||
  event.keyCode === 192
);

window.addEventListener('keydown', event => {
  if (!isQuoteToggle(event) || event.repeat || isTextInputFocused()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setFocused(!focused);
}, true);

const edgeFactor = (value, min, max, margin) => {
  if (value <= min + margin) {
    return -Math.min(1, Math.max(0, (min + margin - value) / margin));
  }
  if (value >= max - margin) {
    return Math.min(1, Math.max(0, (value - (max - margin)) / margin));
  }
  return 0;
};

window.addEventListener('mousemove', event => {
  if (!focused) return;

  const renderer = getRenderer();
  const canvas = renderer?.domElement;
  if (!canvas) return;

  // Use normal mouse deltas while the pointer is moving inside the Activity.
  if (event.movementX || event.movementY) {
    cameraManager.handleMouseMove(event);
  }

  // When the cursor reaches the edge, remember that direction. If it leaves the
  // iframe, mousemove events stop, but the animation loop below keeps rotating.
  const rect = canvas.getBoundingClientRect();
  const margin = Math.max(42, Math.min(100, Math.min(rect.width, rect.height) * 0.13));
  edgeX = edgeFactor(event.clientX, rect.left, rect.right, margin);
  edgeY = edgeFactor(event.clientY, rect.top, rect.bottom, margin);
}, true);

const tick = () => {
  if (focused && !cameraManager.pointerLockElement) {
    if (Math.abs(edgeX) > 0.001 || Math.abs(edgeY) > 0.001) {
      cameraManager.handleMouseMove({
        movementX: edgeX * 12,
        movementY: edgeY * 9,
      });
    }
  }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

window.addEventListener('blur', () => setFocused(false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setFocused(false);
});

console.log('[Jarvis World] standalone edge-steering camera runtime loaded.');

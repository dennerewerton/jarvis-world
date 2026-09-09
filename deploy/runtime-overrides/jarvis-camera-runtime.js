// Jarvis World camera focus for Discord Activities.
// Native Pointer Lock is intentionally avoided because it can stall the Activity iframe.
//
// IMPORTANT: keep gameplay/runtime singletons out of this module's static import graph.
// App.jsx imports this file before the React app mounts, so eager imports of renderer,
// camera-manager or io-manager can re-enter the Webaverse bootstrap graph and leave the
// HUD alive while the 3D scene never finishes initializing. Runtime dependencies are
// resolved lazily only after the player actually enables camera focus.
let focused = false;
let edgeX = 0;
let edgeY = 0;
let runtime = null;
let runtimePromise = null;
let runtimeErrorLogged = false;

const loadRuntime = () => {
  if (runtime) return Promise.resolve(runtime);
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import('./io-manager.js'),
      import('./camera-manager.js'),
      import('./renderer.js'),
    ]).then(([ioModule, cameraModule, rendererModule]) => {
      runtime = {
        ioManager: ioModule.default,
        cameraManager: cameraModule.default,
        getRenderer: rendererModule.getRenderer,
      };
      return runtime;
    }).catch(error => {
      runtimePromise = null;
      if (!runtimeErrorLogged) {
        runtimeErrorLogged = true;
        console.error('[Jarvis World] unable to load camera runtime lazily:', error);
      }
      throw error;
    });
  }
  return runtimePromise;
};

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
  document.documentElement.style.cursor = value;
  if (document.body) document.body.style.cursor = value;

  if (runtime) {
    const renderer = runtime.getRenderer?.();
    if (renderer?.domElement) renderer.domElement.style.cursor = value;
  }
};

const setFocused = value => {
  focused = !!value;
  edgeX = 0;
  edgeY = 0;
  setCursor(focused ? 'none' : '');

  if (runtime) {
    // Keep the legacy soft-focus flag disabled. This module owns camera look.
    runtime.ioManager.jarvisCameraFocus = false;
  } else if (focused) {
    void loadRuntime().then(({ioManager, getRenderer}) => {
      ioManager.jarvisCameraFocus = false;
      const renderer = getRenderer?.();
      if (renderer?.domElement) renderer.domElement.style.cursor = 'none';
    }).catch(() => {});
  }
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

window.addEventListener('mousemove', event => {
  if (!focused) return;

  void loadRuntime().then(({cameraManager, getRenderer}) => {
    if (!focused) return;
    const renderer = getRenderer?.();
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
  }).catch(() => {});
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

const tick = () => {
  if (focused && runtime && !runtime.cameraManager.pointerLockElement) {
    if (Math.abs(edgeX) > 0.001 || Math.abs(edgeY) > 0.001) {
      runtime.cameraManager.handleMouseMove({
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

console.log('[Jarvis World] standalone edge-steering camera runtime loaded (lazy singleton mode).');

// Jarvis World competitive mouse-look for Discord Activities.
//
// The old Activity camera used edge steering because Pointer Lock had previously
// been disabled. That made the camera continue rotating after the cursor reached
// the edge of the iframe. This runtime uses FPS-style relative mouse input instead:
// the pointer is captured, movement is consumed as deltas, and there is no edge
// acceleration, smoothing or autonomous rotation.
//
// IMPORTANT: keep gameplay/runtime singletons out of this module's static import
// graph. App.jsx imports this file before the React app mounts, so eager imports of
// renderer/camera-manager/io-manager can re-enter the Webaverse bootstrap graph.
let runtime = null;
let runtimePromise = null;
let runtimeErrorLogged = false;
let pointerLockErrorLogged = false;
let desiredFocus = false;
let lockElement = null;

const SENSITIVITY_STORAGE_KEY = 'jarvis.mouseSensitivity';
const DEFAULT_SENSITIVITY = 2.0;
const MIN_SENSITIVITY = 0.1;
const MAX_SENSITIVITY = 10.0;
// Source/CS-style yaw and pitch: 0.022 degrees per mouse count at sensitivity 1.
const SOURCE_DEGREES_PER_COUNT = 0.022;
// Webaverse camera-manager currently applies 0.18 degrees per movement count.
const WEBAVERSE_DEGREES_PER_COUNT = 0.18;
const MAX_MOVEMENT_PER_EVENT = 800;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const readSensitivity = () => {
  try {
    const stored = Number.parseFloat(localStorage.getItem(SENSITIVITY_STORAGE_KEY));
    if (Number.isFinite(stored)) return clamp(stored, MIN_SENSITIVITY, MAX_SENSITIVITY);
  } catch {}
  return DEFAULT_SENSITIVITY;
};

let sensitivity = readSensitivity();

const setSensitivity = value => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return sensitivity;
  sensitivity = clamp(parsed, MIN_SENSITIVITY, MAX_SENSITIVITY);
  try {
    localStorage.setItem(SENSITIVITY_STORAGE_KEY, String(sensitivity));
  } catch {}
  window.dispatchEvent(new CustomEvent('jarvis:mouse-sensitivity-changed', {
    detail: {sensitivity},
  }));
  return sensitivity;
};

const getSensitivityScale = () => (
  sensitivity * SOURCE_DEGREES_PER_COUNT / WEBAVERSE_DEGREES_PER_COUNT
);

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
      runtime.ioManager.jarvisCameraFocus = false;
      return runtime;
    }).catch(error => {
      runtimePromise = null;
      if (!runtimeErrorLogged) {
        runtimeErrorLogged = true;
        console.error('[Jarvis World] unable to load competitive mouse runtime lazily:', error);
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
  const canvas = runtime?.getRenderer?.()?.domElement;
  if (canvas) canvas.style.cursor = value;
};

const isLocked = () => !!document.pointerLockElement;

const finishUnlock = () => {
  desiredFocus = false;
  lockElement = null;
  setCursor('');
  if (runtime) runtime.ioManager.jarvisCameraFocus = false;
};

const requestPointerLock = element => {
  if (!element?.requestPointerLock) {
    desiredFocus = false;
    if (!pointerLockErrorLogged) {
      pointerLockErrorLogged = true;
      console.warn('[Jarvis World] Pointer Lock is unavailable; FPS mouse capture cannot be enabled in this client.');
    }
    return;
  }

  desiredFocus = true;
  lockElement = element;
  setCursor('none');

  try {
    // Call synchronously from the keyboard/pointer gesture so Chromium preserves
    // transient user activation inside the Discord iframe.
    const result = element.requestPointerLock({unadjustedMovement: true});
    if (result?.catch) {
      result.catch(() => {
        // Chromium implementations that do not accept raw-input options can still
        // support normal Pointer Lock. Retry only while the original focus request
        // is still active; if that retry is denied we simply leave the camera idle.
        if (!desiredFocus || isLocked()) return;
        try {
          const fallbackResult = element.requestPointerLock();
          fallbackResult?.catch?.(() => {});
        } catch {}
      });
    }
  } catch {
    try {
      const fallbackResult = element.requestPointerLock();
      fallbackResult?.catch?.(() => {});
    } catch {
      finishUnlock();
    }
  }

  // Runtime imports happen only after the native capture request has already been
  // issued, so they cannot consume the browser's user-activation window.
  void loadRuntime();
};

const releasePointerLock = () => {
  desiredFocus = false;
  if (document.pointerLockElement && document.exitPointerLock) {
    document.exitPointerLock();
  } else {
    finishUnlock();
  }
};

const togglePointerLock = () => {
  if (isLocked() || desiredFocus) {
    releasePointerLock();
    return;
  }
  const rendererCanvas = runtime?.getRenderer?.()?.domElement;
  requestPointerLock(rendererCanvas || document.body || document.documentElement);
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
  togglePointerLock();
}, true);

// Clicking directly on the 3D renderer enters normal FPS mouse capture. HUD clicks
// are not affected because their event target is not the renderer canvas.
window.addEventListener('pointerdown', event => {
  if (event.button !== 0 || isTextInputFocused() || isLocked() || desiredFocus) return;
  const target = event.target;
  if (target?.tagName === 'CANVAS') {
    requestPointerLock(target);
  }
}, true);

document.addEventListener('pointerlockchange', () => {
  const lockedElement = document.pointerLockElement;
  if (lockedElement) {
    desiredFocus = true;
    lockElement = lockedElement;
    setCursor('none');
    void loadRuntime().then(({ioManager}) => {
      ioManager.jarvisCameraFocus = false;
    }).catch(() => {});
  } else {
    finishUnlock();
  }
});

document.addEventListener('pointerlockerror', () => {
  if (!pointerLockErrorLogged) {
    pointerLockErrorLogged = true;
    console.warn('[Jarvis World] Pointer Lock request was rejected by the Activity host; camera remains stationary instead of edge-steering.');
  }
  if (!isLocked()) finishUnlock();
});

window.addEventListener('mousemove', event => {
  if (!document.pointerLockElement) return;

  const movementX = clamp(Number(event.movementX) || 0, -MAX_MOVEMENT_PER_EVENT, MAX_MOVEMENT_PER_EVENT);
  const movementY = clamp(Number(event.movementY) || 0, -MAX_MOVEMENT_PER_EVENT, MAX_MOVEMENT_PER_EVENT);
  if (!movementX && !movementY) return;

  const scale = getSensitivityScale();
  void loadRuntime().then(({cameraManager}) => {
    if (!document.pointerLockElement) return;
    cameraManager.handleMouseMove({
      movementX: movementX * scale,
      movementY: movementY * scale,
    });
  }).catch(() => {});
}, true);

window.addEventListener('blur', () => {
  // Browser/Electron normally releases Pointer Lock on focus loss. Explicitly clear
  // our state as well so no stale focus can survive an Alt+Tab or Activity close.
  if (!document.pointerLockElement) finishUnlock();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) releasePointerLock();
});

window.jarvisMouseLook = {
  getSensitivity: () => sensitivity,
  setSensitivity,
  getSourceEquivalent: () => sensitivity,
  enable: togglePointerLock,
  disable: releasePointerLock,
  isLocked: () => !!document.pointerLockElement,
};

window.addEventListener('jarvis:set-mouse-sensitivity', event => {
  setSensitivity(event.detail?.sensitivity ?? event.detail);
});

// Warm the lazy imports after the first harmless pointer movement. This normally
// makes the camera runtime ready before the player clicks to capture the mouse,
// without putting those modules back into App.jsx's static bootstrap graph.
window.addEventListener('pointermove', () => {
  void loadRuntime();
}, {once: true, passive: true});

console.log(`[Jarvis World] competitive FPS mouse runtime loaded (CS-style sensitivity ${sensitivity.toFixed(2)}, no edge steering).`);

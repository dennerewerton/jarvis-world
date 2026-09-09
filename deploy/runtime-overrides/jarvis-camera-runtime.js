// Jarvis World competitive mouse-look for Discord Activities.
//
// Native Pointer Lock can freeze/stall some Discord Activity/Electron iframe builds.
// Therefore embedded Activities use a safe relative-delta focus mode, while normal
// top-level browser builds may still use native Pointer Lock. Both modes use the
// same CS/Source-style sensitivity curve and neither mode uses edge steering.
//
// IMPORTANT: keep gameplay/runtime singletons out of this module's static import
// graph. App.jsx imports this file before the React app mounts, so eager imports of
// renderer/camera-manager/io-manager can re-enter the Webaverse bootstrap graph.
let runtime = null;
let runtimePromise = null;
let runtimeErrorLogged = false;
let pointerLockErrorLogged = false;
let desiredFocus = false;
let softFocused = false;
let dragPointerId = null;

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

const isEmbeddedActivity = () => {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const referrer = String(document.referrer || '').toLowerCase();
  return referrer.includes('discord.com')
    || referrer.includes('discordapp.com')
    || referrer.includes('discordsays.com');
};

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
      // Never reactivate the old io-manager soft focus. This runtime owns camera look.
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

const getCanvas = () => runtime?.getRenderer?.()?.domElement || null;

const setGlobalCursor = value => {
  document.documentElement.style.cursor = value;
  if (document.body) document.body.style.cursor = value;
  const canvas = getCanvas();
  if (canvas) canvas.style.cursor = value;
};

const setCanvasCursor = value => {
  const canvas = getCanvas();
  if (canvas) canvas.style.cursor = value;
};

const isLocked = () => !!document.pointerLockElement;

const finishNativeUnlock = () => {
  desiredFocus = false;
  setGlobalCursor('');
  if (runtime) runtime.ioManager.jarvisCameraFocus = false;
};

const setSoftFocused = value => {
  softFocused = !!value;
  desiredFocus = softFocused;
  dragPointerId = null;
  // In an iframe the pointer cannot be safely confined. Do not hide it globally:
  // that would make it appear lost when it crosses HUD controls or leaves the canvas.
  setGlobalCursor('');
  if (runtime) runtime.ioManager.jarvisCameraFocus = false;
  if (softFocused) setCanvasCursor('crosshair');
};

const applyMouseDelta = (movementX, movementY) => {
  const dx = clamp(Number(movementX) || 0, -MAX_MOVEMENT_PER_EVENT, MAX_MOVEMENT_PER_EVENT);
  const dy = clamp(Number(movementY) || 0, -MAX_MOVEMENT_PER_EVENT, MAX_MOVEMENT_PER_EVENT);
  if (!dx && !dy) return;

  const scale = getSensitivityScale();
  void loadRuntime().then(({cameraManager}) => {
    cameraManager.handleMouseMove({
      movementX: dx * scale,
      movementY: dy * scale,
    });
  }).catch(() => {});
};

const requestPointerLock = element => {
  // Critical Discord safeguard: do not even call requestPointerLock from an embedded
  // Activity. Some Electron/Discord builds stall the iframe synchronously here.
  if (isEmbeddedActivity()) {
    setSoftFocused(true);
    void loadRuntime();
    return;
  }

  if (!element?.requestPointerLock) {
    desiredFocus = false;
    if (!pointerLockErrorLogged) {
      pointerLockErrorLogged = true;
      console.warn('[Jarvis World] Pointer Lock is unavailable; using safe soft mouse focus.');
    }
    setSoftFocused(true);
    return;
  }

  desiredFocus = true;
  setGlobalCursor('none');

  try {
    const result = element.requestPointerLock({unadjustedMovement: true});
    if (result?.catch) {
      result.catch(() => {
        if (!desiredFocus || isLocked()) return;
        try {
          const fallbackResult = element.requestPointerLock();
          fallbackResult?.catch?.(() => setSoftFocused(true));
        } catch {
          setSoftFocused(true);
        }
      });
    }
  } catch {
    try {
      const fallbackResult = element.requestPointerLock();
      fallbackResult?.catch?.(() => setSoftFocused(true));
    } catch {
      setSoftFocused(true);
    }
  }

  void loadRuntime();
};

const releaseFocus = () => {
  desiredFocus = false;
  softFocused = false;
  dragPointerId = null;
  setGlobalCursor('');
  if (document.pointerLockElement && document.exitPointerLock) {
    document.exitPointerLock();
  }
  if (runtime) runtime.ioManager.jarvisCameraFocus = false;
};

const enableFocus = () => {
  if (isLocked() || softFocused || desiredFocus) return;
  const rendererCanvas = getCanvas();
  requestPointerLock(rendererCanvas || document.body || document.documentElement);
};

const toggleFocus = () => {
  if (isLocked() || softFocused || desiredFocus) {
    releaseFocus();
  } else {
    enableFocus();
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
  if (event.key === 'Escape' && softFocused) {
    event.preventDefault();
    releaseFocus();
    return;
  }
  if (!isQuoteToggle(event) || event.repeat || isTextInputFocused()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleFocus();
}, true);

// Clicking the 3D renderer enables camera focus. In Discord this is the safe soft
// mode; top-level browser builds can still receive native Pointer Lock.
window.addEventListener('pointerdown', event => {
  if (isTextInputFocused()) return;
  const target = event.target;
  if (target?.tagName !== 'CANVAS') return;

  if (event.button === 0 && !isLocked() && !softFocused && !desiredFocus) {
    requestPointerLock(target);
  }

  // Right-drag is an additional robust Activity control: Pointer Capture keeps
  // relative deltas flowing across canvas/HUD boundaries without native Pointer Lock.
  if (isEmbeddedActivity() && event.button === 2) {
    setSoftFocused(true);
    dragPointerId = event.pointerId;
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {}
    event.preventDefault();
  }
}, true);

window.addEventListener('pointerup', event => {
  if (dragPointerId !== null && event.pointerId === dragPointerId) {
    const target = event.target;
    try {
      target?.releasePointerCapture?.(event.pointerId);
    } catch {}
    dragPointerId = null;
  }
}, true);

window.addEventListener('contextmenu', event => {
  if (isEmbeddedActivity() && event.target?.tagName === 'CANVAS') {
    event.preventDefault();
  }
}, true);

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) {
    desiredFocus = true;
    softFocused = false;
    setGlobalCursor('none');
    void loadRuntime().then(({ioManager}) => {
      ioManager.jarvisCameraFocus = false;
    }).catch(() => {});
  } else if (!softFocused) {
    finishNativeUnlock();
  }
});

document.addEventListener('pointerlockerror', () => {
  if (!pointerLockErrorLogged) {
    pointerLockErrorLogged = true;
    console.warn('[Jarvis World] Pointer Lock request was rejected; falling back to safe soft mouse focus.');
  }
  if (!isLocked()) setSoftFocused(true);
});

window.addEventListener('mousemove', event => {
  if (document.pointerLockElement) {
    // Prevent io-manager from applying the unscaled movement a second time.
    event.preventDefault?.();
    event.stopImmediatePropagation();
    applyMouseDelta(event.movementX, event.movementY);
    return;
  }

  if (!softFocused || isTextInputFocused()) return;
  const canvas = getCanvas();
  if (!canvas) return;

  // No edge steering: movement rotates only while a real mouse event is arriving.
  // Normal focused look is limited to the canvas so HUD interactions remain stable.
  // During right-drag Pointer Capture, keep rotating until the button is released.
  const dragging = dragPointerId !== null;
  if (!dragging && event.target !== canvas) return;

  event.preventDefault?.();
  event.stopImmediatePropagation();
  applyMouseDelta(event.movementX, event.movementY);
}, true);

window.addEventListener('blur', () => {
  if (!document.pointerLockElement) releaseFocus();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseFocus();
});

window.jarvisMouseLook = {
  getSensitivity: () => sensitivity,
  setSensitivity,
  getSourceEquivalent: () => sensitivity,
  enable: enableFocus,
  disable: releaseFocus,
  toggle: toggleFocus,
  isLocked: () => !!document.pointerLockElement,
  isSoftFocused: () => softFocused,
  isEmbeddedActivity,
};

window.addEventListener('jarvis:set-mouse-sensitivity', event => {
  setSensitivity(event.detail?.sensitivity ?? event.detail);
});

// Warm lazy imports before the first click without reintroducing static bootstrap cycles.
window.addEventListener('pointermove', () => {
  void loadRuntime();
}, {once: true, passive: true});

console.log(`[Jarvis World] Activity-safe competitive mouse runtime loaded (CS-style sensitivity ${sensitivity.toFixed(2)}, embedded=${isEmbeddedActivity()}, no edge steering).`);

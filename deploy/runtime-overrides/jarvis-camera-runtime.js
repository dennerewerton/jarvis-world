// Jarvis World: restore Webaverse's canonical Pointer Lock path.
//
// Do not implement our own mouse delta loop, edge steering, pointer capture, or
// direct element.requestPointerLock() calls here. Webaverse already owns all of
// that through camera-manager.js and io-manager.js. This tiny bridge only binds
// the Jarvis quote/backquote key to the original cameraManager request/exit API.
//
// Keeping the canonical manager matters because it:
// - targets the actual WebGL renderer canvas;
// - tracks pointerlockchange in cameraManager.pointerLockElement;
// - tries raw/unadjusted movement first and falls back to normal Pointer Lock;
// - lets the original io-manager route relative movement into handleMouseMove().
let cameraManager = null;
let cameraManagerPromise = null;
let loadErrorLogged = false;

const loadCameraManager = () => {
  if (cameraManager) return Promise.resolve(cameraManager);
  if (!cameraManagerPromise) {
    cameraManagerPromise = import('./camera-manager.js').then(module => {
      cameraManager = module.default;
      return cameraManager;
    }).catch(error => {
      cameraManagerPromise = null;
      if (!loadErrorLogged) {
        loadErrorLogged = true;
        console.error('[Jarvis World] unable to load canonical Webaverse camera manager:', error);
      }
      throw error;
    });
  }
  return cameraManagerPromise;
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

const isQuoteToggle = event => (
  event.code === 'Quote' ||
  event.code === 'Backquote' ||
  event.key === "'" ||
  event.key === '"' ||
  event.key === '`' ||
  event.which === 192 ||
  event.keyCode === 192
);

const toggleCanonicalPointerLock = () => {
  const toggle = manager => {
    if (manager.pointerLockElement) {
      manager.exitPointerLock();
    } else {
      void manager.requestPointerLock();
    }
  };

  if (cameraManager) {
    toggle(cameraManager);
  } else {
    // Normally prewarmed by the time the player presses quote. If not, load the
    // already-running Webaverse singleton and toggle as soon as it resolves.
    void loadCameraManager().then(toggle).catch(() => {});
  }
};

window.addEventListener('keydown', event => {
  if (!isQuoteToggle(event) || event.repeat || isTextInputFocused()) return;

  // Consume the old patched key-192 soft-focus handler. From this point the quote
  // key controls only Webaverse's original native Pointer Lock implementation.
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleCanonicalPointerLock();
}, true);

// Prewarm only after the page has finished booting, avoiding the static bootstrap
// import cycle that previously caused the white-scene regression.
const prewarm = () => {
  void loadCameraManager();
};
window.addEventListener('load', prewarm, {once: true});
window.addEventListener('pointermove', prewarm, {once: true, passive: true});

window.jarvisMouseLook = {
  enable() {
    if (cameraManager?.pointerLockElement) return;
    if (cameraManager) {
      void cameraManager.requestPointerLock();
    } else {
      void loadCameraManager().then(manager => manager.requestPointerLock()).catch(() => {});
    }
  },
  disable() {
    if (cameraManager?.pointerLockElement) cameraManager.exitPointerLock();
  },
  toggle: toggleCanonicalPointerLock,
  isLocked: () => !!cameraManager?.pointerLockElement,
};

console.log('[Jarvis World] canonical Webaverse Pointer Lock bridge loaded; quote/backquote toggles the original camera manager.');

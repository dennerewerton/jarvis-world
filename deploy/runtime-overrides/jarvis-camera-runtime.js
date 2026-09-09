// Jarvis World camera compatibility placeholder.
//
// Pointer Lock is owned entirely by Webaverse's canonical io-manager.js and
// camera-manager.js. Do not intercept quote/backquote or mousemove here: doing so
// can move the Pointer Lock request outside the synchronous keyboard gesture and
// cause Chromium/Electron to reject the capture while the HUD remains responsive.
//
// This file stays present because squarecloud-start.mjs still materializes the
// runtime override path. It intentionally has no input listeners and no imports.
console.log('[Jarvis World] standalone camera override disabled; canonical synchronous Webaverse Pointer Lock is active.');

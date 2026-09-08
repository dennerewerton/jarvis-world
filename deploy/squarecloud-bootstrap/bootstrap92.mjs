import fs from 'node:fs';

const sourceUrl = new URL('./bootstrap.mjs', import.meta.url);
const generatedUrl = new URL('./.bootstrap92.generated.mjs', import.meta.url);
let source = fs.readFileSync(sourceUrl, 'utf8');

const oldRelease = "const release = 'fw70-pilot-2026-09-08.90';";
const newRelease = "const release = 'fw70-pilot-2026-09-08.92';";
const oldLastPatch = "const lastValidatedRuntimePatch = '0073-premium-svg-social-hud.patch';";
const newLastPatch = "const lastValidatedRuntimePatch = '0072-toggle-game-camera-with-quote.patch';";

if (!source.includes(oldRelease)) {
  throw new Error('Expected .90 release marker was not found in bootstrap.mjs');
}
if (!source.includes(oldLastPatch)) {
  throw new Error('Expected 0073 patch marker was not found in bootstrap.mjs');
}

source = source
  .replace(oldRelease, newRelease)
  .replace(oldLastPatch, newLastPatch);

fs.writeFileSync(generatedUrl, source, 'utf8');
console.log('[Jarvis World] bootstrap .92 active: corrected 0072 camera patch; premium HUD is installed directly at runtime start.');
await import(`${generatedUrl.href}?release=92`);

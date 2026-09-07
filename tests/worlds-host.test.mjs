import assert from 'node:assert/strict';
import test from 'node:test';

import {resolveWorldsHost} from '../app/src/jarvis-compat/worlds-host.mjs';

test('production HTTPS uses the same origin so WSRTC upgrades to secure WSS', () => {
  assert.equal(resolveWorldsHost({
    hostname: 'world.jarvis.example',
    origin: 'https://world.jarvis.example',
    port: '',
    protocol: 'https:',
  }), 'https://world.jarvis.example/worlds/');
});

test('loopback development preserves the historical adjacent websocket port', () => {
  assert.equal(resolveWorldsHost({
    hostname: '127.0.0.1',
    origin: 'http://127.0.0.1:3100',
    port: '3100',
    protocol: 'http:',
  }), 'http://127.0.0.1:3101/worlds/');
});

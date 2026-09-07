import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityApi,
  ActivityApiError,
  clearActivitySession,
} from '../app/src/jarvis-compat/activity-api.mjs';
import {
  jarvisBridge,
  loadJarvisIdentity,
} from '../app/src/jarvis-compat/jarvis-bridge.mjs';

const response = (body, {ok = true, status = 200} = {}) => ({
  ok,
  status,
  async json() {
    return body;
  },
});

test('exchange keeps the Jarvis session only in module memory for authorized reads', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({path, options});
    if (path.endsWith('/auth/exchange')) {
      return response({activity_session: 'signed-session', access_token: 'discord-token'});
    }
    return response({ok: true});
  };
  t.after(() => {
    clearActivitySession();
    globalThis.fetch = originalFetch;
  });

  await activityApi.exchange('one-use-code');
  await activityApi.me();

  assert.equal(requests[0].path, '/api/activity/auth/exchange');
  assert.equal(JSON.parse(requests[0].options.body).code, 'one-use-code');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer signed-session');
  assert.equal('localStorage' in requests[1].options, false);
});

test('clearing the session prevents authorized reads', async () => {
  clearActivitySession();
  await assert.rejects(
    activityApi.wallet(),
    error => error instanceof ActivityApiError && error.code === 'missing_session',
  );
});

test('read-only bridge uses only session-scoped Activity endpoints', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const payloads = {
    '/api/activity/me': {ok: true, user: {id: '42', display_name: 'Piloto'}},
    '/api/activity/profile': {ok: true, profile: {display_name: 'Piloto', level: 3}},
    '/api/activity/wallet': {ok: true, wallet: {currency: 'jarvis_coins', balance: 50}},
    '/api/activity/inventory': {ok: true, inventory: {items: [], read_only: true}},
    '/api/activity/shop': {ok: true, shop: {items: [], catalog_mode: 'read_only'}},
  };
  globalThis.fetch = async (path, options = {}) => {
    requests.push({path, options});
    if (path.endsWith('/auth/exchange')) {
      return response({activity_session: 'bridge-session', access_token: 'discard-me'});
    }
    return response(payloads[path]);
  };
  t.after(() => {
    clearActivitySession();
    globalThis.fetch = originalFetch;
  });

  await activityApi.exchange('single-use-code');
  const identity = await loadJarvisIdentity();
  const inventory = await jarvisBridge.getInventory();
  const shop = await jarvisBridge.getShop();

  assert.equal(identity.user.id, '42');
  assert.equal(identity.profile.level, 3);
  assert.equal(identity.wallet.balance, 50);
  assert.equal(inventory.read_only, true);
  assert.equal(shop.catalog_mode, 'read_only');
  assert.deepEqual(
    requests.slice(1).map(request => request.path).sort(),
    Object.keys(payloads).sort(),
  );
  for (const request of requests.slice(1)) {
    assert.equal(request.options.method, 'GET');
    assert.equal(request.options.headers.Authorization, 'Bearer bridge-session');
    assert.equal(request.path.includes('?'), false);
  }
});

test('bridge rejects incomplete backend payloads', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async path => path.endsWith('/auth/exchange')
    ? response({activity_session: 'bridge-session', access_token: 'discard-me'})
    : response({ok: true});
  t.after(() => {
    clearActivitySession();
    globalThis.fetch = originalFetch;
  });

  await activityApi.exchange('single-use-code');
  await assert.rejects(
    jarvisBridge.getCurrentUser(),
    error => error instanceof ActivityApiError && error.code === 'invalid_response',
  );
});

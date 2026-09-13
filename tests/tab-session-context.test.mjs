import test from 'node:test';
import assert from 'node:assert/strict';

// Helper to create a clean mock browser environment
function createMockBrowserEnv({ navType = 'navigate', initialSessionStorage = {}, initialLocalStorage = {} } = {}) {
  const sessionStorageMap = new Map(Object.entries(initialSessionStorage));
  const localStorageMap = new Map(Object.entries(initialLocalStorage));
  const broadcastChannels = [];
  const storageListeners = [];

  const mockSessionStorage = {
    getItem: (key) => sessionStorageMap.get(key) ?? null,
    setItem: (key, val) => sessionStorageMap.set(key, String(val)),
    removeItem: (key) => sessionStorageMap.delete(key),
    clear: () => sessionStorageMap.clear(),
  };

  const mockLocalStorage = {
    getItem: (key) => localStorageMap.get(key) ?? null,
    setItem: (key, val) => {
      const oldVal = localStorageMap.get(key) ?? null;
      localStorageMap.set(key, String(val));
      for (const listener of storageListeners) {
        listener({ key, oldValue: oldVal, newValue: String(val) });
      }
    },
    removeItem: (key) => {
      localStorageMap.delete(key);
    },
    clear: () => localStorageMap.clear(),
  };

  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      broadcastChannels.push(this);
    }
    postMessage(data) {
      for (const ch of broadcastChannels) {
        if (ch !== this && ch.name === this.name && ch.onmessage) {
          queueMicrotask(() => {
            if (ch.onmessage) ch.onmessage({ data });
          });
        }
      }
    }
    close() {
      const idx = broadcastChannels.indexOf(this);
      if (idx !== -1) broadcastChannels.splice(idx, 1);
    }
  }

  const mockPerformance = {
    getEntriesByType: (type) => {
      if (type === 'navigation') {
        return [{ type: navType }];
      }
      return [];
    },
    navigation: {
      type: navType === 'reload' ? 1 : 0,
    },
  };

  const windowObj = {
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    addEventListener: (event, listener) => {
      if (event === 'storage') storageListeners.push(listener);
    },
    removeEventListener: (event, listener) => {
      if (event === 'storage') {
        const idx = storageListeners.indexOf(listener);
        if (idx !== -1) storageListeners.splice(idx, 1);
      }
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };

  return {
    window: windowObj,
    performance: mockPerformance,
    BroadcastChannel: MockBroadcastChannel,
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    broadcastChannels,
  };
}

test('isPageReload returns true for reload navigation and false for normal navigation', async () => {
  const reloadEnv = createMockBrowserEnv({ navType: 'reload' });
  globalThis.window = reloadEnv.window;
  globalThis.sessionStorage = reloadEnv.sessionStorage;
  globalThis.localStorage = reloadEnv.localStorage;
  globalThis.performance = reloadEnv.performance;
  globalThis.BroadcastChannel = reloadEnv.BroadcastChannel;

  // Cache-busting import
  const mod = await import(`../patient/src/lib/tab-session-context.ts?test=reload1_${Date.now()}`);
  assert.equal(mod.isPageReload(), true);

  // Switch to normal navigate
  reloadEnv.performance.getEntriesByType = () => [{ type: 'navigate' }];
  assert.equal(mod.isPageReload(), false);
});

test('ensureTabContext on page reload retains existing context without posting claim', async () => {
  const existingContext = 'AbCdEfGhIjKlMnOpQrStUv'; // 22 chars
  const env = createMockBrowserEnv({
    navType: 'reload',
    initialSessionStorage: {
      'medicore.tab-context': existingContext,
      [`medicore.csrf.${existingContext}`]: 'csrf-token-12345',
    },
  });

  globalThis.window = env.window;
  globalThis.sessionStorage = env.sessionStorage;
  globalThis.localStorage = env.localStorage;
  globalThis.performance = env.performance;
  globalThis.BroadcastChannel = env.BroadcastChannel;

  let claimPosted = false;
  const originalPost = env.BroadcastChannel.prototype.postMessage;
  env.BroadcastChannel.prototype.postMessage = function (data) {
    if (data?.type === 'claim') claimPosted = true;
    originalPost.call(this, data);
  };

  const mod = await import(`../patient/src/lib/tab-session-context.ts?test=reload2_${Date.now()}`);
  const resolvedContext = await mod.ensureTabContext();

  assert.equal(resolvedContext, existingContext, 'Context must be preserved on F5 reload');
  assert.equal(claimPosted, false, 'No claim message should be broadcast on reload');
  assert.equal(mod.getCsrfToken(), 'csrf-token-12345', 'CSRF token must be preserved on F5 reload');
});

test('duplicated tab detects taken context and rotates to fresh context, clearing old CSRF', async () => {
  const existingContext = 'OriginalTabContext1234'; // 22 chars
  const env = createMockBrowserEnv({
    navType: 'navigate', // Duplicate tab triggers normal navigation
    initialSessionStorage: {
      'medicore.tab-context': existingContext,
      [`medicore.csrf.${existingContext}`]: 'old-csrf-token',
    },
  });

  globalThis.window = env.window;
  globalThis.sessionStorage = env.sessionStorage;
  globalThis.localStorage = env.localStorage;
  globalThis.performance = env.performance;
  globalThis.BroadcastChannel = env.BroadcastChannel;

  // Simulate original tab listening on BroadcastChannel
  const originalTabChannel = new env.BroadcastChannel('medicore.tab-context.claims');
  originalTabChannel.onmessage = (event) => {
    if (event.data?.type === 'claim' && event.data.context === existingContext) {
      originalTabChannel.postMessage({
        type: 'taken',
        context: existingContext,
        nonce: event.data.nonce,
      });
    }
  };

  const mod = await import(`../patient/src/lib/tab-session-context.ts?test=dup_${Date.now()}`);
  const resolvedContext = await mod.ensureTabContext();

  assert.notEqual(resolvedContext, existingContext, 'Duplicated tab must rotate to a new context');
  assert.equal(resolvedContext.length, 22, 'New context must be 22 base64url characters');
  assert.equal(mod.getCsrfToken(existingContext), null, 'Old context CSRF token must be removed');
  assert.equal(mod.getCsrfToken(), null, 'New context must start with no CSRF token');
});

test('CSRF token is strictly scoped to context and does not leak across contexts', async () => {
  const contextA = 'ContextAlpha1234567890';
  const contextB = 'ContextBeta12345678901';

  const env = createMockBrowserEnv({
    navType: 'reload',
    initialSessionStorage: {
      'medicore.tab-context': contextA,
    },
  });

  globalThis.window = env.window;
  globalThis.sessionStorage = env.sessionStorage;
  globalThis.localStorage = env.localStorage;
  globalThis.performance = env.performance;
  globalThis.BroadcastChannel = env.BroadcastChannel;

  const mod = await import(`../control_center/src/lib/tab-session-context.ts?test=csrf_${Date.now()}`);
  await mod.ensureTabContext();

  mod.setCsrfToken('csrf-token-A', contextA);
  mod.setCsrfToken('csrf-token-B', contextB);

  assert.equal(mod.getCsrfToken(contextA), 'csrf-token-A');
  assert.equal(mod.getCsrfToken(contextB), 'csrf-token-B');

  mod.clearCsrfToken();
  assert.equal(mod.getCsrfToken(contextA), null);
  assert.equal(mod.getCsrfToken(contextB), 'csrf-token-B', 'Clearing context A must not affect context B');
});

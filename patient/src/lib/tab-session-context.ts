const CONTEXT_KEY = 'medicore.tab-context';
const CSRF_KEY_PREFIX = 'medicore.csrf.';
const CHANNEL_NAME = 'medicore.tab-context.claims';
const STORAGE_CLAIM_KEY = 'medicore.tab-context.claim';
const CONTEXT_PATTERN = /^[A-Za-z0-9_-]{22}$/;

type ClaimMessage =
  | { type: 'claim'; context: string; nonce: string }
  | { type: 'taken'; context: string; nonce: string };

let claimPromise: Promise<string> | null = null;
let responder: BroadcastChannel | null = null;
let volatileContext: string | null = null;
let volatileCsrfToken: string | null = null;
let storageResponderInstalled = false;

function randomContext(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function readContext(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(CONTEXT_KEY);
    if (value && CONTEXT_PATTERN.test(value)) return value;
  } catch {
    // sessionStorage can be unavailable in private or embedded browser contexts.
  }
  return volatileContext;
}

function writeContext(context: string): void {
  volatileContext = context;
  try {
    window.sessionStorage.setItem(CONTEXT_KEY, context);
  } catch {
    // Keep this tab's non-secret selector in memory when sessionStorage is unavailable.
  }
}

function csrfKey(context: string): string {
  return `${CSRF_KEY_PREFIX}${context}`;
}

function respondToClaim(message: ClaimMessage): void {
  if (message.type !== 'claim' || message.context !== readContext()) return;
  const response: ClaimMessage = { type: 'taken', context: message.context, nonce: message.nonce };
  responder?.postMessage(response);
  try {
    window.localStorage.setItem(STORAGE_CLAIM_KEY, JSON.stringify(response));
  } catch {
    // BroadcastChannel remains available in most environments where localStorage is blocked.
  }
}

function postStorageMessage(message: ClaimMessage): void {
  try {
    window.localStorage.setItem(STORAGE_CLAIM_KEY, JSON.stringify(message));
  } catch {
    // BroadcastChannel remains available in most environments where localStorage is blocked.
  }
}

function installResponder(): void {
  if (typeof window === 'undefined') return;
  if (!responder && typeof BroadcastChannel !== 'undefined') {
    responder = new BroadcastChannel(CHANNEL_NAME);
    responder.onmessage = (event: MessageEvent<ClaimMessage>) => respondToClaim(event.data);
  }
  if (storageResponderInstalled) return;
  storageResponderInstalled = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_CLAIM_KEY || !event.newValue) return;
    try {
      respondToClaim(JSON.parse(event.newValue) as ClaimMessage);
    } catch {
      // Ignore unrelated or malformed storage events.
    }
  });
}

export function isPageReload(): boolean {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      return (navEntries[0] as PerformanceNavigationTiming).type === 'reload';
    }
    const legacyNav = (performance as unknown as { navigation?: { type?: number } }).navigation;
    return legacyNav?.type === 1;
  } catch {
    return false;
  }
}

export function currentTabContext(): string | null {
  return readContext();
}

export function getCsrfToken(context = readContext()): string | null {
  if (!context || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(csrfKey(context)) ?? volatileCsrfToken;
  } catch {
    return volatileCsrfToken;
  }
}

export function setCsrfToken(token: string | null, context = readContext()): void {
  if (!context || typeof window === 'undefined') return;
  volatileCsrfToken = token;
  try {
    if (token) window.sessionStorage.setItem(csrfKey(context), token);
    else window.sessionStorage.removeItem(csrfKey(context));
  } catch {
    // Keep per-tab CSRF state in memory when sessionStorage is unavailable.
  }
}

export function clearCsrfToken(): void {
  setCsrfToken(null);
}

export function rotateTabContext(): string {
  const previous = readContext();
  if (previous) {
    try {
      window.sessionStorage.removeItem(csrfKey(previous));
    } catch {
      // sessionStorage can be unavailable in private or embedded browser contexts.
    }
  }
  volatileCsrfToken = null;
  const context = randomContext();
  writeContext(context);
  installResponder();
  claimPromise = Promise.resolve(context);
  return context;
}

export function ensureTabContext(): Promise<string> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Tab context requires a browser'));
  if (claimPromise) return claimPromise;

  const existing = readContext();
  if (!existing) {
    const context = rotateTabContext();
    return Promise.resolve(context);
  }

  installResponder();

  if (isPageReload()) {
    claimPromise = Promise.resolve(existing);
    return claimPromise;
  }

  claimPromise = new Promise((resolve) => {
    const nonce = randomContext();
    let settled = false;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
    const finish = (context: string) => {
      if (settled) return;
      settled = true;
      channel?.close();
      resolve(context);
    };
    const onMessage = (message: ClaimMessage) => {
      if (message.type === 'taken' && message.context === existing && message.nonce === nonce) finish(rotateTabContext());
    };
    if (channel) channel.onmessage = (event: MessageEvent<ClaimMessage>) => onMessage(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_CLAIM_KEY || !event.newValue) return;
      try {
        onMessage(JSON.parse(event.newValue) as ClaimMessage);
      } catch {
        // Ignore malformed storage events.
      }
    };
    window.addEventListener('storage', onStorage);
    const close = () => {
      window.removeEventListener('storage', onStorage);
      finish(existing);
    };
    const claim: ClaimMessage = { type: 'claim', context: existing, nonce };
    channel?.postMessage(claim);
    postStorageMessage(claim);
    window.setTimeout(close, 75);
  });
  return claimPromise;
}

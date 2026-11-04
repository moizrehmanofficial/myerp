import { AsyncLocalStorage } from 'async_hooks';

// Lets any service (e.g. audit log) know WHO made the current request,
// from which IP and browser, without passing `req` everywhere.
const storage = new AsyncLocalStorage<{ req: any }>();

export function requestContextMiddleware(req: any, _res: any, next: () => void) {
  storage.run({ req }, next);
}

export function currentRequest(): any {
  return storage.getStore()?.req;
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return ua ? 'Other' : '';
}

function detectDevice(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'Mobile';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux PC';
  return ua ? 'Other' : '';
}

export function requestInfo() {
  const req = currentRequest();
  if (!req) return { ip: null, device: null, browser: null, user: null };
  const ua = String(req.headers?.['user-agent'] || '');
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    device: detectDevice(ua) || null,
    browser: detectBrowser(ua) || null,
    user: req.tenantUser || null,
  };
}
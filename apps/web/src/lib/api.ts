// Thin fetch wrapper: relative /api URLs (works through Vite proxy, the API server, or a Cloudflare tunnel).
// Every request carries the signed session token (`Authorization: Bearer`) issued at sign-in; there is no bare user id.
export class ApiError extends Error {
  constructor(public status: number, public code: string, public params: Record<string, string | number> = {}) {
    super(code);
  }
}
let token: string | null = null;
export const setApiToken = (t: string | null) => { token = t; };
/** The session token (the live event stream passes it as ?token=, since EventSource cannot set headers). */
export const apiToken = () => token;
let onUnauthorized: (() => void) | null = null;
/** Called when the server says the session is no longer valid (expired or forged token): the app signs out. */
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };
// these answer 401/403 for ordinary reasons (wrong password, no app access) and must not sign the current user out
const OWN_AUTH = /^\/api\/(login|verify)\b/;
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'err.network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !OWN_AUTH.test(path)) onUnauthorized?.();
    throw new ApiError(res.status, (data as { code?: string }).code || 'err.server', (data as { params?: Record<string, string | number> }).params || {});
  }
  return data as T;
}

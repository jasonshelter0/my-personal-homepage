export const singleOrigin = () => process.env.SERVE_PUBLIC === 'true';

export function publicOrigin(): string | undefined {
  const value = process.env.PUBLIC_ORIGIN;
  if (!value) return undefined;
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('PUBLIC_ORIGIN must be an http(s) origin without credentials or a path.');
  return url.origin;
}

export function previewBasePath(): string {
  const value = process.env.PREVIEW_BASE_PATH ?? (singleOrigin() ? '/preview' : '');
  if (!value) return '';
  if (
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value) ||
    /^\/(?:admin|api|media|healthz)(?:\/|$)/.test(value)
  )
    throw new Error(
      'PREVIEW_BASE_PATH must be a dedicated absolute path without a trailing slash.',
    );
  return value;
}

export function validateRuntimeConfig() {
  const host = process.env.HOST || '127.0.0.1';
  const origin = publicOrigin();
  previewBasePath();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.ADMIN_PASSWORD)
    throw new Error('Set ADMIN_PASSWORD before binding beyond loopback.');
  if (process.env.NODE_ENV === 'production') {
    const password = process.env.ADMIN_PASSWORD || '';
    if (password.length < 20 || password.length > 1024 || password === 'local-demo-password')
      throw new Error('Production requires an ADMIN_PASSWORD of 20–1024 characters.');
    if (!origin?.startsWith('https://'))
      throw new Error('Production requires an HTTPS PUBLIC_ORIGIN.');
    if (process.env.COOKIE_SECURE !== 'true')
      throw new Error('Production requires COOKIE_SECURE=true.');
    if (!singleOrigin())
      throw new Error('Production requires SERVE_PUBLIC=true for the same-origin gateway.');
  }
}

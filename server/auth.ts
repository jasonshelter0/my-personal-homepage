import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { createSession, validSession, deleteSession, HttpError } from './store.ts';
import { publicOrigin, singleOrigin } from './config.ts';
const password = process.env.ADMIN_PASSWORD || 'local-demo-password';
const salt = randomBytes(32),
  passwordHash = scryptSync(password, salt, 64);
export const localDemo = !process.env.ADMIN_PASSWORD;
export function sessionInfo(req: Request) {
  const host = process.env.PUBLIC_HOST || req.hostname;
  return {
    authenticated: authenticated(req),
    localDemo,
    productionUrl:
      process.env.PRODUCTION_URL ||
      (singleOrigin() ? publicOrigin() : undefined) ||
      `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${process.env.PRODUCTION_PORT || 4323}`,
  };
}
const sessionKey = 'folio_session';
const failures = new Map<string, { attempts: number; until: number }>();
export function cookies(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const cookie of (req.headers.cookie || '').split(';')) {
    const i = cookie.indexOf('=');
    if (i < 0) continue;
    try {
      result[cookie.slice(0, i).trim()] = decodeURIComponent(cookie.slice(i + 1).trim());
    } catch {}
  }
  return result;
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export function authenticated(req: Request): boolean {
  const token = cookies(req)[sessionKey];
  return Boolean(token && /^[a-f0-9]{64}$/.test(token) && validSession(digest(token)));
}
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!authenticated(req)) return next(new HttpError(401, 'Please sign in.'));
  next();
}
export function checkOrigin(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site')
    return next(new HttpError(403, 'Cross-site requests are not allowed.'));
  if (origin) {
    try {
      const expected = process.env.PUBLIC_ORIGIN
        ? new URL(process.env.PUBLIC_ORIGIN).origin
        : `${req.protocol}://${req.headers.host}`;
      if (new URL(origin).origin !== expected)
        return next(new HttpError(403, 'Request origin does not match this editor.'));
    } catch {
      return next(new HttpError(403, 'Invalid origin.'));
    }
  }
  if (req.is('application/json') || req.is('multipart/form-data') || req.method === 'DELETE')
    return next();
  return next(new HttpError(415, 'Use JSON or multipart form data.'));
}
export function login(req: Request, res: Response) {
  const ip = req.ip || 'local',
    now = Date.now(),
    attempt = failures.get(ip);
  if (attempt && attempt.until > now && attempt.attempts >= 8)
    throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
  const candidate = typeof req.body?.password === 'string' ? req.body.password : '';
  if (candidate.length > 1024 || !timingSafeEqual(scryptSync(candidate, salt, 64), passwordHash)) {
    const state =
      attempt && attempt.until > now ? attempt : { attempts: 0, until: now + 15 * 60 * 1000 };
    state.attempts++;
    failures.set(ip, state);
    throw new HttpError(401, 'Incorrect password.');
  }
  failures.delete(ip);
  const token = randomBytes(32).toString('hex');
  const maxAge = 12 * 60 * 60 * 1000;
  createSession(digest(token), now + maxAge);
  res.cookie(sessionKey, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge,
    path: '/',
  });
  res.json({ ...sessionInfo(req), authenticated: true });
}
export function logout(req: Request, res: Response) {
  const token = cookies(req)[sessionKey];
  if (token) deleteSession(digest(token));
  res.clearCookie(sessionKey, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
  });
  res.json({ authenticated: false, localDemo });
}

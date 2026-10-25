import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ZodError } from 'zod';
import { ROOT, DATA_DIR } from '../shared/paths.ts';
import { validateSnapshot } from '../shared/validation.ts';
import { getSnapshot, updateDraft, HttpError, databaseReady } from './store.ts';
import { singleOrigin, publicOrigin, previewBasePath, validateRuntimeConfig } from './config.ts';
import {
  authenticated,
  requireAuth,
  checkOrigin,
  login,
  logout,
  localDemo,
  cookies,
  sessionInfo,
} from './auth.ts';
import { uploadMedia, deleteMedia } from './media.ts';
import { translate, translationStatus, review } from './translation.ts';
import {
  createRelease,
  listReleases,
  publishRelease,
  rollbackRelease,
  getCurrentRelease,
  releaseDirectory,
  previewDirectory,
  markPreviewed,
  initializePublisher,
} from './publisher.ts';
const HOST = process.env.HOST || '127.0.0.1';
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
}
function localHostGuard(req: Request, _res: Response, next: NextFunction) {
  const allowed = ['127.0.0.1', 'localhost', '[::1]', '::1'];
  const origin = publicOrigin();
  if (origin) allowed.push(new URL(origin).hostname);
  if (['127.0.0.1', 'localhost', '::1'].includes(HOST) && !allowed.includes(req.hostname))
    return next(new HttpError(403, 'Unrecognized local hostname.'));
  next();
}
function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  let status = 500,
    message = 'An unexpected server error occurred.';
  let issues: unknown;
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 400;
    message = 'Invalid content format.';
    issues = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (error instanceof multer.MulterError) {
    status = 400;
    message =
      error.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 12 MB.' : error.message;
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    message = 'Invalid JSON.';
  } else if (
    error instanceof Error &&
    'status' in error &&
    Number((error as { status: unknown }).status) >= 400 &&
    Number((error as { status: unknown }).status) < 500
  ) {
    status = Number((error as { status: unknown }).status);
    message = error.message;
  } else console.error(error);
  if (error && typeof error === 'object' && 'issues' in error) issues = error.issues;
  res.status(status).json({ error: message, ...(issues ? { issues } : {}) });
}
function serveWebsite(
  directory: string,
  req: Request,
  res: Response,
  next: NextFunction,
  privatePreview = false,
) {
  return express.static(directory, {
    dotfiles: 'deny',
    index: 'index.html',
    extensions: ['html'],
    setHeaders: (response) => {
      if (privatePreview) response.setHeader('Cache-Control', 'no-store');
    },
  })(req, res, (error) => {
    if (error) return next(error);
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).send('Method not allowed.');
    const locale = req.path.split('/')[1];
    const local404 = ['zh-cn', 'en', 'fr'].includes(locale)
      ? join(directory, locale, '404.html')
      : '';
    const fallback = local404 && existsSync(local404) ? local404 : join(directory, '404.html');
    if (existsSync(fallback)) return res.status(404).sendFile(fallback);
    return res.status(404).send('Page not found.');
  });
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 0 },
});
function recordPreview(req: Request, res: Response, id: string) {
  if (req.method !== 'GET') return;
  res.once('finish', () => {
    if (res.statusCode === 200 && String(res.getHeader('Content-Type')).includes('text/html')) {
      try {
        markPreviewed(id);
      } catch (error) {
        console.error('Could not record preview', error);
      }
    }
  });
}
export function createApplications() {
  const admin = express(),
    preview = express(),
    production = express();
  for (const app of [admin, preview, production]) {
    app.disable('x-powered-by');
    if (singleOrigin()) app.set('trust proxy', 'loopback');
    app.use(securityHeaders, localHostGuard);
  }
  const health = (_req: Request, res: Response) => {
    const current = getCurrentRelease();
    const checks = {
      database: databaseReady(),
      editor: existsSync(join(ROOT, 'apps/admin/dist/index.html')),
      website: Boolean(
        current &&
        ['index.html', 'zh-cn/index.html', 'en/index.html', 'fr/index.html'].every((file) =>
          existsSync(join(releaseDirectory(current.id), file)),
        ),
      ),
    };
    const ready = Object.values(checks).every(Boolean);
    res
      .set('Cache-Control', 'no-store')
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ok' : 'not_ready', checks });
  };
  admin.get('/healthz', health);
  production.get('/healthz', health);
  admin.use((req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/admin/media/') ||
      (!singleOrigin() && req.path.startsWith('/media/'))
    )
      res.set('Cache-Control', 'no-store');
    next();
  });
  admin.use(express.json({ limit: '8mb' }));
  admin.use('/api', checkOrigin);
  admin.get('/api/session', (req, res) => res.json(sessionInfo(req)));
  admin.post('/api/login', login);
  admin.post('/api/logout', requireAuth, logout);
  admin.use('/api', requireAuth);
  admin.get('/api/snapshot', (_req, res) => res.json(getSnapshot()));
  admin.put('/api/snapshot', (req, res) => res.json(updateDraft(req.body)));
  admin.get('/api/validation', (_req, res) =>
    res.json({ issues: validateSnapshot(getSnapshot()) }),
  );
  admin.get('/api/translation/status', (_req, res) => res.json(translationStatus()));
  admin.post('/api/translate', async (req, res) => res.json(await translate(req.body)));
  admin.post('/api/review', (req, res) => res.json(review(req.body)));
  admin.post('/api/media', upload.single('image'), async (req, res) =>
    res.status(201).json(await uploadMedia(req.file)),
  );
  admin.delete('/api/media/:id', async (req, res) =>
    res.json(await deleteMedia(String(req.params.id))),
  );
  admin.get('/api/releases', (_req, res) =>
    res.json({ releases: listReleases(), currentId: getCurrentRelease()?.id ?? null }),
  );
  admin.post('/api/releases', async (_req, res) => {
    const snapshot = getSnapshot(),
      issues = validateSnapshot(snapshot);
    if (issues.length)
      return res.status(422).json({ error: 'Complete the publication checklist first.', issues });
    return res.status(202).json(await createRelease(snapshot));
  });
  admin.post('/api/releases/:id/publish', async (req, res) =>
    res.json(await publishRelease(String(req.params.id))),
  );
  admin.post('/api/releases/:id/rollback', async (req, res) =>
    res.json(await rollbackRelease(String(req.params.id))),
  );
  admin.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const privateMedia = [
    requireAuth,
    express.static(join(DATA_DIR, 'media'), { dotfiles: 'deny' }),
    express.static(join(ROOT, 'apps/site/public/media'), { fallthrough: false, dotfiles: 'deny' }),
  ];
  admin.use('/admin/media', ...privateMedia);
  if (!singleOrigin()) {
    admin.use('/media', ...privateMedia);
    admin.get('/', (_req, res) => res.redirect('/admin/'));
  }
  admin.use('/admin', express.static(join(ROOT, 'apps/admin/dist')));
  admin.use('/admin', (_req, res) => {
    const index = join(ROOT, 'apps/admin/dist/index.html');
    if (existsSync(index)) res.sendFile(index);
    else res.status(503).send('Editor is not built yet. Run npm run build:admin.');
  });
  const prefix = previewBasePath();
  if (prefix) {
    admin.use(
      prefix,
      (_req, res, next) => {
        res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
        next();
      },
      requireAuth,
    );
    admin.use(`${prefix}/:releaseId`, (req, res, next) => {
      const id = String(req.params.releaseId);
      const release = listReleases().find((r) => r.id === id);
      if (!release || !['ready', 'published'].includes(release.status))
        return next(new HttpError(404, 'Preview release is not ready.'));
      const directory = previewDirectory(id);
      if (!existsSync(join(directory, 'index.html')))
        return next(new HttpError(409, 'Create a new preview for this deployment.'));
      recordPreview(req, res, id);
      return serveWebsite(directory, req, res, next, true);
    });
    admin.use(prefix, (_req, res) =>
      res.status(404).send('Select a ready preview from the editor.'),
    );
  }
  preview.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
    next();
  });
  preview.use(requireAuth);
  preview.use((req, res, next) => {
    const selected = req.query.release;
    if (typeof selected === 'string') {
      const release = listReleases().find((r) => r.id === selected);
      if (!release || !['ready', 'published'].includes(release.status))
        return next(new HttpError(404, 'Preview release is not ready.'));
      res.cookie('folio_preview', selected, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.COOKIE_SECURE === 'true',
        path: '/',
      });
      return res.redirect('/');
    }
    const id = cookies(req).folio_preview;
    const release = listReleases().find((r) => r.id === id);
    if (!release || !['ready', 'published'].includes(release.status))
      return res.status(404).send('Select a ready preview from the editor.');
    const directory = releaseDirectory(release.id);
    recordPreview(req, res, release.id);
    return serveWebsite(directory, req, res, next, true);
  });
  preview.use(errorHandler);
  production.use((req, res, next) => {
    const current = getCurrentRelease();
    if (!current)
      return res
        .status(503)
        .send('No website has been published yet. Open the editor to publish the first release.');
    return serveWebsite(releaseDirectory(current.id), req, res, next);
  });
  production.use(errorHandler);
  if (singleOrigin()) admin.use(production);
  admin.use(errorHandler);
  return { admin, preview, production };
}
export function startServers() {
  validateRuntimeConfig();
  initializePublisher();
  const apps = createApplications();
  const ports = {
    admin: Number(process.env.PORT || 4321),
    preview: Number(process.env.PREVIEW_PORT || 4322),
    production: Number(process.env.PRODUCTION_PORT || 4323),
  };
  const activeApps = singleOrigin() ? { admin: apps.admin } : apps;
  const servers = Object.entries(activeApps).map(([name, app]) =>
    app.listen(ports[name as keyof typeof ports], HOST, () =>
      console.log(
        `${name}: http://${HOST}:${ports[name as keyof typeof ports]}${name === 'admin' ? '/admin/' : ''}`,
      ),
    ),
  );
  return servers;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  startServers();

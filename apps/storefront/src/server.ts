import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Generic failure page (Sub-Phase 11.11): static English, zero
 * internals. Served for terminal fallthrough (404) and unexpected
 * failures (500) — crawlers and users never receive framework pages,
 * stack traces, or backend details from this server.
 */
const SAFE_ERROR_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FluxCommerce</title></head><body><h1>Something went wrong.</h1><p>Please try again later.</p></body></html>';

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * API namespace guard (Sub-Phase 11.11).
 *
 * The storefront serves the API base path (`/api`, see
 * `environment.prod.ts`) but owns no API implementation — there is no
 * same-origin proxy in this server. Answering `/api/*` through the
 * Angular pipeline would render application HTML (with a 200 status)
 * for a machine namespace, so the namespace fails fast with a generic
 * JSON 404 carrying no framework, backend, or routing details.
 */
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Final fallthrough (Sub-Phase 11.11).
 *
 * Reached only when no static file matched and the Angular pipeline
 * produced no response. Responds generically — never raw Express
 * framework pages. (Plain `next()` fallthrough skips error-handling
 * middleware by Express design, so this terminal handler stands
 * alongside — not inside — the error handler below.)
 */
app.use((_req, res) => {
  res.status(404);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(SAFE_ERROR_HTML);
});

/**
 * Failure safety net (Sub-Phase 11.11).
 *
 * Unexpected SSR/server failures land here via `next(error)`. They are
 * logged server-side and answered with the same generic page (status
 * 500) instead of the Express development error page — no stack
 * traces, no framework or backend internals ever reach the browser.
 */
app.use(
  (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    console.error(err);
    res.status(500);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(SAFE_ERROR_HTML);
  },
);

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

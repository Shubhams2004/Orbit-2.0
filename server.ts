import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import worker from './worker/index';
import { createLocalD1 } from './worker/d1-adapter';
import { Env } from './worker/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Initialize local SQLite D1 database binding
  const sqliteDbPath = path.resolve(process.cwd(), '.wrangler/state/v3/d1/orbit_local.sqlite');
  const d1 = createLocalD1(sqliteDbPath);

  const env: Env = {
    DB: d1,
    ENVIRONMENT: isProduction ? 'production' : 'development',
    API_VERSION: 'v1',
  };

  // 2. Request body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. API Router mounting the Cloudflare Worker fetch handler
  app.all('/api/*', async (req, res) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || `127.0.0.1:${PORT}`;
      const url = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }
      }

      const init: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (req.body !== undefined && req.body !== null) {
          init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }
      }

      const webRequest = new Request(url, init);
      const webResponse = await worker.fetch(webRequest, env);

      res.status(webResponse.status);
      webResponse.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      const bodyBuffer = Buffer.from(await webResponse.arrayBuffer());
      res.send(bodyBuffer);
    } catch (err: unknown) {
      console.error('[Server API Error]', err);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Internal Server Error',
        },
      });
    }
  });

  // 4. Vite Dev Middleware / Static Production Assets
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Orbit 2.0] Full-Stack server running at http://0.0.0.0:${PORT}`);
    if (!isProduction) {
      console.log('[Orbit 2.0] Note: Local server uses local SQLite D1 adapter. Cloudflare Workers AI binding is unavailable in local development and requires Cloudflare deployment or wrangler dev.');
    }
  });
}

startServer().catch((err) => {
  console.error('[Orbit Server] Fatal startup error:', err);
  process.exit(1);
});

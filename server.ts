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
  // Parse port & host from CLI arguments or environment
  // In Cloud Run / container environment, process.env.PORT is 8080 (used by Nginx frontend proxy).
  // The Node.js Express dev server must listen on port 3000 (as required by control plane and proxied by Nginx).
  let port = 3000;
  const portIndex = process.argv.indexOf('--port');
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    const parsed = Number(process.argv[portIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) port = parsed;
  } else if (process.env.APP_PORT) {
    port = Number(process.env.APP_PORT);
  } else if (process.env.PORT && process.env.PORT !== '8080') {
    const parsed = Number(process.env.PORT);
    if (!isNaN(parsed) && parsed > 0) port = parsed;
  }
  const PORT = port;

  let host = '0.0.0.0';
  const hostIndex = process.argv.indexOf('--host');
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    host = process.argv[hostIndex + 1];
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Initialize local SQLite D1 database binding
  const sqliteDbPath = path.resolve(process.cwd(), '.wrangler/state/v3/d1/orbit_local.sqlite');
  const d1 = createLocalD1(sqliteDbPath);

  const env: Env = {
    DB: d1,
    ENVIRONMENT: isProduction ? 'production' : 'development',
    API_VERSION: 'v1',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'orbit-2-auth',
    ALLOW_DEV_TOKENS: process.env.ALLOW_DEV_TOKENS || (isProduction ? 'false' : 'true'),
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    TAVILY_BASE_URL: process.env.TAVILY_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };

  // 2. Request body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. API Router mounting the Cloudflare Worker fetch handler
  app.all('/api/*', async (req, res) => {
    const reqAbortController = new AbortController();
    let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    res.on('close', () => {
      if (!res.writableEnded) {
        reqAbortController.abort();
        if (streamReader) {
          streamReader.cancel().catch(() => {});
        }
      }
    });

    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const requestHost = req.get('host') || `127.0.0.1:${PORT}`;
      const url = `${protocol}://${requestHost}${req.originalUrl}`;

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
        signal: reqAbortController.signal,
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

      const contentType = webResponse.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && webResponse.body) {
        res.flushHeaders();
        streamReader = webResponse.body.getReader();
        try {
          while (!res.writableEnded) {
            const { done, value } = await streamReader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
              res.write(Buffer.from(value));
            }
          }
        } finally {
          if (!res.writableEnded) {
            res.end();
          }
        }
        return;
      }

      const bodyBuffer = Buffer.from(await webResponse.arrayBuffer());
      res.send(bodyBuffer);
    } catch (err: unknown) {
      if (reqAbortController.signal.aborted && res.writableEnded) {
        return;
      }
      console.error('[Server API Error]', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err instanceof Error ? err.message : 'Internal Server Error',
          },
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // 4. Vite Dev Middleware / Static Production Assets
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
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

  const server = app.listen(PORT, host, () => {
    console.log(`[Orbit 2.0] Full-Stack server running at http://${host}:${PORT}`);
    if (!isProduction) {
      console.log('[Orbit 2.0] Note: Local server uses local SQLite D1 adapter. Cloudflare Workers AI binding is unavailable in local development and requires Cloudflare deployment or wrangler dev.');
    }
  });

  server.on('error', (err: any) => {
    console.error('[Orbit Server] Server error:', err);
  });
}

startServer().catch((err) => {
  console.error('[Orbit Server] Fatal startup error:', err);
  process.exit(1);
});

import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Local `npm run dev` only: serves the Vercel functions in /api (GET/POST exports) so the
 * real-data screens work on localhost. Keys come from `.env.local` (never committed).
 * Production on Vercel runs the same files as serverless functions; this plugin is not used there.
 */
function vercelApiInDev(): Plugin {
  let server: ViteDevServer;
  return {
    name: 'vercel-api-in-dev',
    apply: 'serve',
    configureServer(s) {
      server = s;
      s.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const m = /^\/api\/([a-z0-9-]+)\/?$/.exec(url.pathname);
        const file = m && fileURLToPath(new URL(`./api/${m[1]}.ts`, import.meta.url));
        if (!m || !file || !existsSync(file)) return next();
        try {
          const mod = (await server.ssrLoadModule(file)) as Record<string, ((r: Request) => Promise<Response>) | undefined>;
          const handler = mod[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers(Object.entries(req.headers).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as [string, string]] : [])));
          const out = await handler(new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }));
          res.statusCode = out.status;
          out.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await out.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(`[api] ${(e as Error).stack ?? e}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'SERVER_ERROR', message: '로컬 API 실행 중 오류가 발생했습니다.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-side env for the local API (all keys, not only VITE_*); the browser bundle never sees these.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) if (process.env[k] === undefined) process.env[k] = v;
  return {
    plugins: [react(), tailwindcss(), vercelApiInDev()],
    build: { chunkSizeWarningLimit: 700 },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  };
});

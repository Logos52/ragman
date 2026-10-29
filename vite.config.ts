import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Tiny local data server, built into the dev server.
 * Serves the private ragman-data clone at /data/* so the app never bundles real data.
 *   GET  /data/inventory.json            the live file
 *   PUT  /data/inventory.json            atomic write (tmp + rename)
 *   GET  /data/images/<path>             item images
 *   PUT  /data/images/<path>             save a pasted screenshot (raw body)
 * Point RAGMAN_DATA at the clone; default is ../ragman-data beside this repo.
 */
function dataServer(): Plugin {
  const root = resolve(here, process.env.RAGMAN_DATA ?? '../ragman-data');
  const mime: Record<string, string> = {
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  };
  return {
    name: 'ragman-data-server',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        let url: string;
        try { url = decodeURIComponent((req.url ?? '/').split('?')[0]); }
        catch { res.statusCode = 400; res.end('bad request'); return; } // malformed percent-escape
        const rel = normalize(url).replace(/^[/\\]+/, '');
        const lc = rel.toLowerCase(); // Windows paths ignore case, so the guard must too
        if (lc.includes('..') || lc.includes('prices')) { res.statusCode = 403; res.end('forbidden'); return; }
        const file = join(root, rel);
        const ok = rel === 'inventory.json' || rel.startsWith('images/') || rel.startsWith('images\\');
        if (!ok) { res.statusCode = 404; res.end('not found'); return; }
        if (req.method === 'GET' || req.method === 'HEAD') {
          if (!existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; res.end('not found'); return; }
          res.setHeader('Content-Type', mime[extname(file).toLowerCase()] ?? 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          if (req.method === 'HEAD') { res.end(); return; }
          createReadStream(file).pipe(res);
          return;
        }
        if (req.method === 'PUT') {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            try {
              mkdirSync(dirname(file), { recursive: true });
              const tmp = file + '.tmp';
              writeFileSync(tmp, Buffer.concat(chunks));
              renameSync(tmp, file);
              res.statusCode = 204; res.end();
            } catch (e) { res.statusCode = 500; res.end(String(e)); }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dataServer()],
  resolve: { alias: { '@': resolve(here, 'src') } },
  server: { port: 5173, strictPort: false },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{ts,tsx}'] },
} as any);

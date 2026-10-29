// Tiny local server for a production private build.
// Serves dist/ and the ragman-data clone at /data/* with the same GET/PUT contract as the Vite plugin.
// Usage: RAGMAN_DATA=../ragman-data node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist');
const data = resolve(here, '..', process.env.RAGMAN_DATA ?? '../ragman-data');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};

function send(res, file) {
  if (!existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; res.end('not found'); return; }
  res.setHeader('Content-Type', mime[extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url ?? '/').split('?')[0]); }
  catch { res.statusCode = 400; res.end('bad request'); return; } // malformed percent-escape: refuse, never crash
  if (url.startsWith('/data/')) {
    const rel = normalize(url.slice(6)).replace(/^([/\\])+/, '');
    const lc = rel.toLowerCase(); // Windows paths ignore case, so the guard must too
    if (lc.includes('..') || lc.includes('prices')) { res.statusCode = 403; res.end('forbidden'); return; }
    const ok = rel === 'inventory.json' || rel.startsWith('images/') || rel.startsWith('images\\');
    if (!ok) { res.statusCode = 404; res.end('not found'); return; }
    const file = join(data, rel);
    if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file + '.tmp', Buffer.concat(chunks));
          renameSync(file + '.tmp', file);
          res.statusCode = 204; res.end();
        } catch (e) { res.statusCode = 500; res.end(String(e)); }
      });
      return;
    }
    send(res, file);
    return;
  }
  const rel = normalize(url).replace(/^([/\\])+/, '');
  const file = join(dist, rel || 'index.html');
  if (existsSync(file) && !statSync(file).isDirectory()) send(res, file);
  else send(res, join(dist, 'index.html'));
}).listen(port, () => console.log(`Inventory at http://localhost:${port}  data: ${data}`));

/**
 * Data sources and the background saver.
 *   server : GET/PUT `${base}/inventory.json`, PUT `${base}/images/<path>` (vite.config.ts / scripts/serve.mjs)
 *   folder : File System Access API on the ragman-data clone; the handle is kept in IndexedDB so a reload
 *            can re-request permission with one click
 *   bundled: public build (VITE_BUILD === 'public'), frozen demo JSON, never saved
 * Saves are debounced (500 ms), coalesced and sequential: never two writes in flight.
 */
import type { DataSource, Inventory, SaveState } from './types';
import { detectEol, serializeInventory, type Eol } from './engine/strip';
import { fileFromDir } from './engine/images';

export const SERVER_BASE = '/data';
export const IS_PUBLIC = import.meta.env.VITE_BUILD === 'public';

/* ---------------- loading ---------------- */

/** A loaded file and its line ending (saves keep it). */
export interface Loaded { inv: Inventory; eol: Eol }

function parse(text: string): Loaded {
  try { return { inv: JSON.parse(text) as Inventory, eol: detectEol(text) }; }
  catch (e) { throw new Error(`inventory.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`); }
}

/** null when the server is not there (404 or network error). Throws when the file is there but unreadable. */
export async function loadServer(base = SERVER_BASE): Promise<Loaded | null> {
  let res: Response;
  try { res = await fetch(`${base}/inventory.json`, { cache: 'no-store' }); } catch { return null; }
  if (!res.ok) return null;
  const text = await res.text();
  // The SPA fallback of some servers answers 200 with index.html: treat that as "no server", not as bad data.
  if (/^\s*</.test(text)) return null;
  return parse(text);
}

export async function loadFolder(handle: FileSystemDirectoryHandle): Promise<Loaded> {
  const f = await fileFromDir(handle, 'inventory.json');
  if (!f) throw new Error('inventory.json not found in the chosen folder');
  return parse(await f.text());
}

export async function loadBundled(): Promise<Loaded> {
  const mod = (await import('../../data/demo/inventory.json')) as { default: unknown };
  return { inv: structuredClone(mod.default) as Inventory, eol: '\n' };
}

/** Built URLs of the public demo images, keyed by path below images/ (empty when there are none). */
export function bundledImageUrls(): Record<string, string> {
  const files = import.meta.glob('../../data/demo/images/**/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) out[k.replace(/^.*\/data\/demo\/images\//, '')] = v;
  return out;
}

/* ---------------- writing ---------------- */

export async function writeInventory(source: DataSource, text: string): Promise<void> {
  if (source.kind === 'bundled') return; // the public build never saves
  if (source.kind === 'server') {
    const res = await fetch(`${source.base}/inventory.json`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: text,
    });
    if (!res.ok) throw new Error(`save failed: HTTP ${res.status}`);
    return;
  }
  await writeFileAt(source.handle, 'inventory.json', text);
}

async function writeFileAt(dir: FileSystemDirectoryHandle, relPath: string, data: string | Blob): Promise<void> {
  const parts = relPath.split('/').filter(Boolean);
  let d = dir;
  for (const seg of parts.slice(0, -1)) d = await d.getDirectoryHandle(seg, { create: true });
  const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

/** Save a pasted image below images/. Returns relPath. The bundled source keeps it in memory only. */
export async function saveImage(source: DataSource, relPath: string, blob: Blob): Promise<string> {
  if (relPath.includes('..')) throw new Error('bad image path');
  if (source.kind === 'server') {
    const url = `${source.base}/images/${relPath.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, { method: 'PUT', body: blob });
    if (!res.ok) throw new Error(`image save failed: HTTP ${res.status}`);
  } else if (source.kind === 'folder') {
    await writeFileAt(source.handle, `images/${relPath}`, blob);
  }
  return relPath;
}

/* ---------------- debounced, sequential saver ---------------- */

export class Saver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private rerun = false;
  private running: Promise<void> | null = null;

  constructor(
    private readonly write: (text: string) => Promise<void>,
    private readonly snapshot: () => Inventory | null,
    private readonly onState: (s: SaveState, error: string | null) => void,
    private readonly delay = 500,
    private readonly eol: Eol = '\n',
  ) {}

  /** A mutation happened: mark dirty and (re)start the debounce. */
  schedule(): void {
    this.dirty = true;
    this.onState('dirty', null);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }

  /** Write now (also the retry). Resolves when nothing is left to write or a write failed. */
  flush(force = false): Promise<void> {
    if (force) this.dirty = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.running) { this.rerun = true; return this.running; }
    const run = async () => {
      do {
        this.rerun = false;
        if (!this.dirty) break;
        this.dirty = false;
        const inv = this.snapshot();
        if (!inv) break;
        this.onState('saving', null);
        try { await this.write(serializeInventory(inv, this.eol)); }
        catch (e) { this.dirty = true; this.onState('error', e instanceof Error ? e.message : String(e)); return; }
      } while (this.rerun);
      this.onState(this.dirty ? 'dirty' : 'saved', null);
    };
    this.running = run().finally(() => { this.running = null; });
    return this.running;
  }

  cancel(): void { if (this.timer) clearTimeout(this.timer); this.timer = null; this.dirty = false; }
}

/* ---------------- folder handle memory (tiny hand-rolled idb-keyval) ---------------- */

const DB = 'ragman', STORE = 'kv', HANDLE_KEY = 'folder-handle';

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

export async function rememberHandle(h: FileSystemDirectoryHandle): Promise<void> {
  try { await idb('readwrite', (s) => s.put(h, HANDLE_KEY)); } catch { /* not fatal */ }
}

export async function recallHandle(): Promise<FileSystemDirectoryHandle | null> {
  try { return ((await idb('readonly', (s) => s.get(HANDLE_KEY))) as FileSystemDirectoryHandle | undefined) ?? null; }
  catch { return null; }
}

/* The permission and picker APIs are not in lib.dom yet. */
type PermHandle = FileSystemDirectoryHandle & {
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
};

/** Ask (or with `request`, prompt) for readwrite access to a remembered handle. */
export async function hasPermission(h: FileSystemDirectoryHandle, request: boolean): Promise<boolean> {
  const p = h as PermHandle;
  try {
    if ((await p.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
    return request && (await p.requestPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch { return false; }
}

export function canPickFolder(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  const w = window as unknown as { showDirectoryPicker(o?: { mode?: 'readwrite'; id?: string }): Promise<FileSystemDirectoryHandle> };
  return w.showDirectoryPicker({ mode: 'readwrite', id: 'ragman-data' });
}

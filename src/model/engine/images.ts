/**
 * Image resolution. Cell art: icon -> grok -> photo -> null (the UI draws a grey placeholder with the name).
 * Inspect photo: photo -> null. Avatar layer: worn -> null. Never another item's image.
 * URLs: server source `${base}/images/<path>`; bundled source: the build's own asset URL for that file
 * (import.meta.glob map, see persist.ts) else `${base}/images/<path>`; folder source: an object URL per path,
 * read lazily from the directory handle and cached (null until it has loaded, then onChange fires).
 */
import type { DataSource, Item } from '../types';

export type ImageKind = 'cell' | 'photo' | 'worn';
export const AVATAR_PATH = 'avatar/base.png';

export function imagePath(item: Item | undefined, kind: ImageKind): string | null {
  const im = item?.images;
  if (!im) return null;
  if (kind === 'cell') return im.icon || im.grok || im.photo || null;
  if (kind === 'photo') return im.photo || null;
  return im.worn || null;
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/** Read a file below a directory handle by a slash path; null when any part is missing. */
export async function fileFromDir(dir: FileSystemDirectoryHandle, relPath: string): Promise<File | null> {
  try {
    const parts = relPath.split('/').filter(Boolean);
    let d = dir;
    for (const seg of parts.slice(0, -1)) d = await d.getDirectoryHandle(seg);
    return await (await d.getFileHandle(parts[parts.length - 1])).getFile();
  } catch { return null; }
}

export interface ResolverOpts {
  /** bundled source: images/<path> -> built asset URL. */
  bundledUrls?: Record<string, string>;
  /** bundled source: base used when a path is not in bundledUrls. */
  bundledBase?: string;
  /** called when a lazily loaded image (folder source) or the avatar probe finishes. */
  onChange?: () => void;
}

export class ImageResolver {
  private objectUrls = new Map<string, string | null>(); // folder source: path -> object URL (null = missing)
  private loading = new Set<string>();
  private versions = new Map<string, number>();          // server source: cache-bust after a save
  private avatar: string | null | undefined;              // undefined = not probed yet

  constructor(private readonly source: DataSource, private readonly opts: ResolverOpts = {}) {}

  url(path: string | null): string | null {
    if (!path) return null;
    const s = this.source;
    if (s.kind === 'folder') {
      if (this.objectUrls.has(path)) return this.objectUrls.get(path) ?? null;
      if (!this.loading.has(path)) {
        this.loading.add(path);
        void fileFromDir(s.handle, `images/${path}`).then((f) => {
          this.objectUrls.set(path, f ? URL.createObjectURL(f) : null);
          this.loading.delete(path);
          this.opts.onChange?.();
        });
      }
      return null;
    }
    if (s.kind === 'bundled') {
      const built = this.opts.bundledUrls?.[path];
      if (built) return built;
      return `${this.opts.bundledBase ?? ''}/images/${encodePath(path)}`;
    }
    const v = this.versions.get(path);
    return `${s.base}/images/${encodePath(path)}${v ? `?v=${v}` : ''}`;
  }

  /** A freshly saved image: show it right away without a reload. */
  register(path: string, blob: Blob): void {
    if (this.source.kind === 'server') { this.versions.set(path, Date.now()); return; }
    const old = this.objectUrls.get(path);
    if (old) URL.revokeObjectURL(old);
    this.objectUrls.set(path, URL.createObjectURL(blob));
    this.opts.onChange?.();
  }

  /** Probe images/avatar/base.png once; the answer is cached. */
  async probeAvatar(): Promise<string | null> {
    if (this.avatar !== undefined) return this.avatar;
    const s = this.source;
    let found: string | null = null;
    if (s.kind === 'server') {
      const u = `${s.base}/images/${AVATAR_PATH}`;
      try { found = (await fetch(u, { method: 'HEAD' })).ok ? u : null; } catch { found = null; }
    } else if (s.kind === 'folder') {
      const f = await fileFromDir(s.handle, `images/${AVATAR_PATH}`);
      found = f ? URL.createObjectURL(f) : null;
    } else {
      found = this.opts.bundledUrls?.[AVATAR_PATH] ?? null;
    }
    this.avatar = found;
    this.opts.onChange?.();
    return found;
  }

  /** null until probed, then the cached answer. */
  avatarUrl(): string | null { return this.avatar ?? null; }

  dispose(): void {
    for (const u of this.objectUrls.values()) if (u) URL.revokeObjectURL(u);
    this.objectUrls.clear();
  }
}

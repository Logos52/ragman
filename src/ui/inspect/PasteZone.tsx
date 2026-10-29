import { useEffect, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';

export interface PasteZoneProps {
  /** Current photo URL (the saved one), shown until a new image is pasted. */
  currentUrl: string | null;
  name: string;
  /** The pasted/dropped image, held until Save. */
  blob: Blob | null;
  onBlob: (b: Blob) => void;
}

function imageFrom(items: DataTransferItemList | null, files: FileList | null): Blob | null {
  if (items) {
    for (const it of Array.from(items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) return f; }
    }
  }
  if (files) for (const f of Array.from(files)) if (f.type.startsWith('image/')) return f;
  return null;
}

/** A focusable box: paste a screenshot (Ctrl-V) or drop an image file. Preview shown. */
export function PasteZone({ currentUrl, name, blob, onBlob }: PasteZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!blob) { setPreview(null); return; }
    const u = URL.createObjectURL(blob);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  useEffect(() => setBroken(false), [currentUrl]);

  const onPaste = (e: ClipboardEvent) => {
    const b = imageFrom(e.clipboardData.items, e.clipboardData.files);
    if (b) { e.preventDefault(); onBlob(b); }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const b = imageFrom(e.dataTransfer.items, e.dataTransfer.files);
    if (b) onBlob(b);
  };
  const url = preview ?? (broken ? null : currentUrl);

  return (
    <div
      className={over ? 'rg-paste rg-paste--over' : 'rg-paste'}
      tabIndex={0}
      role="button"
      aria-label="Photo: paste an image or drop a file"
      onPaste={onPaste}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="rg-insp__photo">
        {url
          ? <img src={url} alt="" onError={() => { if (!preview) setBroken(true); }} />
          : <div className="rg-insp__ph"><span>{name}</span></div>}
      </div>
      <div className="rg-paste__hint">
        {blob ? 'New photo · saves with the item' : 'Click here, then paste a screenshot, or drop an image'}
      </div>
    </div>
  );
}

/** Undo: a ring buffer of the last N snapshots (structuredClone, so later mutation can never reach them). */
export class UndoRing<T> {
  private buf: (T | undefined)[];
  private head = 0; // next write index
  private size = 0;

  constructor(private readonly cap = 10) { this.buf = new Array(cap); }

  push(snapshot: T): void {
    this.buf[this.head] = structuredClone(snapshot);
    this.head = (this.head + 1) % this.cap;
    this.size = Math.min(this.size + 1, this.cap);
  }

  /** The most recent snapshot, removed from the ring; undefined when empty. */
  pop(): T | undefined {
    if (this.size === 0) return undefined;
    this.head = (this.head - 1 + this.cap) % this.cap;
    const s = this.buf[this.head];
    this.buf[this.head] = undefined;
    this.size--;
    return s;
  }

  get depth(): number { return this.size; }

  clear(): void { this.buf = new Array(this.cap); this.head = 0; this.size = 0; }
}

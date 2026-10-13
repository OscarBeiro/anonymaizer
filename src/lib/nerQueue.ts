/** Keep an in-flight model download alive and scan the newest request next. */
export class NerQueue<T> {
  private revision = 0;
  private pending: { value: T; revision: number } | undefined;
  private running = false;

  private readonly scan: (value: T, isCurrent: () => boolean) => Promise<void>;

  constructor(scan: (value: T, isCurrent: () => boolean) => Promise<void>) {
    this.scan = scan;
  }

  submit(value: T): void {
    this.pending = { value, revision: ++this.revision };
    void this.drain();
  }

  invalidate(): void {
    this.revision++;
    this.pending = undefined;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending) {
        const request = this.pending;
        this.pending = undefined;
        try {
          await this.scan(request.value, () => request.revision === this.revision);
        } catch {
          // The scan reports its own error; newer requests must still run.
        }
      }
    } finally {
      this.running = false;
    }
  }
}

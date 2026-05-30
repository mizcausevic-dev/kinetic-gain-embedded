// sinks.ts — Two reference sinks shipped with the SDK.
//
// Production embedders almost always wire their own sink (Kafka, Kinesis,
// Loki, an HTTP endpoint, a managed log service). These two are here so the
// SDK works out of the box for tests, local dev, and small-scale deployments.

import { appendFileSync } from "node:fs";
import type { AuditEvent, AuditSink } from "./types.js";

/** In-memory sink. Useful for tests and short-lived processes. */
export class InMemorySink implements AuditSink {
  readonly events: AuditEvent[] = [];

  write(event: AuditEvent): void {
    this.events.push(event);
  }

  /** Returns a copy. */
  snapshot(): AuditEvent[] {
    return this.events.slice();
  }
}

/** NDJSON file sink — appends one canonical-JSON event per line.
 * Synchronous fs.appendFileSync because audit emission MUST NOT silently fail
 * — a hung promise rejection is much worse than a thrown sync error the
 * embedder can catch. For high-volume cases, batch + flush via your own sink. */
export class NdjsonFileSink implements AuditSink {
  constructor(private readonly path: string) {}

  write(event: AuditEvent): void {
    appendFileSync(this.path, JSON.stringify(event) + "\n", "utf8");
  }
}

/** HTTP POST sink — POSTs each event to a URL. The embedder's endpoint is
 * expected to durably persist before returning 2xx. */
export class HttpSink implements AuditSink {
  constructor(
    private readonly url: string,
    private readonly opts: { headers?: Record<string, string>; fetch?: typeof fetch } = {}
  ) {}

  async write(event: AuditEvent): Promise<void> {
    const fetchImpl = this.opts.fetch ?? fetch;
    const res = await fetchImpl(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.opts.headers },
      body: JSON.stringify(event)
    });
    if (!res.ok) throw new Error(`HttpSink: ${this.url} returned ${res.status}`);
  }
}

/** Compose multiple sinks: writes to all in parallel; collects errors. */
export class TeeSink implements AuditSink {
  constructor(private readonly sinks: AuditSink[]) {}

  async write(event: AuditEvent): Promise<void> {
    const results = await Promise.allSettled(this.sinks.map((s) => s.write(event)));
    const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (errors.length > 0) {
      throw new AggregateError(errors.map((e) => e.reason), `TeeSink: ${errors.length}/${this.sinks.length} sinks failed`);
    }
  }

  async flush(): Promise<void> {
    await Promise.all(this.sinks.map((s) => s.flush?.()));
  }
}

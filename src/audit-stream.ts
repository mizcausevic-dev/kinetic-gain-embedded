// audit-stream.ts — The AuditStream: hash-chained emitter with pluggable sink
// and optional ed25519 signing.
//
// Usage:
//   const audit = new AuditStream({
//     source: "rag-pipeline-prod",
//     decisionCardRef: "https://buyer.example/.well-known/decisions/D-001.json",
//     sink: new NdjsonFileSink("./audit.ndjson"),
//   });
//
//   await audit.emit({
//     kind: "rag.document.indexed",
//     redaction_applied: vaultResult.redactionApplied,
//     payload: { document_id: "doc-001" }
//   });
//
// Hash invariants enforced on every emit:
//   1. prev_hash chains from the previous event's hash (genesis = 64 zeros)
//   2. hash = sha256(canonical_json(event - {hash, signature}))
//   3. Optional signature is computed over the same canonical body the hash covers

import { canonicalize, canonicalHash, GENESIS_PREV_HASH } from "./canonical.js";
import { uuidv7 } from "./uuid.js";
import type {
  AuditEvent,
  AuditEventSigner,
  AuditSink,
  AuditStreamOptions,
  RedactionApplied
} from "./types.js";

export interface EmitInput {
  /** Event kind — namespaced string. Required. */
  kind: string;
  /** Optional override for source (defaults to AuditStream's source). */
  source?: string;
  /** Optional fields that were redacted before this event. */
  redaction_applied?: RedactionApplied[];
  /** Any additional vertical-specific fields to attach. */
  [extra: string]: unknown;
}

export class AuditStream {
  readonly source: string;
  readonly decisionCardRef: string;
  private readonly sink: AuditSink;
  private readonly signer: AuditEventSigner | undefined;
  private readonly now: () => Date;
  private readonly newEventId: () => string;
  private prevHash: string = GENESIS_PREV_HASH;
  private count = 0;

  constructor(opts: AuditStreamOptions) {
    if (!opts.source) throw new Error("AuditStream: source required");
    if (!opts.decisionCardRef) throw new Error("AuditStream: decisionCardRef required");
    if (!opts.sink) throw new Error("AuditStream: sink required");
    this.source = opts.source;
    this.decisionCardRef = opts.decisionCardRef;
    this.sink = opts.sink;
    this.signer = opts.signer;
    this.now = opts.now ?? (() => new Date());
    this.newEventId = opts.newEventId ?? uuidv7;
  }

  /** Returns the hash of the last emitted event (or the genesis hash if none). */
  get lastHash(): string {
    return this.prevHash;
  }

  /** Returns how many events have been emitted so far. */
  get eventCount(): number {
    return this.count;
  }

  /** Emit a new event. Hash-chains it, optionally signs it, writes to the sink.
   * Returns the fully populated event. */
  async emit(input: EmitInput): Promise<AuditEvent> {
    if (!input.kind) throw new Error("AuditStream.emit: kind required");

    const { kind, source, redaction_applied, ...extra } = input;
    const event: AuditEvent = {
      event_id: this.newEventId(),
      timestamp: this.now().toISOString(),
      kind,
      source: source ?? this.source,
      decision_card_ref: this.decisionCardRef,
      prev_hash: this.prevHash,
      hash: "" // populated below
    };
    if (redaction_applied && redaction_applied.length > 0) {
      event.redaction_applied = redaction_applied;
    } else if (redaction_applied) {
      // Empty array — still attach to surface "vault contract considered, no matches"
      event.redaction_applied = [];
    }
    // Attach any extra vertical-specific fields
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) event[k] = v;
    }

    // Compute hash over body excluding `hash` and `signature` so the chain
    // links cleanly whether or not the embedder enables signing.
    const { hash: _h, signature: _s, ...body } = event;
    const eventHash = canonicalHash(body);
    event.hash = eventHash;
    this.prevHash = eventHash;
    this.count += 1;

    // Sign over the SAME canonical body the hash covers, NOT including the hash
    // itself (so the signature is independent of the hash and an auditor can
    // verify either independently).
    if (this.signer) {
      const sigValue = await this.signer.sign(canonicalize(body));
      event.signature = { alg: "ed25519", value: sigValue, key_uri: this.signer.keyUri };
    }

    await this.sink.write(event);
    return event;
  }

  /** Flush the sink, if it supports flushing. */
  async flush(): Promise<void> {
    if (this.sink.flush) await this.sink.flush();
  }
}

/** Verify a hash chain. Returns the first break (or null if the chain is intact). */
export function verifyChain(events: AuditEvent[]): { ok: boolean; firstBreakAt: number | null; reason?: string } {
  let prev = GENESIS_PREV_HASH;
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.prev_hash !== prev) {
      return { ok: false, firstBreakAt: i, reason: `prev_hash=${event.prev_hash} expected=${prev}` };
    }
    const { hash, signature: _s, ...body } = event;
    const recomputed = canonicalHash(body);
    if (recomputed !== hash) {
      return { ok: false, firstBreakAt: i, reason: `hash=${hash} recomputed=${recomputed}` };
    }
    prev = hash;
  }
  return { ok: true, firstBreakAt: null };
}

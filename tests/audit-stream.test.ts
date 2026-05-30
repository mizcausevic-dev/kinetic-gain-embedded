// audit-stream.test.ts — Hash-chained emitter + verifyChain.

import { describe, test, expect, beforeEach } from "vitest";
import { AuditStream, verifyChain } from "../src/audit-stream.js";
import { InMemorySink } from "../src/sinks.js";
import { GENESIS_PREV_HASH, canonicalHash } from "../src/canonical.js";
import type { AuditEvent } from "../src/types.js";

describe("AuditStream", () => {
  let sink: InMemorySink;
  let audit: AuditStream;
  let counter = 0;

  beforeEach(() => {
    sink = new InMemorySink();
    counter = 0;
    audit = new AuditStream({
      source: "test-source-prod",
      decisionCardRef: "https://buyer.example/.well-known/decisions/D-TEST.json",
      sink,
      now: () => new Date("2026-05-30T00:00:00Z"),
      newEventId: () => `evt-${(++counter).toString().padStart(4, "0")}`
    });
  });

  test("rejects construction without required options", () => {
    expect(() => new AuditStream({ source: "", decisionCardRef: "x", sink })).toThrow(/source/);
    expect(() => new AuditStream({ source: "x", decisionCardRef: "", sink })).toThrow(/decisionCardRef/);
    // @ts-expect-error — testing runtime guard
    expect(() => new AuditStream({ source: "x", decisionCardRef: "y" })).toThrow(/sink/);
  });

  test("first event chains from genesis prev_hash", async () => {
    await audit.emit({ kind: "test.event" });
    expect(sink.events[0]!.prev_hash).toBe(GENESIS_PREV_HASH);
  });

  test("subsequent events chain prev_hash → previous hash", async () => {
    const a = await audit.emit({ kind: "test.event.a" });
    const b = await audit.emit({ kind: "test.event.b" });
    const c = await audit.emit({ kind: "test.event.c" });
    expect(b.prev_hash).toBe(a.hash);
    expect(c.prev_hash).toBe(b.hash);
  });

  test("hash equals canonicalHash(event - {hash,signature})", async () => {
    const event = await audit.emit({ kind: "test.recompute" });
    const { hash, signature: _s, ...body } = event;
    expect(hash).toBe(canonicalHash(body));
  });

  test("emit attaches extra fields verbatim", async () => {
    const event = await audit.emit({ kind: "rag.indexed", document_id: "doc-001", chunk_count: 5 });
    expect(event.document_id).toBe("doc-001");
    expect(event.chunk_count).toBe(5);
  });

  test("emit attaches redaction_applied when provided non-empty", async () => {
    const event = await audit.emit({
      kind: "data.processed",
      redaction_applied: [{ field: "customer.email", action: "mask" }]
    });
    expect(event.redaction_applied).toEqual([{ field: "customer.email", action: "mask" }]);
  });

  test("emit attaches empty redaction_applied when an empty array is explicitly passed (auditable shape)", async () => {
    const event = await audit.emit({ kind: "data.processed", redaction_applied: [] });
    expect(event.redaction_applied).toEqual([]);
  });

  test("omits redaction_applied entirely when caller passes nothing", async () => {
    const event = await audit.emit({ kind: "data.processed" });
    expect("redaction_applied" in event).toBe(false);
  });

  test("source can be overridden per-event", async () => {
    const event = await audit.emit({ kind: "x", source: "other-source-stg" });
    expect(event.source).toBe("other-source-stg");
  });

  test("lastHash + eventCount track state", async () => {
    expect(audit.lastHash).toBe(GENESIS_PREV_HASH);
    expect(audit.eventCount).toBe(0);
    const a = await audit.emit({ kind: "x" });
    expect(audit.lastHash).toBe(a.hash);
    expect(audit.eventCount).toBe(1);
  });

  test("rejects emit without kind", async () => {
    // @ts-expect-error — testing runtime guard
    await expect(audit.emit({})).rejects.toThrow(/kind/);
  });

  test("signer attaches ed25519 signature with key_uri", async () => {
    const signed = new AuditStream({
      source: "signed-src",
      decisionCardRef: "https://example/d.json",
      sink: new InMemorySink(),
      signer: {
        keyUri: "https://example/.well-known/pubkey.json",
        sign: () => "BASE64-SIG-VALUE"
      }
    });
    const event = await signed.emit({ kind: "x" });
    expect(event.signature).toEqual({ alg: "ed25519", value: "BASE64-SIG-VALUE", key_uri: "https://example/.well-known/pubkey.json" });
  });
});

describe("verifyChain", () => {
  function makeStream() {
    const counter = { n: 0 };
    return new AuditStream({
      source: "verify-src",
      decisionCardRef: "https://example/d.json",
      sink: new InMemorySink(),
      now: () => new Date("2026-05-30T00:00:00Z"),
      newEventId: () => `evt-${(++counter.n).toString().padStart(4, "0")}`
    });
  }

  test("returns ok for an intact chain", async () => {
    const s = makeStream();
    const sink = (s as unknown as { sink: InMemorySink }).sink ?? null;
    const events: AuditEvent[] = [];
    for (let i = 0; i < 5; i++) events.push(await s.emit({ kind: `e${i}` }));
    expect(verifyChain(events)).toEqual({ ok: true, firstBreakAt: null });
  });

  test("flags a broken prev_hash", async () => {
    const s = makeStream();
    const events: AuditEvent[] = [];
    for (let i = 0; i < 3; i++) events.push(await s.emit({ kind: `e${i}` }));
    events[1] = { ...events[1]!, prev_hash: "f".repeat(64) };
    const result = verifyChain(events);
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(1);
    expect(result.reason).toMatch(/prev_hash/);
  });

  test("flags a tampered body (hash recomputation mismatch)", async () => {
    const s = makeStream();
    const events: AuditEvent[] = [];
    for (let i = 0; i < 3; i++) events.push(await s.emit({ kind: `e${i}` }));
    events[2] = { ...events[2]!, source: "tampered-after-emission" };
    const result = verifyChain(events);
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(2);
    expect(result.reason).toMatch(/hash/);
  });

  test("ok for empty chain", () => {
    expect(verifyChain([])).toEqual({ ok: true, firstBreakAt: null });
  });
});

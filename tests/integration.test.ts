// integration.test.ts — End-to-end: apply vault contract → emit audit event
// → verify chain → sign + verify signature.
//
// This is the canonical "B2B SaaS embedder workflow" exercised top-to-bottom.

import { describe, test, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { AuditStream, verifyChain } from "../src/audit-stream.js";
import { applyVaultContract } from "../src/vault.js";
import { InMemorySink } from "../src/sinks.js";
import { createEd25519Signer, verifyEd25519Signature } from "../src/sign.js";
import { parseDecisionCard } from "../src/decision-card.js";
import type { DecisionCard } from "../src/types.js";

const DECISION_CARD: DecisionCard = {
  decision_card_id: "ACME-D-2026-001",
  spec_version: "0.3",
  canonical_url: "https://acme-saas.example/.well-known/decisions/ACME-D-2026-001.json",
  issuer: { name: "Acme SaaS", url: "https://acme-saas.example" },
  subject: { vendor: "VendorAI", product: "ChatAssist", version: "3.1", tool_card_url: "https://vendorai.example/tool-card.json" },
  vault_contract: {
    profile: "pii-vault-v0.1",
    rules: [
      { field: "customer.name", action: "tokenize", rationale: "PII direct identifier" },
      { field: "customer.email", action: "mask", rationale: "PII direct identifier" },
      { field: "customer.ssn", action: "hash", rationale: "Sensitive PII" }
    ]
  }
};

describe("end-to-end embedder workflow", () => {
  test("vault contract → audit emit → chain verify (the happy path)", async () => {
    // 1. Embedder parses their Decision Card
    const card = parseDecisionCard(DECISION_CARD);

    // 2. Embedder applies vault contract before handing data to the AI tool
    const customerRecord = {
      customer: { name: "Jane Doe", email: "jane@example.com", ssn: "123-45-6789", accountId: "acct-001" },
      query: "What did I order last month?"
    };
    const { payload, redactionApplied } = applyVaultContract(customerRecord, card);
    expect((payload.customer.name as string).startsWith("tok_")).toBe(true);
    expect(payload.customer.email).toBe("ja***om");
    expect((payload.customer.ssn as string).startsWith("hash_")).toBe(true);
    expect(payload.customer.accountId).toBe("acct-001");  // not in vault — passes through
    expect(redactionApplied).toHaveLength(3);

    // 3. Embedder emits an audit event describing the access
    const audit = new AuditStream({
      source: "chat-assist-prod",
      decisionCardRef: card.canonical_url,
      sink: new InMemorySink()
    });
    const event = await audit.emit({
      kind: "ai.chat.completion",
      redaction_applied: redactionApplied,
      session_id: "sess-001",
      user_query_length: customerRecord.query.length
    });

    // 4. The event is well-formed
    expect(event.kind).toBe("ai.chat.completion");
    expect(event.decision_card_ref).toBe(card.canonical_url);
    expect(event.redaction_applied).toEqual(redactionApplied);
    expect(event.session_id).toBe("sess-001");

    // 5. Chain verifies cleanly
    const sink = (audit as unknown as { sink: InMemorySink }).sink ?? new InMemorySink();
    expect(verifyChain([event])).toEqual({ ok: true, firstBreakAt: null });
  });

  test("multi-event session chains correctly + verifyChain catches tampering", async () => {
    const audit = new AuditStream({
      source: "chat-assist-prod",
      decisionCardRef: DECISION_CARD.canonical_url,
      sink: new InMemorySink()
    });
    const events = [];
    for (let i = 0; i < 5; i++) {
      events.push(await audit.emit({ kind: "ai.chat.turn", turn: i }));
    }
    expect(verifyChain(events).ok).toBe(true);
    // Tamper with event 2's body
    events[2] = { ...events[2]!, turn: 99 };
    const verdict = verifyChain(events);
    expect(verdict.ok).toBe(false);
    expect(verdict.firstBreakAt).toBe(2);
  });

  test("ed25519 signing + verification round-trips", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;

    const audit = new AuditStream({
      source: "signed-stream-prod",
      decisionCardRef: DECISION_CARD.canonical_url,
      sink: new InMemorySink(),
      signer: createEd25519Signer({ privateKeyPem: privPem, keyUri: "https://example/.well-known/pubkey.json" })
    });

    const event = await audit.emit({ kind: "important.event" });
    expect(event.signature?.alg).toBe("ed25519");
    expect(event.signature?.key_uri).toBe("https://example/.well-known/pubkey.json");
    expect(verifyEd25519Signature(event, pubPem)).toBe(true);

    // Tampering invalidates the signature
    const tampered = { ...event, kind: "evil.event" };
    expect(verifyEd25519Signature(tampered, pubPem)).toBe(false);
  });

  test("Decision Card parse rejects malformed input", () => {
    expect(() => parseDecisionCard(null)).toThrow();
    expect(() => parseDecisionCard({})).toThrow(/decision_card_id/);
    expect(() => parseDecisionCard({ ...DECISION_CARD, vault_contract: { profile: "x", rules: [{ field: "f", action: "shred" }] } })).toThrow(/tokenize.*mask.*hash.*drop/);
  });
});

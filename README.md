# kinetic-gain-embedded

[![ci](https://github.com/mizcausevic-dev/kinetic-gain-embedded/actions/workflows/ci.yml/badge.svg)](https://github.com/mizcausevic-dev/kinetic-gain-embedded/actions/workflows/ci.yml)
[![npm-publish](https://github.com/mizcausevic-dev/kinetic-gain-embedded/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/mizcausevic-dev/kinetic-gain-embedded/actions/workflows/npm-publish.yml)
[![npm version](https://img.shields.io/npm/v/kinetic-gain-embedded.svg)](https://www.npmjs.com/package/kinetic-gain-embedded)
[![license: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node: ≥20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](package.json)

**Drop-in audit-stream + Decision Card vault contract SDK for B2B SaaS.**

Built for SaaS embedders whose customers expect:

- in-product analytics + AI features, but
- compliance teams that won't approve incumbent BI procurement, and
- regulators that want evidence of *which AI tool read what customer data, when, under what consent*.

This SDK gives you the runtime primitives. Three lines of code = a hash-chained, vault-contracted, ed25519-signable audit stream that an external auditor can replay.

TypeScript-first. Dual ESM/CJS. Zero runtime dependencies. Node 20+.

---

## Install

> **Publish-pending on npm.** The v0.1.1 publish workflow is wired and tested locally; the GitHub Action waits on the `NPM_TOKEN` org secret, which is provisioned alongside the production billing setup. Until then, install directly from GitHub at the tagged SHA:

```bash
# Once npm publish ships (workflow will fire on the next tag push):
npm install kinetic-gain-embedded

# Until then — same code, SHA pinned by the v0.1.1 tag:
npm install github:mizcausevic-dev/kinetic-gain-embedded#v0.1.1
```

## Five-minute integration

```ts
import {
  AuditStream,
  applyVaultContract,
  NdjsonFileSink,
  parseDecisionCard
} from "kinetic-gain-embedded";

// 1. Load the buyer's Decision Card (their signed data-handling rules)
const card = parseDecisionCard(JSON.parse(decisionCardJson));

// 2. Set up the audit stream
const audit = new AuditStream({
  source: "my-saas-prod",
  decisionCardRef: card.canonical_url,
  sink: new NdjsonFileSink("/var/log/audit.ndjson")
});

// 3. On every customer-data touch:
const { payload, redactionApplied } = applyVaultContract(customerRecord, card);
//   payload is tokenized — hand IT to the AI tool, not the raw record
//   redactionApplied is the list of redactions you record on the audit event

await audit.emit({
  kind: "ai.chat.completion",
  redaction_applied: redactionApplied,
  session_id: req.sessionId
});
```

That's it. Every emit:

- assigns a UUID v7 `event_id` (time-ordered)
- chains the new event to the previous via `prev_hash` (genesis = 64 zeros)
- computes `hash = sha256(canonical_json(event - {hash, signature}))`
- optionally ed25519-signs the same canonical body
- writes through the configured sink (NDJSON, HTTP, in-memory, or your own)

## What's in the box

| Module | Purpose |
| --- | --- |
| `AuditStream` | Hash-chained event emitter |
| `applyVaultContract` | Tokenize / mask / hash / drop fields per the Decision Card |
| `applyVaultContractWith` | Same, with an injectable tokenizer (Skyflow / Privacera / self-hosted KMS) |
| `parseDecisionCard` / `fetchDecisionCard` | Load + validate a Decision Card |
| `createEd25519Signer` / `verifyEd25519Signature` | Sign + verify events with ed25519 (no external deps) |
| `verifyChain` | Walk a stream + return the first hash-chain break, or `ok` |
| `InMemorySink` / `NdjsonFileSink` / `HttpSink` / `TeeSink` | Reference sinks |
| `canonicalize` / `canonicalHash` / `sha256Hex` | The exact canonical-JSON hashing every other Suite tool uses |
| `uuidv7` | Time-ordered UUID v7 generator (used for `event_id` by default) |

## Why this exists

A SaaS embedder wiring in AI features (chat, summarization, RAG retrieval) faces three independent problems:

1. **Show your customers which AI tool read what, when, under what consent** — without a hash-chained ledger, every claim is unverifiable.
2. **Don't let the AI tool see raw customer PII/PHI/SPI** — without a runtime vault contract layer, the engineering team is one prompt-injection away from a CloudWatch log full of regulated data.
3. **Make the audit trail re-playable by an auditor** — without canonical hashing + ed25519 signing, a clever insider can rewrite history.

This SDK is the embedder's runtime side of the [Kinetic Gain Protocol Suite](https://suite.kineticgain.com). It implements the open Suite specs (audit-stream, Decision Card, vault contract) as a production npm package.

The Decision Card is *issued by the buyer*. The SDK *enforces it on the embedder's side*. The audit stream is *replayable by the auditor*. That triangle is the whole product.

## Vault contract field paths

Field paths are dot-separated, index-free:

```ts
{ field: "customer.email",          action: "mask"     }   // customer.email
{ field: "customer.ssn",            action: "hash"     }   // customer.ssn
{ field: "order.lineItems.sku",     action: "tokenize" }   // every lineItem's sku
{ field: "patient.identifier",      action: "tokenize" }   // FHIR Patient.identifier
{ field: "candidate.demographics",  action: "drop"     }   // remove entirely
```

Four actions:

| Action | What it does | When to use |
| --- | --- | --- |
| `tokenize` | Replace with a deterministic opaque token (`tok_<hex>`) | Names, identifiers, free-text fields the AI tool needs *correlation on* but not the value |
| `mask` | Reveal only the first 2 + last 2 chars (`ja***om`) | Emails, phone numbers — when the AI tool needs *shape* but not the value |
| `hash` | Replace with `hash_<hex>` digest | SSNs, account numbers — when even the shape leaks |
| `drop` | Remove the field entirely | High-sensitivity fields the AI tool should never see |

The default tokenizer is deterministic SHA-256-based, which works for test/dev and vault-less integrations. For production with unlinkability guarantees, inject your own tokenizer via `applyVaultContractWith` (Skyflow, Privacera, or your own KMS).

## Hash chain invariants

Every event satisfies:

```
prev_hash := previous event's hash (or 64 zeros for the genesis)
hash      := sha256(canonical_json(event minus hash + signature))
signature := optional ed25519 over the same canonical body
```

`canonical_json`: object keys sorted lexicographically, no whitespace, UTF-8. This canonicalization is byte-for-byte identical across every tool in the Suite — that's how a stream emitted by this SDK can be replayed by an auditor running a Python or Go verifier from a different vertical.

Use `verifyChain(events)` to walk a stream and return the first break:

```ts
import { verifyChain } from "kinetic-gain-embedded";

const verdict = verifyChain(events);
if (!verdict.ok) {
  console.error(`Chain break at event ${verdict.firstBreakAt}: ${verdict.reason}`);
}
```

## Examples

- [`examples/standalone/demo.mjs`](examples/standalone/demo.mjs) — End-to-end demo: vault → 3 audit events → chain verify
- [`examples/express-middleware/middleware.mjs`](examples/express-middleware/middleware.mjs) — Drop-in Express middleware

## Sinks: bring your own, or use ours

The shipped sinks (`InMemorySink`, `NdjsonFileSink`, `HttpSink`, `TeeSink`) are reference implementations. Production embedders typically write their own sink that pushes into their existing observability pipeline (Kafka, Kinesis, Loki, OpenTelemetry, a managed log service).

A sink is one method:

```ts
interface AuditSink {
  write(event: AuditEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}
```

That's the whole contract.

## Composes with

- [Kinetic Gain Protocol Suite](https://suite.kineticgain.com) — the umbrella
- [`ai-procurement-decision-spec`](https://github.com/mizcausevic-dev/ai-procurement-decision-spec) — the Decision Card v0.3 spec this SDK enforces
- [`fhir-resource-access-audit-reference`](https://github.com/mizcausevic-dev/fhir-resource-access-audit-reference) — HealthTech-specific end-to-end reference using a sibling vault contract
- The Suite's 8 vertical 6-packs (HealthTech, EdTech, PropTech, InsurTech, HR Tech, FinTech, GovTech, LegalTech) — every audit-stream spec consumed by this SDK

## Sales-enablement — Procurement Packet Starter

When your enterprise customer's security team asks for a "procurement packet" or "security review packet" before they'll go to PoC, [`docs/sales/PROCUREMENT-PACKET.md`](./docs/sales/PROCUREMENT-PACKET.md) is a fill-in template you adapt and send.

It is **KGE-enabled**: §8 of the packet contains four verifiable claims you can make about your trust boundary precisely *because* KGE backs them (hash-chained audit, vault contract tokenization, ed25519-signable events, customer-defined Decision Card). Your customer can verify each claim independently from the npm package — no proprietary tooling, no SaaS dependency.

The packet maps to SIG-Lite, CAIQ, VSA Core, and custom AI security questionnaires (cross-reference table in §15). It is **scaffolding for human use, not a SOC 2 substitute, not legal advice** — fill in honestly, have counsel review, send. Honest framing for pre-SOC-2 vendors included verbatim in the template intro.

Companion buyer-side templates (the inverse — your customer uses these to evaluate vendors like you): the [Kinetic Gain Trust Pack](https://kineticgain.com/trust/) — 8 browser-only tools including AI System Card Builder, AI Vendor Intake Form, and Vendor AI Disclosure Review. Pointing customers at those tools builds trust by handing them the evaluation framework.

## Compliance posture

This SDK is **audit-stream scaffolding**. Producing a verified hash-chained stream + applying a vault contract gives you *evidence artifacts* an auditor can replay — it does not establish HIPAA / FERPA / SOC 2 / GDPR / ISO 27001 / NIST AI RMF / EU AI Act / ISO 42001 compliance. Compliance posture depends on the embedder's full control environment, executed business associate / data processing agreements, and the appropriate external attestation for each regime.

Per the Kinetic Gain standing public-language guardrail: *readiness · evidence · posture · controls · scaffolding* — never "compliant" / "certified" without an external attestation specific to each regime.

## Publishing

This package is **npm-publish-ready**. The `.github/workflows/npm-publish.yml` workflow auto-publishes to npm on every `v*` tag push, with npm provenance attestation enabled (links the published artifact to the exact commit + workflow run).

To publish:

1. **One-time setup:** add an npm "Automation" type access token as `NPM_TOKEN` in the repo's GitHub Actions secrets (Settings → Secrets and variables → Actions → New repository secret). Automation tokens bypass 2FA at publish time, which is what `--provenance` requires.
2. **Bump version** in `package.json` (e.g. `0.1.0` → `0.1.1` for a patch release).
3. **Tag + push:** `git tag v0.1.1 && git push origin v0.1.1`.
4. The workflow runs: typecheck → tests → build → ESM/CJS smoke → `npm pack --dry-run` preview → `npm publish --access public --provenance`.

Before publishing, the local `prepublishOnly` script (in `package.json`) re-runs clean + build + test as a final pre-flight gate — both locally (if you ever `npm publish` from your machine) and in the workflow.

## License

[Apache-2.0](LICENSE). Pick it up, embed it, ship it.

## Status

- v0.1 (Phase 1) — production SDK for TypeScript + Node. 42 tests across 4 suites. Dual ESM/CJS output. Zero runtime deps. **npm-publish-ready** (workflow shipped; awaiting NPM_TOKEN secret).
- v0.2+ (Phase 2 candidates) — Python SDK · OpenTelemetry sink · Decision Card CRDT for multi-party signing

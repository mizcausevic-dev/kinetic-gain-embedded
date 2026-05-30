// index.ts — Public SDK surface.
//
// Convention: keep this file PURELY re-exports. The SDK's surface area is
// what's exported from here; everything else is internal.

export { AuditStream, verifyChain } from "./audit-stream.js";
export type { EmitInput } from "./audit-stream.js";

export { applyVaultContract, applyVaultContractWith } from "./vault.js";

export { parseDecisionCard, fetchDecisionCard } from "./decision-card.js";

export { InMemorySink, NdjsonFileSink, HttpSink, TeeSink } from "./sinks.js";

export { createEd25519Signer, verifyEd25519Signature } from "./sign.js";

export { canonicalize, canonicalHash, sha256Hex, GENESIS_PREV_HASH } from "./canonical.js";
export { uuidv7 } from "./uuid.js";

export type {
  AuditEvent,
  AuditEventSignature,
  AuditEventSigner,
  AuditSink,
  AuditStreamOptions,
  DecisionCard,
  RedactionApplied,
  RetentionEnvelope,
  VaultApplyResult,
  VaultContract,
  VaultRule,
  VaultTarget
} from "./types.js";

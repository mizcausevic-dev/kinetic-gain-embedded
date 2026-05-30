// types.ts — Public type surface.
//
// These types model the Kinetic Gain Protocol Suite's three core artifacts as
// they appear in a B2B SaaS embedder's runtime:
//
//   1. AuditEvent        — one row in a hash-chained Suite audit-stream
//   2. DecisionCard      — the buyer's signed authorization-to-process-data doc
//   3. VaultContract     — the data-handling rules a Decision Card binds
//
// The SDK is vertical-agnostic: a HealthTech FHIR stream, a FinTech transaction
// stream, an HR Tech employment-decision stream all use the same AuditEvent
// shape. Vertical-specific fields live in the `payload` field.

/** Hash-chained Suite-compliant audit event. */
export interface AuditEvent {
  /** Globally unique event id. UUID v7 recommended. */
  event_id: string;
  /** RFC 3339 timestamp at the moment of emission. */
  timestamp: string;
  /** Event kind — namespaced string. E.g. `fhir.resource.read`, `decision.executed`. */
  kind: string;
  /** Logical source: `<system>-<environment>`. E.g. `rag-pipeline-prod`. */
  source: string;
  /** The buyer's Decision Card URL — the authorization for this event. */
  decision_card_ref: string;
  /** SHA-256 hex of the previous event's `hash`. 64 zeros for the genesis. */
  prev_hash: string;
  /** SHA-256 hex of the canonical-JSON of this event excluding `hash`. */
  hash: string;
  /** Optional ed25519 signature over the canonical body excluding `signature`. */
  signature?: AuditEventSignature;
  /** Optional list of fields that the vault contract redacted before this event. */
  redaction_applied?: RedactionApplied[];
  /** Any additional vertical-specific fields. */
  [extra: string]: unknown;
}

export interface AuditEventSignature {
  alg: "ed25519";
  /** Base64-encoded signature bytes. */
  value: string;
  /** URL where the signer's public key (JWK) can be fetched. */
  key_uri: string;
}

export interface RedactionApplied {
  /** Field path that was redacted, e.g. `Patient.name`, `customer.email`. */
  field: string;
  /** What was done. */
  action: "tokenize" | "mask" | "hash" | "drop";
}

/** A Decision Card binds vault rules + retention + agent identity. */
export interface DecisionCard {
  /** Globally unique Decision Card id. */
  decision_card_id: string;
  /** Spec version this card conforms to. */
  spec_version: string;
  /** Canonical URL where the Decision Card itself can be fetched. */
  canonical_url: string;
  /** Issuing buyer organization. */
  issuer: { name: string; url?: string };
  /** Subject AI tool / vendor. */
  subject: { vendor: string; product: string; version: string; tool_card_url?: string };
  /** Vault contract — what data may flow, in what shape. */
  vault_contract: VaultContract;
  /** Optional retention envelope (Decision Card v0.3+). */
  retention_envelope?: RetentionEnvelope;
  /** Optional `data_vault_targets` (Decision Card v0.2+). */
  data_vault_targets?: VaultTarget[];
}

/** Vault contract — the field-level data-handling rules. */
export interface VaultContract {
  /** Vault contract profile URL (e.g. phi-vault-contract-profile, pii-student-vault). */
  profile: string;
  /** Per-field rules. */
  rules: VaultRule[];
}

export interface VaultRule {
  /** Field path the rule applies to. Supports dot-notation. */
  field: string;
  /** Action to apply. */
  action: "tokenize" | "mask" | "hash" | "drop";
  /** Optional human-readable rationale (HIPAA Safe Harbor #N, etc.). */
  rationale?: string;
}

export interface RetentionEnvelope {
  raw_data_max_retention_days?: number;
  tokenized_data_max_retention_days?: number;
  regulator_floor?: string;
  notes?: string;
}

export interface VaultTarget {
  vault_provider: "skyflow" | "privacera" | "self-hosted" | "other";
  vault_provider_url?: string;
  tokenization_scope?: string[];
}

/** Result of applying a vault contract to a payload. */
export interface VaultApplyResult<T = unknown> {
  /** The transformed payload (deep-cloned, original is not mutated). */
  payload: T;
  /** The list of redactions applied (suitable for `audit.emit({ redaction_applied })`). */
  redactionApplied: RedactionApplied[];
}

/** Sink — where emitted events go. The SDK ships in-memory and ndjson sinks; a
 * production embedder typically wires their own (Kafka, Kinesis, Loki, an
 * HTTP endpoint, etc.) */
export interface AuditSink {
  write(event: AuditEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}

/** Options for constructing an AuditStream. */
export interface AuditStreamOptions {
  source: string;
  decisionCardRef: string;
  sink: AuditSink;
  /** Optional ed25519 signer. If provided, every event gets a `signature` field. */
  signer?: AuditEventSigner;
  /** Optional clock override for deterministic testing. */
  now?: () => Date;
  /** Optional event_id generator override. Defaults to UUID v7. */
  newEventId?: () => string;
}

export interface AuditEventSigner {
  /** Returns a base64 ed25519 signature over `canonicalBody`. */
  sign(canonicalBody: string): string | Promise<string>;
  /** URL where the public key can be fetched. */
  keyUri: string;
}

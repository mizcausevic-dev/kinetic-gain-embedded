// vault.ts — Apply a Decision Card vault contract to an arbitrary payload.
//
// This is the runtime enforcement of the buyer's signed data-handling rules.
// An AI tool ingesting a payload must call `applyVaultContract` FIRST; the
// tokenized result is what the tool actually sees. The redaction-applied list
// is then emitted on the audit event so an auditor can verify the contract
// was honored end-to-end.
//
// Field paths support dot notation: `customer.email`, `order.lineItems`, etc.
// Arrays are matched by index-free path (`order.lineItems.amount` applies to
// each element's `amount` field).

import { createHash } from "node:crypto";
import type {
  DecisionCard,
  RedactionApplied,
  VaultApplyResult,
  VaultContract,
  VaultRule
} from "./types.js";

/**
 * Apply a Decision Card's vault contract to a payload.
 * Returns the transformed payload (deep-cloned) and the redactions applied.
 */
export function applyVaultContract<T>(
  payload: T,
  contractOrCard: VaultContract | DecisionCard
): VaultApplyResult<T> {
  const contract = "vault_contract" in contractOrCard
    ? contractOrCard.vault_contract
    : contractOrCard;

  // Deep clone so we never mutate the caller's payload.
  const cloned = structuredClone(payload) as T;
  const redactionApplied: RedactionApplied[] = [];

  for (const rule of contract.rules) {
    const hit = applyRule(cloned as unknown, rule);
    if (hit) redactionApplied.push({ field: rule.field, action: rule.action });
  }

  return { payload: cloned, redactionApplied };
}

/** Walk a dot-path. Returns false if no value existed at the path. */
function applyRule(payload: unknown, rule: VaultRule): boolean {
  const segments = rule.field.split(".");
  return walk(payload, segments, 0, rule);
}

function walk(node: unknown, segments: string[], depth: number, rule: VaultRule): boolean {
  if (node === null || node === undefined) return false;
  const remaining = segments.length - depth;
  if (remaining === 0) return false;

  if (Array.isArray(node)) {
    // Apply to each element at the same depth (path is index-free)
    let anyHit = false;
    for (const el of node) {
      if (walk(el, segments, depth, rule)) anyHit = true;
    }
    return anyHit;
  }

  if (typeof node !== "object") return false;

  const obj = node as Record<string, unknown>;
  const key = segments[depth]!;
  if (!(key in obj)) return false;

  if (remaining === 1) {
    // Leaf — apply the rule
    obj[key] = transform(obj[key], rule.action);
    return true;
  }

  // Recurse
  return walk(obj[key], segments, depth + 1, rule);
}

function transform(value: unknown, action: VaultRule["action"]): unknown {
  if (value === null || value === undefined) return value;
  switch (action) {
    case "tokenize": return tokenize(value);
    case "mask":     return mask(value);
    case "hash":     return hash(value);
    case "drop":     return undefined;
  }
}

/** Tokenize: stable, deterministic, opaque. Reference-impl tokens look like
 * `tok_<12 hex>`. A production embedder typically replaces this with a call
 * to a vault provider (Skyflow, Privacera, self-hosted KMS). Use
 * `tokenizeWith` below to inject your own tokenizer. */
function tokenize(value: unknown): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  return "tok_" + sha256Short(json);
}

function mask(value: unknown): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (s.length <= 4) return "***";
  return s.slice(0, 2) + "***" + s.slice(-2);
}

function hash(value: unknown): string {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  return "hash_" + sha256Short(json, 16);
}

function sha256Short(s: string, n = 12): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, n);
}

/** Same as `applyVaultContract` but lets the embedder supply their own
 * tokenizer (typically a vault-service-backed one). The default tokenizer
 * is deterministic SHA-256-based, which is fine for testing and for
 * vault-less integrations but doesn't give you the unlinkability a real
 * vault provider does. */
export function applyVaultContractWith<T>(
  payload: T,
  contractOrCard: VaultContract | DecisionCard,
  tokenizer: (value: unknown, field: string) => string
): VaultApplyResult<T> {
  const contract = "vault_contract" in contractOrCard
    ? contractOrCard.vault_contract
    : contractOrCard;
  const cloned = structuredClone(payload) as T;
  const redactionApplied: RedactionApplied[] = [];

  for (const rule of contract.rules) {
    const hit = walkInjectable(cloned as unknown, rule.field.split("."), 0, rule, tokenizer);
    if (hit) redactionApplied.push({ field: rule.field, action: rule.action });
  }
  return { payload: cloned, redactionApplied };
}

function walkInjectable(
  node: unknown,
  segments: string[],
  depth: number,
  rule: VaultRule,
  tokenizer: (value: unknown, field: string) => string
): boolean {
  if (node === null || node === undefined) return false;
  if (Array.isArray(node)) {
    let anyHit = false;
    for (const el of node) if (walkInjectable(el, segments, depth, rule, tokenizer)) anyHit = true;
    return anyHit;
  }
  if (typeof node !== "object") return false;
  const obj = node as Record<string, unknown>;
  const key = segments[depth]!;
  if (!(key in obj)) return false;
  if (depth === segments.length - 1) {
    if (rule.action === "drop") {
      delete obj[key];
    } else if (rule.action === "tokenize") {
      obj[key] = tokenizer(obj[key], rule.field);
    } else {
      obj[key] = transform(obj[key], rule.action);
    }
    return true;
  }
  return walkInjectable(obj[key], segments, depth + 1, rule, tokenizer);
}

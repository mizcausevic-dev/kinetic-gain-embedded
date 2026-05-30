// canonical.ts — Canonical JSON + SHA-256, matching every other Suite tool.
//
// CRITICAL: this canonicalization MUST match the spec verifier byte-for-byte
// or hash chains won't link across tools. The convention across the Kinetic
// Gain Protocol Suite:
//
//   - Object keys sorted lexicographically (ascending)
//   - No insignificant whitespace (no spaces, no newlines)
//   - Strings use JSON.stringify's escape rules (UTF-8 safe)
//   - Numbers use JavaScript's default JSON serialization (integers exact;
//     non-integers as IEEE-754 round-trip)
//   - Arrays preserve order (they're indexed data, not a set)
//
// This is intentionally a tiny pure function. No `safe-stable-stringify`,
// no `canonical-json` package — every dep is a supply-chain risk in the
// hot path of a customer-data-touching audit event.

import { createHash } from "node:crypto";

/**
 * Canonical-JSON serialize a JSON-compatible value.
 * @throws if `value` contains cycles or non-JSON types (BigInt, undefined in non-leaf).
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalize: non-finite number ${value}`);
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") {
    throw new TypeError("canonicalize: BigInt is not JSON-serializable");
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  throw new TypeError(`canonicalize: unsupported type ${typeof value}`);
}

/** SHA-256 hex digest of a string. */
export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Convenience: canonical JSON + SHA-256 in one call. */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalize(value));
}

/** The genesis prev_hash — 64 zeros, matching every audit-stream spec. */
export const GENESIS_PREV_HASH = "0".repeat(64);

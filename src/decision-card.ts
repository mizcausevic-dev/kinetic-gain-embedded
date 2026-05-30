// decision-card.ts — Load + validate Decision Cards.
//
// A Decision Card is the buyer's signed authorization-to-process-data
// document. It binds:
//   - which AI tool may run
//   - which fields may flow (vault contract)
//   - how long data is retained (retention envelope)
//   - what vault provider stores PHI/PII (data_vault_targets — Decision Card v0.2+)
//
// The SDK uses Decision Cards as the source of truth for vault rules and as
// the canonical `decision_card_ref` URL stamped on every audit event.

import type { DecisionCard } from "./types.js";

/** Load + validate a Decision Card from a raw object. Throws on structural
 * failure. Doesn't validate against the full JSON Schema — that's deliberately
 * out of scope for the SDK runtime (use the spec's verifier in CI). */
export function parseDecisionCard(raw: unknown): DecisionCard {
  if (!raw || typeof raw !== "object") throw new Error("DecisionCard: payload must be an object");
  const card = raw as Record<string, unknown>;

  required(card, "decision_card_id", "string");
  required(card, "spec_version", "string");
  required(card, "canonical_url", "string");
  required(card, "issuer", "object");
  required(card, "subject", "object");
  required(card, "vault_contract", "object");

  const vault = card.vault_contract as Record<string, unknown>;
  required(vault, "profile", "string");
  if (!Array.isArray(vault.rules)) throw new Error("DecisionCard.vault_contract.rules must be an array");
  for (const [i, rule] of (vault.rules as unknown[]).entries()) {
    if (!rule || typeof rule !== "object") throw new Error(`DecisionCard.vault_contract.rules[${i}] must be an object`);
    const r = rule as Record<string, unknown>;
    required(r, "field", "string");
    if (typeof r.action !== "string" || !["tokenize", "mask", "hash", "drop"].includes(r.action)) {
      throw new Error(`DecisionCard.vault_contract.rules[${i}].action must be one of tokenize|mask|hash|drop`);
    }
  }

  return raw as DecisionCard;
}

/** Fetch + parse a Decision Card from a URL. Uses `globalThis.fetch`. */
export async function fetchDecisionCard(url: string, opts: { fetch?: typeof fetch } = {}): Promise<DecisionCard> {
  const fetchImpl = opts.fetch ?? fetch;
  const res = await fetchImpl(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`fetchDecisionCard: ${url} returned ${res.status}`);
  return parseDecisionCard(await res.json());
}

function required(obj: Record<string, unknown>, key: string, type: "string" | "object"): void {
  if (!(key in obj)) throw new Error(`DecisionCard: missing required field ${key}`);
  const v = obj[key];
  if (type === "string" && typeof v !== "string") throw new Error(`DecisionCard.${key} must be a string`);
  if (type === "object" && (v === null || typeof v !== "object")) throw new Error(`DecisionCard.${key} must be an object`);
}

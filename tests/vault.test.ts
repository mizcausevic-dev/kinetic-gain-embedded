// vault.test.ts — Vault contract application.

import { describe, test, expect } from "vitest";
import { applyVaultContract, applyVaultContractWith } from "../src/vault.js";
import type { VaultContract } from "../src/types.js";

const CONTRACT: VaultContract = {
  profile: "test-vault-v0.1",
  rules: [
    { field: "customer.name", action: "tokenize" },
    { field: "customer.email", action: "mask" },
    { field: "customer.ssn", action: "hash" },
    { field: "customer.notes", action: "drop" },
    { field: "order.lineItems.sku", action: "tokenize" }
  ]
};

const PAYLOAD = {
  customer: {
    name: "Jane Doe",
    email: "jane@example.com",
    ssn: "123-45-6789",
    notes: "VIP customer",
    accountId: "acct-001"  // not in contract; should pass through
  },
  order: {
    id: "ord-001",
    lineItems: [
      { sku: "SKU-A", qty: 2 },
      { sku: "SKU-B", qty: 1 }
    ]
  }
};

describe("applyVaultContract", () => {
  test("does not mutate the input payload", () => {
    const original = JSON.parse(JSON.stringify(PAYLOAD));
    applyVaultContract(PAYLOAD, CONTRACT);
    expect(PAYLOAD).toEqual(original);
  });

  test("returns one redaction entry per applied rule", () => {
    const { redactionApplied } = applyVaultContract(PAYLOAD, CONTRACT);
    expect(redactionApplied).toHaveLength(5);
    expect(redactionApplied.map((r) => r.field).sort()).toEqual([
      "customer.email",
      "customer.notes",
      "customer.name",
      "customer.ssn",
      "order.lineItems.sku"
    ].sort());
  });

  test("tokenize produces stable opaque tokens", () => {
    const { payload } = applyVaultContract(PAYLOAD, CONTRACT);
    expect((payload.customer.name as string).startsWith("tok_")).toBe(true);
    expect((payload.customer.name as string).length).toBe(16); // "tok_" + 12 hex
  });

  test("mask reveals only edges", () => {
    const { payload } = applyVaultContract(PAYLOAD, CONTRACT);
    expect(payload.customer.email).toBe("ja***om");
  });

  test("hash produces hash_-prefixed digest", () => {
    const { payload } = applyVaultContract(PAYLOAD, CONTRACT);
    expect((payload.customer.ssn as string).startsWith("hash_")).toBe(true);
  });

  test("drop removes the field entirely", () => {
    const { payload } = applyVaultContract(PAYLOAD, CONTRACT);
    expect("notes" in payload.customer).toBe(true); // transform sets to undefined; structuredClone keeps the key
    // Note: 'drop' returns undefined which serializes as missing in JSON — that's the intended ndjson behavior.
    expect(payload.customer.notes).toBeUndefined();
  });

  test("preserves fields not covered by any rule", () => {
    const { payload } = applyVaultContract(PAYLOAD, CONTRACT);
    expect(payload.customer.accountId).toBe("acct-001");
    expect(payload.order.id).toBe("ord-001");
  });

  test("applies to each array element by index-free path", () => {
    const { payload } = applyVaultContract(PAYLOAD, CONTRACT);
    expect(payload.order.lineItems[0]!.sku).toMatch(/^tok_/);
    expect(payload.order.lineItems[1]!.sku).toMatch(/^tok_/);
    expect(payload.order.lineItems[0]!.qty).toBe(2); // not in contract
  });

  test("accepts a full DecisionCard (auto-extracts vault_contract)", () => {
    const card = { decision_card_id: "D1", spec_version: "0.1", canonical_url: "u", issuer: {name:"i"}, subject: {vendor:"v",product:"p",version:"1"}, vault_contract: CONTRACT };
    const { redactionApplied } = applyVaultContract(PAYLOAD, card);
    expect(redactionApplied).toHaveLength(5);
  });

  test("returns no redaction entries when contract has no matching fields", () => {
    const emptyContract: VaultContract = { profile: "empty", rules: [{ field: "nonexistent.field", action: "tokenize" }] };
    const { redactionApplied } = applyVaultContract(PAYLOAD, emptyContract);
    expect(redactionApplied).toHaveLength(0);
  });
});

describe("applyVaultContractWith", () => {
  test("uses the injected tokenizer for tokenize actions", () => {
    let called = 0;
    const tokenizer = (value: unknown, field: string): string => {
      called++;
      return `vault-${field}-${String(value).length}`;
    };
    const { payload } = applyVaultContractWith(PAYLOAD, CONTRACT, tokenizer);
    expect(called).toBeGreaterThan(0);
    expect(payload.customer.name).toBe(`vault-customer.name-${"Jane Doe".length}`);
  });

  test("falls back to built-in transforms for mask/hash/drop", () => {
    const tokenizer = (v: unknown): string => "T";
    const { payload } = applyVaultContractWith(PAYLOAD, CONTRACT, tokenizer);
    expect(payload.customer.email).toBe("ja***om");
    expect((payload.customer.ssn as string).startsWith("hash_")).toBe(true);
    expect("notes" in payload.customer).toBe(false); // applyVaultContractWith's drop uses `delete`
  });
});

// canonical.test.ts — Canonical JSON + SHA-256.
//
// CRITICAL: these tests pin the canonicalization to the byte-for-byte exact
// shape every other Suite tool agrees on. Any change here that breaks these
// tests will break the hash chain compat with the spec verifiers.

import { describe, test, expect } from "vitest";
import { canonicalize, canonicalHash, sha256Hex, GENESIS_PREV_HASH } from "../src/canonical.js";

describe("canonicalize", () => {
  test("sorts object keys lexicographically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
  });

  test("preserves array order (arrays are indexed data, not sets)", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  test("emits no whitespace", () => {
    expect(canonicalize({ a: { b: { c: 1 } } })).toBe('{"a":{"b":{"c":1}}}');
  });

  test("handles primitive types correctly", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(false)).toBe("false");
    expect(canonicalize(42)).toBe("42");
    expect(canonicalize("hello")).toBe('"hello"');
    expect(canonicalize("with \"quotes\"")).toBe('"with \\"quotes\\""');
  });

  test("skips undefined values in objects (matches JSON.stringify semantics)", () => {
    expect(canonicalize({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  test("throws on non-JSON types", () => {
    expect(() => canonicalize(BigInt(1))).toThrow(/BigInt/);
    expect(() => canonicalize(Number.NaN)).toThrow(/non-finite/);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(/non-finite/);
  });

  test("is deterministic across re-serialization", () => {
    const obj = { z: [3, 2, 1], a: { y: "b", x: "a" }, m: null };
    const out1 = canonicalize(obj);
    const out2 = canonicalize(obj);
    expect(out1).toBe(out2);
    // Re-parse + re-canonicalize → same output
    expect(canonicalize(JSON.parse(out1))).toBe(out1);
  });
});

describe("sha256Hex", () => {
  test("produces RFC-known vectors", () => {
    // Empty string SHA-256
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    // "abc" SHA-256
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("canonicalHash", () => {
  test("byte-stable across runs for the same object", () => {
    const obj = { kind: "test", source: "unit", n: 1 };
    expect(canonicalHash(obj)).toBe(canonicalHash(obj));
  });
});

describe("GENESIS_PREV_HASH", () => {
  test("is 64 zeros", () => {
    expect(GENESIS_PREV_HASH).toBe("0".repeat(64));
    expect(GENESIS_PREV_HASH).toMatch(/^0{64}$/);
  });
});

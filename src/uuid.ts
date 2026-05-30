// uuid.ts — UUID v7 generation.
//
// v7 is time-ordered (first 48 bits = Unix ms timestamp), which means audit
// events sort lexicographically by event_id in emission order. That property
// matters for any downstream consumer that scans the stream linearly without
// re-sorting by `timestamp`.
//
// Why ship our own instead of pulling `uuid`? Two reasons:
//   1. Supply-chain surface in the audit-event hot path. `uuid` is fine but
//      `crypto.randomUUID()` is v4 only; we want v7 and don't want a runtime
//      dep just for that.
//   2. Node 22+ ships `crypto.randomUUID({ version: 7 })`, so this file
//      becomes a one-line shim once we drop Node 20 support.

import { randomBytes } from "node:crypto";

export function uuidv7(): string {
  // 16 bytes total. Layout:
  //   [0..5]   48-bit Unix ms timestamp, big-endian
  //   [6]      top nibble = 0x7 (version), bottom nibble = random
  //   [7]      8 bits random
  //   [8]      top 2 bits = 0b10 (variant RFC 4122), bottom 6 bits random
  //   [9..15]  62 bits random
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n)  & 0xffn);
  bytes[5] = Number((ms)        & 0xffn);
  // Version 7 in high nibble of byte 6
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // Variant 10 in high two bits of byte 8
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

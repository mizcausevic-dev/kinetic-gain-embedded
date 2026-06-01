# Security policy — kinetic-gain-embedded

> The npm package `kinetic-gain-embedded` is the runtime SDK for the
> Kinetic Gain Embedded product. It ships hash-chained audit-stream
> primitives, Decision Card vault contracts, and optional ed25519
> signing. If something here is broken, the blast radius is your
> customers' regulated data.

## Reporting a vulnerability

**Do not file a public GitHub issue for security bugs.**

Send a private report to **miz@kineticgain.com**. Include:

- A description of the vulnerability and the SDK version affected
  (`npm ls kinetic-gain-embedded` or check `package.json`).
- Reproduction steps. A minimal `node` script that exercises the
  primitive is ideal.
- Your assessment of severity (advisory / important / critical) — we
  may revise.
- Whether you want credit in the fix release. Default: yes, with the
  name/handle you provide.

You should hear back within **72 hours**. If you don't, escalate via
the security.txt at <https://kineticgain.com/.well-known/security.txt>.

## Coordinated disclosure

We follow standard coordinated disclosure:

1. You report privately.
2. We acknowledge within 72 hours and propose a fix timeline.
3. We patch + cut a release on a private branch.
4. We publish the release + the advisory + credit the reporter.
5. Repeat for any affected downstream packages we maintain.

Default fix-and-disclose clock: **90 days** from acknowledgement.
Shortened if we observe a user-facing exploit in the wild.

## What's in scope

- The published npm package (`kinetic-gain-embedded`), all versions.
- Cryptographic primitives in `src/`: hash chain, canonical-JSON,
  applyVaultContract, ed25519 signing/verification, UUID v7 generation.
- The Procurement Packet template at `docs/sales/PROCUREMENT-PACKET.md`
  (if it makes claims our code doesn't back).
- TypeScript type definitions (incorrect types that lead to misuse
  count).

## What's out of scope

- Third-party dependencies. We have zero runtime deps; if your finding
  is in a transitive dev-only dep (e.g., a TypeScript-compiler-time
  pkg), file it upstream.
- Browser-side use of the SDK. The package targets Node 20+ and relies
  on `node:crypto`. We do not support running it via a CDN bundle —
  use [the browser playground](https://kineticgain.com/embedded/playground/)
  for that.
- The buyer-facing pricing/ROI/integrate/case-study pages on
  kineticgain.com — those have their own scope via the apex
  `.well-known/security.txt`.

## Cryptographic invariants this SDK provides

If you find a way to violate any of these, that is a security issue
regardless of "fitness for purpose" arguments:

1. **Hash chain non-malleability**: changing any field of any prior
   audit event MUST make `verifyChain()` return failure at the
   modified event. Hash collisions, length-extension, or canonical-
   form ambiguity that lets two distinct events hash to the same
   value all qualify.

2. **Decision Card binding**: every emitted audit event includes a
   `decision_card_ref` and the redaction list. An audit event whose
   `redaction_applied` array does NOT reflect what `applyVaultContract`
   actually did to the payload is a bug, even if the rest of the
   chain verifies.

3. **ed25519 signature integrity**: if signing is enabled, the
   embedded `signature.value` MUST verify against the embedded
   `signature.public_key` over `canonicalize(event - {signature})`.
   Mismatches between the language implementations (TypeScript here vs
   Python/Go verifiers in the broader Suite) are bugs in whichever
   side diverged from the spec.

4. **Vault contract enforcement**: if a Decision Card declares a
   field as `tokenize`/`mask`/`hash`/`drop`, the field MUST be
   transformed before `applyVaultContract` returns. Returning the raw
   value is the highest-severity class of bug this SDK can have.

## Cryptographic primitives we use

| Primitive | Library | Why |
| --- | --- | --- |
| SHA-256 | `node:crypto` (built-in) | Hash chain, deterministic token derivation |
| ed25519 | `node:crypto` (built-in) | Signatures, optional |
| UUID v7 | own impl in `src/uuid.ts` | Time-ordered event IDs |
| Canonical JSON | own impl in `src/canonicalize.ts` | Stable byte representation for hashing |

We use Node's built-in `node:crypto` for everything. Zero runtime
dependencies. No homegrown crypto.

## Supply chain

- Package is published with [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
  (`--provenance` flag). Verify with `npm install --foreground-scripts
  kinetic-gain-embedded` and check the attestation in the package
  view.
- License: Apache-2.0 (file: `LICENSE`).
- Lockfile (`package-lock.json`) is committed. CI runs `npm audit`
  on every push.
- No telemetry, no analytics, no network calls at runtime. The SDK
  only writes through the configured sink — `NdjsonFileSink`,
  `HttpSink`, `InMemorySink`, or whatever you implement.

## Key management (when signing is enabled)

If you turn on ed25519 signing, **you provide the private key**. The
SDK takes a `KeyObject` you've already loaded. We do not generate,
store, rotate, or transmit private keys. Your obligations:

- Generate the key on a trusted machine (a HSM, KMS, or `openssl
  genpkey -algorithm ed25519` on an isolated host).
- Distribute the public key (SPKI-DER base64) via a stable URL like
  `https://your-org.example/.well-known/keys/2026.json` so verifiers
  can fetch + trust on first use.
- Rotate periodically. The signed audit events carry the public key
  inline (`signature.public_key`) so verification of old events still
  works after rotation.
- If a key is compromised, publish a revocation note at the same
  stable URL, sign future events with a new key, and treat old
  signatures as advisory rather than authoritative for the
  compromise period.

## Things we explicitly do NOT do

This is a 100% honest list. We do not:

- Encrypt anything at rest or in transit. Sinks write plaintext NDJSON
  by default. If you need encryption, layer it under the sink (a
  KMS-encrypted S3 bucket, a transparent disk encryption volume, etc).
- Protect against runtime compromise of your application process. If
  someone gets code execution in your Node server, they can bypass the
  vault contract before it's applied. Our threat model assumes the
  embedding process is honest-but-bounded.
- Make any HIPAA / FERPA / SOC 2 / GDPR / ISO 27001 / NIST AI RMF /
  EU AI Act / ISO 42001 compliance claims. We provide audit-stream
  primitives that may help your evidence packet. Your full control
  environment and external attestation determine compliance posture.

---

This file matches the scope language in
`https://kineticgain.com/.well-known/security.txt`. The two are kept
in sync deliberately.

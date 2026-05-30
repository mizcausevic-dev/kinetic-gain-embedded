# Changelog

## [0.1.1] — 2026-05-30

### Added

- `.github/workflows/npm-publish.yml` — auto-publishes to npm on every `v*` tag push. Includes typecheck + tests + build + ESM/CJS smoke + `npm pack --dry-run` preview before publish. Uses npm provenance attestation (links the published artifact to the exact commit + workflow run via SLSA Level 3).
- README: "Publishing" section with 4-step one-time setup (add NPM_TOKEN secret → bump version → tag → push).
- README: npm-publish workflow badge.
- README: bumped vertical 6-pack count from 7 to 8 (LegalTech shipped in the 2026-05-30 milestone close).

### Notes

- Package contents verified via `npm pack --dry-run`: 49 files, 27.3 kB packed / 100.9 kB unpacked. Includes `dist/` (ESM + CJS + types + sourcemaps) + `schema/` + `README.md` + `CHANGELOG.md` + `LICENSE`.
- `prepublishOnly` script in `package.json` (clean + build + test) acts as a final pre-flight gate before npm receives the tarball — runs both locally and inside the workflow.
- v0.1.0 was never published to npm; v0.1.1 is the first npm-publish-ready release once `NPM_TOKEN` secret is added.

## [0.1.0] — 2026-05-30

### Added

- **`AuditStream`** — hash-chained event emitter with pluggable sink + optional ed25519 signing. UUID v7 event_ids (time-ordered, lexicographically sortable in emission order). Genesis `prev_hash` = 64 zeros. `hash = sha256(canonical_json(event minus hash + signature))`.
- **`applyVaultContract` / `applyVaultContractWith`** — Decision Card vault contract enforcement. Four actions (tokenize, mask, hash, drop) over dot-path fields, index-free array element matching. The `With` variant accepts an injectable tokenizer for production embedders wiring Skyflow / Privacera / self-hosted KMS.
- **`parseDecisionCard` / `fetchDecisionCard`** — load + structurally validate a Decision Card from raw object or URL.
- **`createEd25519Signer` / `verifyEd25519Signature`** — ed25519 signing built on `node:crypto`. No external dependencies.
- **`verifyChain`** — walk an audit stream + return the first break (`prev_hash` mismatch OR `hash` recomputation mismatch) with index + reason.
- **`InMemorySink` / `NdjsonFileSink` / `HttpSink` / `TeeSink`** — four reference sinks for tests, local dev, simple deployments, and composition.
- **`canonicalize` / `canonicalHash` / `sha256Hex`** — the exact canonical-JSON SHA-256 every other Suite tool uses (byte-for-byte interop with the Python and Go verifiers).
- **`uuidv7`** — time-ordered UUID v7 generator (Node 20-compatible; one-line shim once we drop Node 20 in a future major).
- **Dual ESM/CJS** output via `tsc` + a post-build rename script. `package.json` exports map points both consumer styles at the right files.
- **TypeScript-first** source. All public types exported. `noUncheckedIndexedAccess` + `strict` on.
- **42 tests** across 4 suites (canonical, vault, audit-stream, integration). End-to-end integration test exercises vault → emit → chain verify → ed25519 sign + verify.
- **GitHub Actions CI** matrix on Node 20 + 22. Typecheck → test → build → ESM smoke → CJS smoke → standalone demo.
- **Apache-2.0** license — chosen so B2B SaaS embedders can drop this into closed-source products without copyleft friction.

### Design notes

- Always-emit `redaction_applied` when an empty array is *explicitly* passed (auditable: "vault contract considered, matched nothing" is meaningful), but omit when the caller doesn't pass the field at all (no implicit metadata).
- Hash + signature are computed over the SAME canonical body — that body excludes both `hash` and `signature` so each is independently verifiable.
- Default tokenizer is deterministic SHA-256-based. Production use should wire a vault-backed tokenizer via `applyVaultContractWith` for unlinkability.
- Zero runtime dependencies. Every dep is supply-chain surface in the hot path of customer-data-touching events.

### Not yet (Phase 2 candidates)

- Python SDK (parity with this TS+Node SDK).
- OpenTelemetry sink + spans.
- Decision Card CRDT for multi-party signing.
- Pre-built React + Vue hooks for browser-side dispatch (vs. the current server-side emission model).
- npm package publish (Phase 1 ships GitHub-first; npm publish is a Phase 1.x patch once name is reserved).

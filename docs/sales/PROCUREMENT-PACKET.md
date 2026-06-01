# Procurement Packet Starter — KGE-Enabled

> **A fill-in template for the SaaS company embedding `kinetic-gain-embedded` (KGE) that needs to answer a customer's enterprise security review.**
> Replace every `[BRACKETED]` placeholder with your real values. Delete sections that don't apply. Have your counsel review before sending. Nothing in this template is legal advice.

---

## How to use this packet

You're a B2B SaaS company. You embed KGE. Your customer's security team just asked you for a "security review packet" or "procurement packet" before they'll move to PoC. This template gives you 80% of the shape.

What this packet **gives you**:
- A defensible structure that matches what enterprise security teams expect to receive
- Concrete claims you can make about your trust boundary **because KGE primitives back them** (hash-chained audit, vault contracts, ed25519 signing)
- A vocabulary aligned with SOC 2 CC9.2, ISO/IEC 27018, GDPR Art. 28 — without claiming certifications you don't have

What this packet **doesn't give you**:
- A SOC 2 report (you still need the audit)
- A Data Processing Agreement (you still need counsel to draft)
- Standard Contractual Clauses (use the EU Commission's 2021 templates)
- Records of Processing Activities (Article 30)
- Permission to claim certifications you don't currently hold

**Honest framing — copy/paste verbatim:** "We are pre-SOC 2; this packet documents our current security posture and trust-boundary architecture, plus the third-party audit cadence we are committed to." Don't claim what you haven't earned.

---

## Cover page

```
PROCUREMENT + SECURITY OVERVIEW PACKET

Vendor:           [YOUR COMPANY NAME, INC.]
Product:          [YOUR PRODUCT NAME], version [X.Y]
Packet version:   1.0
Packet date:      [YYYY-MM-DD]
Recipient:        [CUSTOMER NAME — security review team]
Primary contact:  [NAME] · [EMAIL] · [PHONE]
Backup contact:   [NAME] · [EMAIL]
Trust portal:     [https://yourcompany.com/trust  (optional)]
DPA on file:      [Yes — signed 2026-MM-DD] / [Available on request]
```

---

## 1 · Executive summary

> [YOUR PRODUCT] is [one-sentence description of what your product does]. Your team will use it for [primary use case]. This packet documents the security and data-handling posture of the [YOUR PRODUCT] platform, with specific attention to the trust boundary between your customer data and any AI features or in-product analytics.
>
> [YOUR PRODUCT] is built on Kinetic Gain Embedded (`kinetic-gain-embedded` on npm) — a security-first audit-stream + vault contract SDK that gives you (the buyer) three things you can verify yourself:
>
> 1. **Replayable audit trail.** Every customer-data touch produces a hash-chained event your auditor can verify against the previous event's hash. We did not write the verification code — KGE ships `verifyChain()`, and you can run it on a fresh export.
> 2. **Tokenization before AI tools see sensitive data.** KGE's `applyVaultContract()` enforces the Decision Card you publish — fields you tag as sensitive get tokenized, masked, or dropped *before* they leave your trust boundary toward any AI model.
> 3. **Signed events for legal-hold scenarios.** Audit events are ed25519-signable; you can issue our public key and verify any event your auditor receives against it.
>
> Detailed coverage in the sections below.

---

## 2 · Company posture

| Item | Value |
|---|---|
| Legal entity | [YOUR LEGAL NAME, INC.] |
| Jurisdiction of incorporation | [STATE / COUNTRY] |
| Headquarters | [CITY, STATE] |
| Year founded | [YYYY] |
| Employees | [N] full-time, [N] contractors |
| Funding stage | [Seed / Series A / Series B / private / bootstrapped] |
| Insurance — cyber liability | [Yes — $N coverage with NAMED INSURER, COI available] |
| Insurance — E&O / professional liability | [Yes — $N coverage with NAMED INSURER, COI available] |
| Insurance — general liability | [Yes — $N coverage with NAMED INSURER, COI available] |

---

## 3 · Trust boundary architecture

[YOUR PRODUCT] runs on the following architecture. The trust boundary is **explicit and audited**:

```
                       ┌──────────────────────────────────┐
                       │   CUSTOMER (you) — your tenant   │
                       │   identifies users via [SSO/JWT] │
                       └─────────────────┬────────────────┘
                                         │
                                         │  HTTPS / TLS 1.3
                                         ▼
                       ┌──────────────────────────────────┐
                       │   [YOUR PRODUCT] application     │
                       │   in [YOUR REGION] · [YOUR CLOUD]│
                       └─────────────────┬────────────────┘
                                         │
                              KGE trust boundary
                                         │
                       ┌─────────────────┼────────────────┐
                       │                 │                │
                       ▼                 ▼                ▼
              ┌─────────────┐   ┌────────────────┐  ┌────────────┐
              │ DECISION    │   │ KGE            │  │ KGE        │
              │ CARD        │──▶│ applyVault     │  │ Audit      │
              │ (your data  │   │ Contract       │  │ Stream     │
              │ rules)      │   │ (tokenize)     │  │ (hash-chn) │
              └─────────────┘   └────────┬───────┘  └─────┬──────┘
                                         │                │
                                         ▼                ▼
                              ┌───────────────────┐  ┌─────────────┐
                              │ AI model / vendor │  │ Append-only │
                              │ (sees tokenized   │  │ log sink    │
                              │  payload only)    │  │ (NDJSON/    │
                              │                   │  │  HTTP/etc)  │
                              └───────────────────┘  └─────────────┘
```

**Key properties enforced by the boundary (verifiable by you):**

1. Sensitive fields tagged in **your** Decision Card are tokenized/masked/dropped before any AI vendor sees them.
2. Every customer-data touch emits an audit event with `prev_hash` chaining and a UUID v7 `event_id`.
3. Audit events are optionally ed25519-signed against [YOUR PRODUCT]'s published verification key.
4. The chain is verifiable end-to-end with `verifyChain()` — chain breaks surface as the exact event_id where verification failed.

---

## 4 · Data handling matrix

| Data category | Collected? | Stored where | Retention | Subprocessor access | Tokenized before AI? |
|---|---|---|---|---|---|
| Authentication identifiers (email, SSO subject) | [Yes] | [Region] | [Active subscription + 30 days] | [List or "none"] | [N/A — not sent to AI] |
| User-generated content | [Yes] | [Region] | [Active] | [List] | [Yes / per Decision Card] |
| Files / attachments | [Yes / No] | [Region] | [Active] | [List] | [Yes / per Decision Card] |
| Customer-supplied PII (names, addresses, etc.) | [Yes / No] | [Region] | [Active] | [List] | [Yes / tokenized] |
| Customer-supplied PHI | [No — out of scope unless BAA signed] | — | — | — | — |
| Cardholder data | [No — payment processor handles] | — | — | — | — |
| System logs | [Yes — operational] | [Region] | [13 months] | [Observability vendor name] | [Scrubbed of PII] |
| Audit events (KGE stream) | [Yes — required for replay] | [Region] | [Per your retention policy or DPA SLA] | [None — your tenant only] | [Per Decision Card] |

> **Note on PHI / cardholder data:** if your product touches either, this packet needs a HIPAA BAA addendum (PHI) or PCI-DSS-aligned subsection (cardholder data). Both are outside the scope of this starter — add them with counsel before sending.

---

## 5 · Subprocessor list

| Subprocessor | Role | Region | DPA on file | Sub-subprocessor disclosure |
|---|---|---|---|---|
| [Cloud infrastructure — e.g., AWS us-east-1 + eu-west-1] | Compute, database, object storage | [US + EU] | Yes — signed | Yes — list reviewed |
| [Database / managed service] | [If separate from compute] | [Region] | Yes | Yes |
| [Email delivery] | Transactional email | [Region] | Yes | Yes |
| [Error monitoring / log aggregation] | Application telemetry | [Region] | Yes | Yes |
| [Customer support helpdesk] | Ticketing | [Region] | Yes | Yes |
| [Payment processor] | Billing | [Region] | Yes — PCI scope | Yes |
| [AI model provider — only if applicable] | [Specific feature] | [Region — zero-retention endpoint if available] | Yes | Yes — list reviewed |

> **Subprocessor change notification commitment:** [YOUR PRODUCT] will notify customer at least [30] days before adding a new subprocessor, via [email to designated contact + trust portal update]. Customer may object within [N] days.

---

## 6 · Identity + access

- **Customer-to-product authentication:** [SAML 2.0 SSO / OAuth / JWT — describe what's supported]
- **Customer user provisioning:** [SCIM 2.0 / manual / JIT]
- **Multi-factor authentication:** [Required / customer-controlled]
- **Role-based access within your tenant:** [Describe role model]
- **Service account management for KGE audit-stream ingestion:** [How customer issues credentials; rotation cadence]
- **Privileged production access (your engineers):** [JIT elevation / break-glass procedure / audit logging]
- **Access review cadence:** [Quarterly internal · documented]

---

## 7 · Encryption + cryptographic controls

| Where | Algorithm | Key management |
|---|---|---|
| Data at rest | AES-256 | [Managed-key in primary region / customer-managed-key option for enterprise tier] |
| Data in transit (customer ↔ product) | TLS 1.3, modern cipher suites only | Managed certificates, no plaintext fallback |
| Data in transit (service-to-service inside trust boundary) | TLS 1.3 between services | Mutual TLS where mandatory |
| KGE audit-event signing (if enabled) | ed25519 | Public key published at [https://yourcompany.com/.well-known/audit-signing.json], rotated [annually / on-event] |
| KGE audit-event hashing | SHA-256 over canonical JSON | Deterministic — verifiable by buyer with `verifyChain()` from KGE SDK |

---

## 8 · KGE-specific verifiability statements

These are claims you can make **because KGE backs them**. They differentiate [YOUR PRODUCT] from competitors that built their own audit layer:

1. **"Our audit trail is hash-chained — your auditor can detect any single deleted or modified event in milliseconds."**
   Proof: `await verifyChain(events)` from `kinetic-gain-embedded` returns `{ ok: false, brokeAt: <event_id> }` on any tampered chain. Run it against a fresh export.

2. **"AI features in our product cannot see fields you tag as sensitive in your Decision Card."**
   Proof: `applyVaultContract(record, decisionCard)` is called before any AI model invocation. The returned `redactionApplied` array is recorded on the audit event — your auditor can verify what was redacted.

3. **"You can verify the integrity of any audit event we hand you, against our public key, with no proprietary tooling."**
   Proof: `verifyEd25519Signature(event, publicKey)` from KGE SDK. No client install, no SaaS dependency — just the npm package and our published key.

4. **"You define the rules. We enforce them in code."**
   The Decision Card is **your** machine-readable data-handling policy — version it in your own repo, version it on us. We do not encode "industry typical" rules — we apply the rules you encode.

---

## 9 · Audit + observability

- **Customer-facing audit stream:** every operation touching customer data emits a KGE audit event. Events are NDJSON; the schema is open at [https://kineticgain.com/.well-known/evidence/index.json] (KG AI Evidence Format spec).
- **Audit access:** [Real-time HTTP webhook to customer endpoint / daily NDJSON export / on-demand pull from customer's tenant API].
- **Audit retention by [YOUR PRODUCT]:** [13 months / per DPA].
- **Customer-controlled audit export:** [Customer may export their tenant's full audit history at any time; format = NDJSON, signature = ed25519 per event].
- **Internal observability:** [Datadog / Sentry / Grafana — describe stack]. PII is scrubbed before ingestion to observability stack per data-handling matrix above.

---

## 10 · Incident response

- **Incident detection:** [SOC / on-call rotation / 24×7 monitoring of error rates and security signals]
- **Initial customer notification timeline:** [Within N hours of confirmed customer-impacting incident]
- **Investigation cadence:** [Status updates every N hours during active incident]
- **Post-incident report commitment:** [Within N business days; includes timeline, scope, root cause, remediation]
- **Customer-side coordination:** [Named incident contact at customer, escalation path]
- **Regulatory notification:** [If breach affects regulated data, [YOUR PRODUCT] will support customer-led notification within statutory windows — GDPR Art. 33: 72 hours; state breach laws: per jurisdiction]

---

## 11 · Compliance posture

> Honest language: [YOUR PRODUCT] is **aligned in vocabulary** with the frameworks below. None of these are claims of current certification. Where third-party reports are listed, only completed reports are listed.

| Framework | Posture | Evidence |
|---|---|---|
| SOC 2 Type II | [In progress — target audit window QN YYYY] / [Completed report available under NDA] | [Auditor name] |
| ISO/IEC 27001 | [In scope assessment / not in scope] | — |
| ISO/IEC 27018 (cloud PII processing) | Vocabulary-aligned; specific controls documented in Annex | — |
| ISO/IEC 42001 (AI management systems) | [If you ship AI features] Vocabulary-aligned for the AI use case scope below | — |
| GDPR + UK GDPR | Processor role under Art. 4(8); DPA available; SCCs (2021) for EU-to-US; UK IDTA addendum | [DPA on file] |
| CPRA / state US | Service Provider role under CPRA §1798.140(ag) | [DPA on file] |
| NIST AI RMF 1.0 | [If applicable] Map function vocabulary-aligned for the AI use case below | — |
| EU AI Act | [If applicable] Disclosure aligned with Articles 9–15 vocabulary for high-risk-system documentation | — |
| HIPAA | [BAA available on request for healthcare customers] / [Out of scope] | — |
| FERPA | [School official designation available for EdTech customers] / [Out of scope] | — |
| WCAG 2.2 AA | [Self-assessment available; VPAT in progress] | — |

---

## 12 · AI use disclosure (delete if no AI features)

If [YOUR PRODUCT] embeds AI features, complete and attach an **AI System Card** for each system. The KG template is at <https://kineticgain.com/trust/ai-system-card/> — fill it in, export as markdown or JSON, attach to this packet.

Minimum coverage per system:
- System purpose + affected populations
- Model or vendor (free text — your choice)
- Inputs / data sources + categories of customer data sent
- Human review point (threshold, sample rate, escalation)
- Risk level + customer impact if wrong
- Known limitations
- Training opt-out status (if vendor-hosted)
- Review cadence

Pair the System Card with the Decision Card you publish for [YOUR PRODUCT] — together they document **what AI is in the product** and **what customer data the AI is allowed to see**.

---

## 13 · Business continuity + termination

- **Backups:** [N-day rolling backups, restore tested [quarterly]]
- **Disaster recovery:** [RTO N hours, RPO N hours, tested [annually]]
- **Multi-region failover:** [If applicable]
- **Customer-initiated data export:** customer may export their tenant's data at any time via [API / admin console], format = [JSON / CSV / NDJSON]
- **Customer-initiated deletion:** completed within [30] days of written request; written confirmation issued
- **[YOUR PRODUCT] business continuity:** in the event of [YOUR COMPANY] wind-down, escrow agreement / source-code escrow / customer self-host migration path = [describe or "not currently provided"]
- **Sub-deletion verification with subprocessors:** verified per their published SLA and reconciled [annually]

---

## 14 · Contractual + legal

- **Data Processing Agreement (DPA):** [Available — signed copy on file from YYYY-MM-DD] / [Template available on request]
- **Standard Contractual Clauses (EU 2021 modules):** included as Annex II of DPA where applicable
- **UK International Data Transfer Addendum:** included as Annex II.1 of DPA where applicable
- **Business Associate Agreement (HIPAA):** [Available on request for healthcare customers]
- **Master Service Agreement / Order Form:** [Template available; redlines welcomed]
- **Limitation of liability:** [Standard SaaS — describe or refer to MSA]
- **Indemnification:** [Standard SaaS — describe or refer to MSA]
- **Governing law:** [Jurisdiction]
- **Dispute resolution:** [Forum / arbitration clause]

---

## 15 · Questionnaire response cross-reference

This packet maps to the most common enterprise security questionnaires. If your customer sent one of these, reference this packet section:

| Customer questionnaire | Closest packet section |
|---|---|
| SIG (Shared Assessments) Lite | §3 trust boundary · §4 data handling · §5 subprocessors · §11 compliance |
| CAIQ (Cloud Security Alliance) | §3 architecture · §6 IAM · §7 encryption · §10 IR · §11 compliance |
| VSA (Vendor Security Alliance) Core | §2 company · §3 boundary · §6 IAM · §10 IR · §13 BC |
| Custom AI security questionnaire | §8 KGE verifiability · §12 AI System Cards |

---

## 16 · How to verify the claims in this packet yourself

The KGE primitives this packet relies on are open-source, npm-published, and verifiable without running our product:

```bash
# Install the SDK your customer uses
npm install kinetic-gain-embedded

# Verify a fresh audit-stream export from your tenant
node -e "
  import('kinetic-gain-embedded').then(async ({ verifyChain }) => {
    const events = JSON.parse(require('fs').readFileSync('audit-export.ndjson').toString().trim().split('\n').map(JSON.parse));
    const result = await verifyChain(events);
    console.log(result.ok ? 'CHAIN INTACT' : 'CHAIN BROKEN AT ' + result.brokeAt);
  });
"

# Verify a single event signature against our published public key
curl https://yourcompany.com/.well-known/audit-signing.json
# Then use verifyEd25519Signature() from the same SDK
```

We hand you the auditor's tools. You don't need to take our word for it.

**Parallel:** Kinetic Gain's own security posture follows the same discipline. Every defensive layer running on the KG estate is documented and independently verifiable at <https://kineticgain.com/trust/security-posture/>. If KGE didn't dogfood the verifiability pattern we sell, you'd be right to discount this packet.

---

## 17 · Adjacent KG buyer-side templates

Your customer's security team may also benefit from these public buyer-side templates (which document the **inverse** of what this packet provides — they help your customer evaluate and govern what they're buying):

- [**AI Vendor Intake Form**](https://kineticgain.com/trust/ai-vendor-intake/) — 12-field intake for their internal AI vendor approval
- [**AI System Card Builder**](https://kineticgain.com/trust/ai-system-card/) — 14-field documentation template for any AI system they deploy
- [**Vendor AI Disclosure Review**](https://kineticgain.com/trust/vendor-ai-disclosure-review/) — 10-dimension rubric for evaluating AI disclosures they receive (incl. this one)
- [**Evidence Locker Template**](https://kineticgain.com/trust/evidence-locker/) — 8-section scaffold for organizing artifacts
- [**Subprocessor Disclosure Template**](https://kineticgain.com/trust/subprocessors/) — what they should publish for their own customers
- [**Executive Risk Register Starter**](https://kineticgain.com/trust/risk-register/) — 10-column template for tracking vendor-related risks
- [**KG Security Posture**](https://kineticgain.com/trust/security-posture/) — KG's own posture, published the same way we ask vendors to publish theirs (17 defensive layers, every claim verifiable)

Pointing them at these tools builds trust — you're handing them the evaluation framework, not running from it.

---

## Disclaimers

This template is provided by Kinetic Gain LLC as part of the `kinetic-gain-embedded` SDK distribution. It is **scaffolding for human use**, not legal advice, not procurement consulting, not a substitute for SOC 2 / ISO 27001 audit, and not a substitute for counsel review before sending to a customer. Sections marked with `[BRACKETED]` placeholders are not statements about your security posture until you fill them in truthfully and your team validates them.

The Apache-2.0 license on the `kinetic-gain-embedded` SDK applies to this template's text and structure. You may adapt, fork, redistribute, and modify under those terms.

Aligned in vocabulary with: SOC 2 CC9.2, ISO/IEC 27018:2019, GDPR Art. 28, CPRA §1798.140, NIST AI RMF 1.0, EU AI Act high-risk-system disclosure expectations, ISO/IEC 42001:2023. Does **not** satisfy or meet any of these frameworks on its own.

---

_Template version 1.0 · 2026-05-31 · Maintained alongside `kinetic-gain-embedded` SDK_
_Filed under: KGE sales-enablement lane_
_Companion runtime: [kinetic-gain-embedded on npm](https://www.npmjs.com/package/kinetic-gain-embedded)_

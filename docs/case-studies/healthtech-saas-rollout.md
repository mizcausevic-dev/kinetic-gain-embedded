# Case study: HealthTech SaaS rollout in 3 weeks

> **Synthetic but defensible.** The vendor profile, customer profile, timeline, and numbers below are illustrative — they describe the *shape* of how a real KGE rollout lands. Where we cite industry benchmarks, sources are public and named. We will replace this with named-customer case studies as they ship.

---

## The vendor

**Profile:** Mid-stage HealthTech SaaS company, ~80 people, $14M ARR. Product is a clinical-ops platform that ingests EHR data (FHIR R4) and routes care-coordination tasks to the right clinician.

**Trigger:** Two new enterprise customers (large regional health systems) put security review on the critical path before PoC. Both customers' procurement teams asked for:
- A formal vendor diligence packet
- Evidence that PHI access is logged and replayable by an auditor
- A clear vault-contract that survives turnover on both sides

The vendor had a pre-SOC 2 trust-boundary story, but it was a narrative, not a runtime-verifiable artifact. The first PoC stalled at 6 weeks. The second was tracking the same path.

---

## The constraint

The vendor's engineering team had **one infrastructure engineer with 30% bandwidth** to allocate to this work. Buying a Vanta-style trust portal was out of budget (~$25K/year minimum) and would not have produced the artifact the customer's auditor actually wanted — *which tool read what patient record, when, under what consent*.

Hiring a compliance consultant would have cost ~$60K and produced documents rather than runtime evidence.

The vendor needed an option that:
1. Shipped runtime audit primitives, not paperwork
2. Was open-source so the customer's security team could verify implementation
3. Got the trust-boundary claim into a procurement packet they could send within 3 weeks

---

## The approach

**Week 1: SDK integration**
The engineer dropped `kinetic-gain-embedded` (KGE) into the platform's data-access layer. Three lines of code:

```ts
const card = parseDecisionCard(JSON.parse(decisionCardJson));
const audit = new AuditStream({ source: "platform-prod", decisionCardRef: card.canonical_url, sink: new NdjsonFileSink("/var/log/audit.ndjson") });
const { payload, redactionApplied } = applyVaultContract(patientRecord, card);
```

The Decision Card was authored once by the vendor's lead clinician + compliance lead (~4 hours of work, using the Decision Card v0.3 spec). It declared `data_vault_targets` for the PHI fields the customer's policy required redacted, plus a `retention_envelope` for each.

**Week 2: Procurement packet**
The vendor took the `docs/sales/PROCUREMENT-PACKET.md` template from the KGE repo, filled in the bracketed sections for their company, and made the four §8 KGE-backed verifiable claims:

1. Hash-chained audit (every PHI access lands in append-only NDJSON; `GET /verify` walks the chain end-to-end)
2. Vault-contract tokenization (PHI fields tokenized per the customer-published Decision Card)
3. ed25519-signable (every audit emission can be signed for non-repudiation)
4. Customer-defined Decision Card (customer publishes the policy; vendor enforces at runtime)

They explicitly used "readiness for SOC 2 CC9.2 / ISO 27018 / GDPR Art. 28" rather than claiming certifications they didn't have. The packet was 22 pages.

**Week 3: Customer-side verification**
The customer's security team ran the audit-stream against a synthetic patient record. The hash chain verified. The Decision Card replayed cleanly. The vault contract redacted the expected fields. The audit-stream signature validated against the vendor's published ed25519 public key.

The customer's auditor signed off in a 30-minute call.

---

## The outcome (measured)

| Before KGE | After KGE | Delta |
|---|---|---|
| Trust-boundary claim was a narrative | Trust-boundary claim is a runtime artifact | qualitative shift |
| First PoC stalled at week 6 | Both PoCs closed by week 4 | **~2 weeks deal-cycle compression per deal** |
| Internal infrastructure-engineer time on audit/diligence: ~12 hours/week | ~3 hours/week | **~36 hours/month recovered** |
| Compliance-consultant retainer: ~$5K/month | $0 (not needed for this scope) | **$60K/year** |
| Total spend on KGE Team tier | $3,500/month = $42K/year | Net: ~$18K/year saved + ~36 eng-hours/month recovered |

The vendor's CRO described it in the post-PoC retro as *"the first time security stopped being the bottleneck."*

The infrastructure engineer's quote: *"I was honestly worried about adding another dependency. But it's 28KB and zero runtime deps. The pre-flight tests catch what I'd have caught — and I don't have to write the test scaffolding myself."*

---

## What this case study explicitly is and isn't

**It is:** an honest depiction of the *shape* of a KGE rollout for a HealthTech SaaS vendor in the typical $10–30M ARR band with one mid-sized engineering team.

**It isn't:**
- A claim that we have closed this customer (we haven't — KGE is pre-commercial)
- A guarantee that your numbers match these (they almost certainly won't, exactly)
- A statement that KGE replaces SOC 2 (it doesn't — it gives you the artifact, you still need the audit)
- A claim of HIPAA / HITRUST / SOC 2 compliance (KGE provides primitives; *your* implementation determines compliance posture, and *your* auditor signs off)

**What we will share when we have it:** a named-customer version of this same story, with their permission, against measured numbers from their actual rollout. If you want to be the first one of those, [join the waitlist](https://kineticgain.com/embedded/pricing/) or [open a contact thread](https://kineticgain.com/contact).

---

## Adjacent reading

- [Procurement Packet Starter](../sales/PROCUREMENT-PACKET.md) — the 17-section fill-in template referenced in Week 2
- [KGE SDK on GitHub](https://github.com/mizcausevic-dev/kinetic-gain-embedded) — the open-source library that ships the runtime primitives
- [Pricing & tiers](https://kineticgain.com/embedded/pricing/) — what each hosted tier adds beyond the free SDK
- [Trust Pack](https://kineticgain.com/trust/) — buyer-side toolkit your customer's risk team can use to draft the Decision Card

---

*Last updated: 2026-05-31. Author: Miz Causevic. License: CC BY 4.0 — feel free to share.*

// demo.mjs — Standalone end-to-end demo.
//
// Run:  node examples/standalone/demo.mjs
// Reads from a fake customer record, applies a vault contract, emits 3
// hash-chained audit events, then verifies the chain.

import { AuditStream, applyVaultContract, parseDecisionCard, InMemorySink, verifyChain } from "../../dist/esm/index.js";

const DECISION_CARD = {
  decision_card_id: "DEMO-D-2026-001",
  spec_version: "0.3",
  canonical_url: "https://demo-saas.example/.well-known/decisions/DEMO-D-2026-001.json",
  issuer: { name: "Demo SaaS" },
  subject: { vendor: "VendorAI", product: "ChatAssist", version: "3.1" },
  vault_contract: {
    profile: "pii-vault-v0.1",
    rules: [
      { field: "customer.name",  action: "tokenize" },
      { field: "customer.email", action: "mask"     },
      { field: "customer.ssn",   action: "hash"     }
    ]
  }
};

const card = parseDecisionCard(DECISION_CARD);
const sink = new InMemorySink();
const audit = new AuditStream({
  source: "chat-assist-prod",
  decisionCardRef: card.canonical_url,
  sink
});

// Simulate three AI tool interactions
for (let turn = 0; turn < 3; turn++) {
  const record = {
    customer: { name: "Jane Doe", email: "jane@example.com", ssn: "123-45-6789", accountId: "acct-001" },
    query: `Question ${turn + 1}`
  };
  const { payload, redactionApplied } = applyVaultContract(record, card);

  await audit.emit({
    kind: "ai.chat.turn",
    redaction_applied: redactionApplied,
    turn,
    customer_view: payload.customer  // what the AI tool actually sees
  });
}

console.log(`Emitted ${audit.eventCount} events.`);
console.log(`Last hash: ${audit.lastHash}`);

const verdict = verifyChain(sink.events);
if (verdict.ok) console.log(`Chain verified: ${sink.events.length} events ✓`);
else            console.error(`Chain broken at event #${verdict.firstBreakAt}: ${verdict.reason}`);

console.log("\nFirst event:");
console.log(JSON.stringify(sink.events[0], null, 2));

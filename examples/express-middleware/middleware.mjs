// middleware.mjs — Express middleware that emits one audit event per
// request that touches a vault-governed payload.
//
// Usage in an Express app:
//
//   import express from "express";
//   import { AuditStream, applyVaultContract, NdjsonFileSink } from "kinetic-gain-embedded";
//   import { createAuditMiddleware } from "./middleware.mjs";
//
//   const app = express();
//   app.use(express.json());
//
//   const audit = new AuditStream({
//     source: "my-saas-prod",
//     decisionCardRef: process.env.DECISION_CARD_URL,
//     sink: new NdjsonFileSink("/var/log/audit.ndjson")
//   });
//
//   app.use(createAuditMiddleware({ audit, decisionCard }));
//
//   app.post("/api/process", (req, res) => {
//     // req.vaultPayload is the tokenized version of req.body
//     // req.body is untouched
//     res.json({ ok: true });
//   });

import { applyVaultContract } from "kinetic-gain-embedded";

export function createAuditMiddleware({ audit, decisionCard, kind = "http.request" }) {
  return async function auditMiddleware(req, res, next) {
    try {
      if (!req.body) return next();
      const { payload, redactionApplied } = applyVaultContract(req.body, decisionCard);
      req.vaultPayload = payload;  // tokenized body for downstream handlers
      await audit.emit({
        kind,
        redaction_applied: redactionApplied,
        http_method: req.method,
        http_path: req.path,
        request_id: req.headers["x-request-id"] ?? null
      });
      next();
    } catch (err) {
      next(err);
    }
  };
}

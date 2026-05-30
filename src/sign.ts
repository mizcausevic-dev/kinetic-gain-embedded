// sign.ts — ed25519 signer + verifier helpers, built on node:crypto's
// KeyObject API. No external dependencies.
//
// Convention across the Kinetic Gain Protocol Suite:
//   - Signature algorithm: ed25519
//   - Signature value: base64 (NOT base64url) over canonical body excluding `signature`
//   - Public key distribution: published JWK at a `key_uri` the verifier can fetch

import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import type { AuditEvent, AuditEventSigner } from "./types.js";
import { canonicalize } from "./canonical.js";

/** Create an ed25519 signer from a PKCS#8 PEM-encoded private key. */
export function createEd25519Signer(opts: {
  privateKeyPem: string;
  keyUri: string;
}): AuditEventSigner {
  const key = createPrivateKey({ key: opts.privateKeyPem, format: "pem" });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`createEd25519Signer: expected ed25519 key, got ${key.asymmetricKeyType}`);
  }
  return {
    keyUri: opts.keyUri,
    sign(canonicalBody: string): string {
      // ed25519 signs the message directly (no hash-then-sign); pass null for algorithm.
      const sig = nodeSign(null, Buffer.from(canonicalBody, "utf8"), key);
      return sig.toString("base64");
    }
  };
}

/** Verify an event's ed25519 signature against a known public key (SPKI PEM). */
export function verifyEd25519Signature(event: AuditEvent, publicKeyPem: string): boolean {
  if (!event.signature) return false;
  if (event.signature.alg !== "ed25519") return false;
  const pub = createPublicKey({ key: publicKeyPem, format: "pem" });
  if (pub.asymmetricKeyType !== "ed25519") return false;

  // Recreate the canonical body the signer signed: event minus `hash` and `signature`.
  const { hash: _h, signature: _s, ...body } = event;
  const message = Buffer.from(canonicalize(body), "utf8");
  const sigBytes = Buffer.from(event.signature.value, "base64");

  try {
    return nodeVerify(null, message, pub, sigBytes);
  } catch {
    return false;
  }
}

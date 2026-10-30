#!/usr/bin/env node
/**
 * Client minimal de l'API Cybersup Exam avec signature HMAC.
 *
 * Variables d'environnement :
 *   CX_API_URL         ex. https://exam.cybersup.ai
 *   CX_API_KEY         cxk_xxxxxxxxxxxx_...
 *   CX_SIGNING_SECRET  secret de signature affiché à la création de la clé
 *
 * Usage :
 *   node scripts/api-client.mjs GET /api/v1/tests
 *   node scripts/api-client.mjs POST /api/v1/tests/<id>/invites '{"emails":["a@b.fr"]}'
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

const [method = "GET", path = "/api/v1/tests", body = ""] = process.argv.slice(2);
const { CX_API_URL, CX_API_KEY, CX_SIGNING_SECRET } = process.env;
if (!CX_API_URL || !CX_API_KEY || !CX_SIGNING_SECRET) {
  console.error("Définissez CX_API_URL, CX_API_KEY et CX_SIGNING_SECRET");
  process.exit(1);
}

const ts = Math.floor(Date.now() / 1000).toString();
const nonce = randomBytes(18).toString("base64url");
const bodyHash = createHash("sha256").update(body).digest("hex");
const canonical = `${ts}\n${nonce}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;
const signature = createHmac("sha256", CX_SIGNING_SECRET).update(canonical).digest("hex");

const res = await fetch(CX_API_URL.replace(/\/$/, "") + path, {
  method: method.toUpperCase(),
  headers: {
    Authorization: `Bearer ${CX_API_KEY}`,
    "Content-Type": "application/json",
    "X-Cx-Timestamp": ts,
    "X-Cx-Nonce": nonce,
    "X-Cx-Signature": signature,
  },
  body: body || undefined,
});
console.log(res.status, res.headers.get("content-type")?.includes("json") ? JSON.stringify(await res.json(), null, 2) : await res.text());

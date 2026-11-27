const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText, filename);

const { normalizeSlug } = require("../src/lib/site-slug.ts");
const { verifyWorkOSSessionToken } = require("../src/lib/server/api.ts");
const { getByShareId, listByOwner, updateByShareId } = require("../convex/sharing.ts");

test("site slugs preserve their canonical form even with large separators", () => {
  assert.equal(normalizeSlug(" __-A   __site!  name-__ "), "a-site-name");
  assert.equal(normalizeSlug("__---__"), "");
  assert.equal(normalizeSlug(`first${"-".repeat(100_000)}second`), "first-second");
});

test("WorkOS token verification requires an authorised signing key, issuer and session", async () => {
  const { SignJWT, generateKeyPair } = await import("jose");
  const trusted = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const clientId = "client_test";
  const issuer = `https://api.workos.com/user_management/${clientId}`;
  const sign = ({ key = trusted.privateKey, iss = issuer, expires = "10m", sid = "session_test", aud } = {}) => {
    const jwt = new SignJWT(sid ? { sid } : {})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(iss)
      .setSubject("user_test")
      .setExpirationTime(expires);
    return (aud ? jwt.setAudience(aud) : jwt).sign(key);
  };
  const verify = async (options) => verifyWorkOSSessionToken(await sign(options), clientId, () => trusted.publicKey);
  const identity = { userId: "user_test", sessionId: "session_test" };
  assert.deepEqual(await verify(), identity);
  assert.deepEqual(await verify({ iss: "https://api.workos.com/", aud: clientId }), identity);
  assert.equal(await verify({ iss: "https://api.workos.com/", aud: "client_other" }), null);
  await assert.rejects(verify({ key: other.privateKey }), { code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" });
  await assert.rejects(verify({ iss: "https://example.com/" }), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" });
  await assert.rejects(verify({ expires: "-10m" }), { code: "ERR_JWT_EXPIRED" });
  await assert.rejects(verify({ sid: "" }), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" });
});

test("private Convex shares restrict access to owners and verified invitees", async () => {
  const note = { _id: "note", ownerUserId: "owner", visibility: "private", permission: "edit", allowedUsers: ["guest@example.com"] };
  const auth = (identity) => ({ getUserIdentity: async () => identity });
  const patches = [];
  const db = {
    query: () => ({ withIndex: () => ({ unique: async () => note }) }),
    patch: async (id, patch) => patches.push({ id, patch }),
  };
  const share = { shareId: "share" };
  const edit = { ...share, content: "Updated", title: "A note" };
  const guest = { subject: "guest", markup_email: "Guest@Example.com", markup_email_verified: true };

  assert.equal(await getByShareId._handler({ db, auth: auth(null) }, share), null);
  assert.equal(await getByShareId._handler({ db, auth: auth({ ...guest, markup_email_verified: false }) }, share), null);
  assert.deepEqual(await getByShareId._handler({ db, auth: auth(guest) }, share), { ...note, allowedUsers: [] });
  assert.ok(await getByShareId._handler({ db, auth: auth({ subject: "owner" }) }, share));
  await assert.rejects(listByOwner._handler({ db, auth: auth(guest) }, { ownerUserId: "owner" }), /Unauthorized/);
  await updateByShareId._handler({ db, auth: auth(null) }, edit);
  assert.equal(patches.length, 0);
  await updateByShareId._handler({ db, auth: auth(guest) }, edit);
  assert.deepEqual(patches, [{ id: "note", patch: { content: "Updated", title: "A note" } }]);

  note.visibility = "public";
  assert.ok(await getByShareId._handler({ db, auth: auth(null) }, share));
  note.permission = "read";
  await updateByShareId._handler({ db, auth: auth(null) }, edit);
  assert.equal(patches.length, 1);
});

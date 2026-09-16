import test from "node:test";
import assert from "node:assert/strict";
import {verifyHostKey} from "../lib/host-key.ts";

// Public fixtures for local development only, never production credentials.
const localKey = "AVL-TEST-KEYS-2345-6789";
const localHash = "a05617900e7b3165bfe3a81942dab6339dd50e8924b6a372407c219d61b63f08";
async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

test("Host keys accept case-insensitive input with outer whitespace and configured hash rotation", async () => {
  const alternative = "AVL-ABCD-EFGH-JKLM-NPQR";
  const alternativeHash = await digest(alternative);
  assert.equal(await verifyHostKey(`  ${localKey.toLowerCase()}\n`, localHash), true);
  assert.equal(await verifyHostKey(localKey, `ignored,${alternativeHash}\n${localHash.toUpperCase()}`), true);
  assert.equal(await verifyHostKey(alternative, `${localHash}, ${alternativeHash}`), true);
  assert.equal(await verifyHostKey(localKey, alternativeHash), false);
});

test("Missing or unusable host-key configuration fails closed", async () => {
  for (const configuration of [undefined, null, "", " \n, ", "malformed", [], {}, localKey, "a".repeat(63), "a".repeat(65)]) {
    assert.equal(await verifyHostKey(localKey, configuration), null);
  }
  assert.equal(await verifyHostKey(localKey, " ".repeat(8193) + localHash), null);
  assert.equal(await verifyHostKey(localKey, Array(65).fill(localHash).join(",")), null);
});

test("Host-key format, type and size are validated before accepting a matching digest", async () => {
  for (const value of [undefined, null, "", false, 123, [], {}, {hostKey: localKey}, "AVL-TEST-KEYS-2345-6788", localHash]) {
    assert.equal(await verifyHostKey(value, localHash), false);
  }
  for (const value of ["arbitrary password", "AVL-TEST-KEYS-2345-678", "AVL-TEST-KEYS-2345-67890", "AVL-TEST-KEYS-2345-678I", "AVL-TEST-KEYS-2345-678O", "AVL-TEST-KEYS-2345-6781", "AVL-TEST-KEYS-2345-6780", `${localKey}\u0000`]) {
    assert.equal(await verifyHostKey(value, await digest(value)), false);
  }
  assert.equal(await verifyHostKey(" ".repeat(105) + localKey, localHash), true);
  assert.equal(await verifyHostKey(" ".repeat(106) + localKey, localHash), false);
  assert.equal(await verifyHostKey("A".repeat(100_000), localHash), false);
});

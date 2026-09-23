import test from "node:test";
import assert from "node:assert/strict";
import {canonicalHostKey, verifyHostKey} from "../lib/host-key.ts";

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

test("Host keys are accepted with or without the AVL prefix and hyphens, against the unchanged digest", async () => {
  // The digest is always taken over the canonical AVL-XXXX-XXXX-XXXX-XXXX form.
  assert.equal(await digest(canonicalHostKey("test keys 2345 6789".replaceAll(" ", ""))), localHash);
  for (const typed of ["TESTKEYS23456789", "testkeys23456789", "TEST-KEYS-2345-6789", "AVLTESTKEYS23456789", "avl-test-keys-2345-6789", "  TESTKEYS23456789\n"]) {
    assert.equal(canonicalHostKey(typed), localKey, typed);
    assert.equal(await verifyHostKey(typed, localHash), true, typed);
  }
  // A key whose own first characters are A-V-L still works without the prefix.
  const avlKey = "AVL-AVLB-CDEF-GHJK-MNPQ";
  assert.equal(await verifyHostKey("AVLBCDEFGHJKMNPQ", await digest(avlKey)), true);
  assert.equal(await verifyHostKey("AVLAVLBCDEFGHJKMNPQ", await digest(avlKey)), true);
});

test("Loosened formats still reject malformed, ambiguous and look-alike keys", async () => {
  for (const typed of [
    "TESTKEYS2345678", "TESTKEYS234567890", // wrong length
    "TESTKEYS2345678O", "TESTKEYS23456781", "TESTKEYS2345678I", "TESTKEYS23456780", // excluded look-alikes
    "TEST KEYS 2345 6789", "TEST_KEYS_2345_6789", "TE-STKEYS-2345-6789", "TEST-KEYS23456789", // odd separators
    "AVL-TESTKEYS23456789", "XYZ-TEST-KEYS-2345-6789", "AVLTEST-KEYS-2345-6789", "TEST--KEYS-2345-6789",
  ]) {
    assert.equal(canonicalHostKey(typed), null, typed);
    assert.equal(await verifyHostKey(typed, localHash), false, typed);
  }
});

test("The host-key field keeps only the 16 key characters and shows them in groups of four", async () => {
  const {hostKeyBody, hostKeyCharacters, formatHostKey, formattedCaret, hostKeyForSubmit, HOST_KEY_LENGTH} = await import("../lib/host-key-input.ts");
  assert.equal(HOST_KEY_LENGTH, 16);
  assert.equal(hostKeyBody("test-keys 2345"), "TESTKEYS2345");
  assert.equal(hostKeyBody("t0e1sItOkeys"), "TESTKEYS", "0/1/I/O and other characters are filtered");
  assert.equal(hostKeyBody("AVL-TEST-KEYS-2345-6789"), "TESTKEYS23456789", "a pasted full key loses its prefix");
  assert.equal(hostKeyBody("avl test keys 2345 6789"), "TESTKEYS23456789");
  assert.equal(hostKeyBody("AVLTESTKEYS23456789"), "TESTKEYS23456789");
  assert.equal(hostKeyBody("AVLBCDEFGHJKMNPQ"), "AVLBCDEFGHJKMNPQ", "keys that begin with AVL are kept whole");
  assert.equal(hostKeyBody("TESTKEYS23456789XYZ"), "TESTKEYS23456789", "capped at 16");
  assert.equal(hostKeyCharacters("TEST-XKEY-S234-5678-9"), "TESTXKEYS23456789", "overflow stays visible so the field can refuse it");
  assert.equal(hostKeyCharacters("AVL-TEST-KEYS-2345-6789"), "TESTKEYS23456789");
  assert.equal(formatHostKey(""), "");
  assert.equal(formatHostKey("TEST"), "TEST");
  assert.equal(formatHostKey("TESTK"), "TEST-K");
  assert.equal(formatHostKey("TESTKEYS23456789"), "TEST-KEYS-2345-6789");
  assert.equal(formatHostKey(hostKeyBody(formatHostKey("TESTKEYS2"))), "TEST-KEYS-2", "re-filtering the display is stable");
  assert.deepEqual([0, 1, 4, 5, 8, 9, 16].map(formattedCaret), [0, 1, 4, 6, 9, 11, 19]);
  const submitted = hostKeyForSubmit(hostKeyBody("test keys 2345 6789"));
  assert.equal(submitted, localKey);
  assert.equal(await verifyHostKey(submitted, localHash), true);
});

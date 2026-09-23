import test from "node:test";
import assert from "node:assert/strict";
import { submitDelivery } from "../lib/submit-status.ts";

test("a server answer counts as delivered, and a timeout or a dropped request does not", () => {
  assert.equal(submitDelivery(null), "saved");
  assert.equal(submitDelivery({ status: 409 }), "saved");
  assert.equal(submitDelivery({ status: 403 }), "saved");
  assert.equal(submitDelivery({ name: "TimeoutError", status: 0 }), "unsent");
  assert.equal(submitDelivery({ name: "TypeError" }), "unsent");
  assert.equal(submitDelivery({}), "unsent");
});

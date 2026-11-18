import assert from "node:assert/strict";
import test from "node:test";
import { incompleteResponseStatus, removeIncompleteResponse } from "./response-state.mjs";

test("failed partial output is removed and labelled as discarded", () => {
  const messages = [
    { id: "creator", role: "creator", text: "Hi" },
    { id: "pending", role: "em", text: "partial answer" },
  ];
  const result = removeIncompleteResponse(messages, "pending");
  assert.deepEqual(result.messages, [messages[0]]);
  assert.equal(result.hadPartialText, true);
  assert.match(incompleteResponseStatus({ cancelled: false, hadPartialText: result.hadPartialText, errorMessage: "Local model timed out." }), /incomplete response was discarded/i);
});

test("cancelling partial output says that the incomplete text was discarded", () => {
  assert.match(incompleteResponseStatus({ cancelled: true, hadPartialText: true, errorMessage: "" }), /partial response was discarded/i);
});

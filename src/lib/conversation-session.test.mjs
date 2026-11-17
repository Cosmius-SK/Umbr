import assert from "node:assert/strict";
import test from "node:test";
import {
  loadConversationSession,
  saveConversationSession,
  STORAGE_KEY,
} from "./conversation-session.mjs";

const welcome = [{ id: "welcome", role: "em", text: "I'm Em." }];
const history = [
  ...welcome,
  { id: "creator-1", role: "creator", text: "Hello" },
  { id: "em-1", role: "em", text: "I'm Em." },
];

function storageWith(value = null) {
  const values = new Map(value === null ? [] : [[STORAGE_KEY, value]]);
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, next) { values.set(key, next); },
  };
}

test("restores valid history and preserves tab storage", () => {
  const storage = storageWith(JSON.stringify(history));
  assert.deepEqual(loadConversationSession(() => storage, welcome), {
    status: "ready", messages: history, storageAvailable: true,
  });
});

test("empty storage uses welcome history without treating storage as unavailable", () => {
  assert.deepEqual(loadConversationSession(() => storageWith(), welcome), {
    status: "ready", messages: welcome, storageAvailable: true,
  });
});

test("malformed JSON falls back safely without marking storage unavailable", () => {
  assert.deepEqual(loadConversationSession(() => storageWith("{"), welcome), {
    status: "ready", messages: welcome, storageAvailable: true,
  });
});

test("invalid message structures fall back safely", () => {
  for (const invalid of ["null", "{}", "[]", '[{"id":1,"role":"em","text":"x"}]', '[{"id":"x","role":"system","text":"x"}]', '[{"id":"x","role":"em","text":2}]']) {
    assert.deepEqual(loadConversationSession(() => storageWith(invalid), welcome), {
      status: "ready", messages: welcome, storageAvailable: true,
    });
  }
});

test("loading state cannot overwrite a valid saved history", () => {
  const storage = storageWith(JSON.stringify(history));
  let accesses = 0;
  const getStorage = () => { accesses += 1; return storage; };
  assert.equal(saveConversationSession(getStorage, { status: "loading", messages: welcome }), undefined);
  assert.equal(accesses, 0);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), history);
});

test("unavailable storage falls back and reports read and write failures", () => {
  const getStorage = () => { throw new Error("Storage denied"); };
  assert.deepEqual(loadConversationSession(getStorage, welcome), {
    status: "ready", messages: welcome, storageAvailable: false,
  });
  assert.equal(saveConversationSession(getStorage, { status: "ready", messages: history }), false);
});

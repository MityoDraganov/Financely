import assert from "node:assert";
import { test } from "node:test";
import {
  createOwnershipTransferToken,
  hashOwnershipTransferToken,
  isOwnershipTransferExpired,
  normalizeEmail,
} from "./organization-ownership-transfer-utils";

test("normalizeEmail trims and lowercases emails", () => {
  assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
});

test("hashOwnershipTransferToken is deterministic", () => {
  const token = "abc123";
  assert.equal(
    hashOwnershipTransferToken(token),
    hashOwnershipTransferToken(token),
  );
});

test("createOwnershipTransferToken returns token and hash pair", () => {
  const transferToken = createOwnershipTransferToken();
  assert.equal(transferToken.tokenHash, hashOwnershipTransferToken(transferToken.token));
  assert.equal(typeof transferToken.token, "string");
  assert.equal(typeof transferToken.tokenHash, "string");
  assert.ok(transferToken.token.length >= 32);
  assert.ok(transferToken.tokenHash.length > 0);
});

test("isOwnershipTransferExpired checks ISO timestamps correctly", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isOwnershipTransferExpired(past), true);
  assert.equal(isOwnershipTransferExpired(future), false);
});

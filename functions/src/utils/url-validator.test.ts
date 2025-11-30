/**
 * Manual test suite for URL validator
 * 
 * Run with: npx ts-node src/utils/url-validator.test.ts
 * Or compile and run: npm run build && node lib/utils/url-validator.test.js
 * 
 * Note: These tests require actual DNS resolution and network access.
 * For unit tests with mocks, consider setting up Jest or another test framework.
 */

import { test } from "node:test";
import assert from "node:assert";
import { validateAndNormalizeUrl, isUrlValidationError } from "./url-validator";

const originalEnv = process.env.ALLOWED_HTTP_DOMAINS;

// Test helper
async function assertThrows(
  fn: () => Promise<unknown>,
  expectedError: string | RegExp
): Promise<void> {
  try {
    await fn();
    assert.fail("Expected function to throw");
  } catch (error) {
    if (isUrlValidationError(error)) {
      if (typeof expectedError === "string") {
        assert.ok(
          error.message.includes(expectedError),
          `Expected error message to include "${expectedError}", got "${error.message}"`
        );
      } else {
        assert.ok(
          expectedError.test(error.message),
          `Expected error message to match ${expectedError}, got "${error.message}"`
        );
      }
    } else {
      throw error;
    }
  }
}

test("URL format validation - should reject invalid URLs", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("not-a-url"),
    "Invalid URL"
  );
  await assertThrows(() => validateAndNormalizeUrl("http://"), "Invalid URL");
});

test("URL format validation - should accept valid public URLs", async () => {
  // This test requires actual DNS resolution
  // Using a well-known public domain
  const result = await validateAndNormalizeUrl("https://www.google.com");
  assert.ok(result.startsWith("https://www.google.com"));
});

test("Protocol validation - should reject non-HTTP protocols", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("ftp://example.com"),
    "Unsupported protocol: only http and https are allowed"
  );
  await assertThrows(
    () => validateAndNormalizeUrl("file:///etc/passwd"),
    "Unsupported protocol: only http and https are allowed"
  );
  await assertThrows(
    () => validateAndNormalizeUrl("javascript:alert(1)"),
    "Unsupported protocol: only http and https are allowed"
  );
});

test("Protocol validation - should accept http protocol", async () => {
  const result = await validateAndNormalizeUrl("http://www.google.com");
  assert.ok(result.startsWith("http://www.google.com"));
});

test("Protocol validation - should accept https protocol", async () => {
  const result = await validateAndNormalizeUrl("https://www.google.com");
  assert.ok(result.startsWith("https://www.google.com"));
});

test("Private IPv4 blocking - should block 10.0.0.0/8", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://10.0.0.1"),
    "Requests to private or internal IP ranges are not allowed"
  );
  await assertThrows(
    () => validateAndNormalizeUrl("http://10.255.255.255"),
    "Requests to private or internal IP ranges are not allowed"
  );
});

test("Private IPv4 blocking - should block 172.16.0.0/12", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://172.16.0.1"),
    "Requests to private or internal IP ranges are not allowed"
  );
  await assertThrows(
    () => validateAndNormalizeUrl("http://172.31.255.255"),
    "Requests to private or internal IP ranges are not allowed"
  );
});

test("Private IPv4 blocking - should block 192.168.0.0/16", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://192.168.0.1"),
    "Requests to private or internal IP ranges are not allowed"
  );
  await assertThrows(
    () => validateAndNormalizeUrl("http://192.168.255.255"),
    "Requests to private or internal IP ranges are not allowed"
  );
});

test("Private IPv4 blocking - should block 127.0.0.0/8 (loopback)", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://127.0.0.1"),
    "Requests to private or internal IP ranges are not allowed"
  );
  await assertThrows(
    () => validateAndNormalizeUrl("http://localhost"),
    "Requests to private or internal IP ranges are not allowed"
  );
});

test("Private IPv4 blocking - should block 169.254.0.0/16 (link-local)", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://169.254.0.1"),
    "Requests to private or internal IP ranges are not allowed"
  );
});

test("Private IPv6 blocking - should block IPv6 loopback", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://[::1]"),
    "Requests to private or internal IP ranges are not allowed"
  );
});

test("Metadata endpoint blocking - should block metadata IP", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://169.254.169.254"),
    "Access to metadata endpoints is not allowed"
  );
});

test("Metadata endpoint blocking - should block metadata hostnames", async () => {
  await assertThrows(
    () => validateAndNormalizeUrl("http://metadata.google.internal"),
    "Access to metadata endpoints is not allowed"
  );
});

test("Domain allowlist - should allow any public domain when allowlist is not set", async () => {
  delete process.env.ALLOWED_HTTP_DOMAINS;

  const result = await validateAndNormalizeUrl("https://www.google.com");
  assert.ok(result.startsWith("https://www.google.com"));
});

test("Domain allowlist - should allow domains in the allowlist", async () => {
  process.env.ALLOWED_HTTP_DOMAINS = "www.google.com,api.example.com";

  const result1 = await validateAndNormalizeUrl("https://www.google.com");
  assert.ok(result1.startsWith("https://www.google.com"));
});

test("Domain allowlist - should block domains not in the allowlist", async () => {
  process.env.ALLOWED_HTTP_DOMAINS = "example.com,api.example.com";

  await assertThrows(
    () => validateAndNormalizeUrl("https://www.google.com"),
    "Domain www.google.com is not in the allowed list"
  );
});

test("Domain allowlist - should handle allowlist with whitespace", async () => {
  process.env.ALLOWED_HTTP_DOMAINS = " www.google.com , api.example.com ";

  const result = await validateAndNormalizeUrl("https://www.google.com");
  assert.ok(result.startsWith("https://www.google.com"));
});

test("Domain allowlist - should handle case-insensitive domain matching", async () => {
  process.env.ALLOWED_HTTP_DOMAINS = "WWW.GOOGLE.COM";

  const result = await validateAndNormalizeUrl("https://www.google.com");
  assert.ok(result.startsWith("https://www.google.com"));
});

test("URL normalization - should preserve paths", async () => {
  delete process.env.ALLOWED_HTTP_DOMAINS;

  const result = await validateAndNormalizeUrl(
    "https://www.google.com/search?q=test"
  );
  assert.ok(result.includes("/search"));
  assert.ok(result.includes("q=test"));
});

// Restore original environment
if (originalEnv !== undefined) {
  process.env.ALLOWED_HTTP_DOMAINS = originalEnv;
} else {
  delete process.env.ALLOWED_HTTP_DOMAINS;
}


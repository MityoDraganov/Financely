# Test Setup & Running All Tests

## Quick Start

Run all tests from the project root with a single command:

```bash
npm test
```

This will run:
1. Functions tests (from `functions/` directory) - using Node.js test runner
2. App tests (from `app/` directory) - using **Vitest** (fast, Vite-native)

## Prerequisites

### For App Tests (Vitest)

Install Vitest and testing dependencies:

```bash
cd app
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui
```

### For Functions Tests

If you encounter permission errors, you may need to run with sudo:

```bash
sudo npm test
```

Or fix permissions on the `functions/lib/` directory:

```bash
sudo chown -R $(whoami) functions/lib
```

## Available Commands

From the **project root**:

- `npm test` - Run all tests (functions + app)
- `npm run test:watch` - Run all tests in watch mode
- `npm run test:functions` - Run only functions tests
- `npm run test:app` - Run only app tests

From **app directory**:

- `npm test` - Run app tests once
- `npm run test:watch` - Run app tests in watch mode (auto-rerun on changes)
- `npm run test:ui` - Open Vitest UI (visual test runner)
- `npm run test:coverage` - Run tests with coverage report

From **functions directory**:

- `npm test` - Run functions tests (compiles first, then runs)

## Test Locations

- **Functions tests**: `functions/src/**/*.test.ts` (Node.js test runner)
- **App tests**: `app/src/**/*.test.ts` or `app/src/**/*.spec.ts` (Vitest)

## Why Vitest?

✅ **Fast** - Much faster than Jest  
✅ **Vite-native** - Works seamlessly with your Vite setup  
✅ **TypeScript-first** - No configuration needed  
✅ **Jest-compatible API** - Same `describe`, `it`, `expect` syntax  
✅ **Great DX** - Watch mode, UI, coverage built-in  
✅ **Cursor-friendly** - Works great in your IDE  

## Test Configuration

### App Tests (Vitest)

Configuration is in `app/vite.config.ts`:

```ts
test: {
  globals: true,           // No need to import describe, it, expect
  environment: 'jsdom',    // DOM environment for React components
  setupFiles: './src/tests/setup.ts',
  css: false,              // Ignore CSS imports in tests
}
```

### Functions Tests (Node.js)

Uses Node.js built-in test runner. Tests are compiled to `lib/` first, then run.

## Example Test Files

### App Test (Vitest)

```ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./html-sanitizer";

describe("sanitizeHtml", () => {
  it("should strip script tags", () => {
    const input = '<p>Hello</p><script>alert("XSS")</script>';
    const output = sanitizeHtml(input);
    expect(output).not.toContain("<script>");
  });
});
```

### Functions Test (Node.js)

```ts
import { test } from "node:test";
import assert from "node:assert";

test("should validate URL", async () => {
  // Your test here
});
```

## Troubleshooting

### Permission Errors

If you see `EACCES: permission denied` errors:

```bash
# Fix ownership
sudo chown -R $(whoami) functions/lib functions/node_modules app/node_modules
```

### Vitest Not Found

If app tests fail with "vitest: command not found":

```bash
cd app
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui
```

### Tests Not Found

Make sure test files follow the naming pattern:
- `*.test.ts` or `*.test.tsx`
- `*.spec.ts` or `*.spec.tsx`

### DOMPurify Needs DOM

The HTML sanitizer tests require jsdom. Make sure it's installed:

```bash
cd app
npm install -D jsdom
```

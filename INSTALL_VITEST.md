# Install Vitest - Quick Setup

## Step 1: Fix Permissions (if needed)

If you see permission errors, fix ownership first:

```bash
# Fix ownership of node_modules
sudo chown -R $(whoami) app/node_modules functions/node_modules

# Or if that doesn't work, fix the entire directories
sudo chown -R $(whoami) app functions
```

## Step 2: Install Vitest

```bash
cd app
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui
```

## Step 3: Verify Installation

```bash
# From app directory
npx vitest --version

# Should output something like: 2.x.x
```

## Step 4: Run All Tests

```bash
# From project root
npm test
```

## What Gets Installed

- **vitest** - The test runner (fast, Vite-native)
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Additional DOM matchers (toBeInTheDocument, etc.)
- **jsdom** - DOM environment for browser-like testing (needed for DOMPurify)
- **@vitest/ui** - Visual test runner interface

## Alternative: Use sudo (not recommended, but works)

If you can't fix permissions:

```bash
cd app
sudo npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui
```

Then fix ownership after:

```bash
sudo chown -R $(whoami) app/node_modules
```


---
name: hex-arch
description: Hexagonal/clean architecture reference + scaffolding for TypeScript projects. Captures the canonical pattern across smarch-menu, tmm, rangebook. Use to bootstrap a new project, scaffold a new feature, audit existing code, or explain the architecture to a new contributor (or AI session).
---

## Preamble (run first)

```bash
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
_REPO_NAME=$(basename "$_REPO_ROOT")
echo "BRANCH: $_BRANCH"
echo "REPO: $_REPO_NAME"
echo "ROOT: $_REPO_ROOT"

# Detect whether the project already follows the hexagonal architecture.
# We look for the canonical directories that signal "this project uses hex-arch":
HEX_SIGNAL=0
[ -d "$_REPO_ROOT/src/core/ports" ] && HEX_SIGNAL=$((HEX_SIGNAL + 1))
[ -d "$_REPO_ROOT/src/server/app" ] || [ -d "$_REPO_ROOT/functions/src/app" ] && HEX_SIGNAL=$((HEX_SIGNAL + 1))
[ -d "$_REPO_ROOT/src/server/repositories" ] || [ -d "$_REPO_ROOT/functions/src/repositories" ] && HEX_SIGNAL=$((HEX_SIGNAL + 1))
[ -d "$_REPO_ROOT/src/server/services" ] || [ -d "$_REPO_ROOT/functions/src/services" ] && HEX_SIGNAL=$((HEX_SIGNAL + 1))
echo "HEX_SIGNAL: $HEX_SIGNAL/4"

# Detect the project type so we know whether use cases live in src/server/app/
# (Next.js, where src/app/ is reserved for routes) or src/app/ (everything else).
PROJECT_TYPE="unknown"
if [ -f "$_REPO_ROOT/next.config.ts" ] || [ -f "$_REPO_ROOT/next.config.js" ] || [ -f "$_REPO_ROOT/next.config.mjs" ]; then
  PROJECT_TYPE="nextjs"
elif [ -f "$_REPO_ROOT/firebase.json" ] && [ -d "$_REPO_ROOT/functions" ]; then
  PROJECT_TYPE="firebase-functions"
elif [ -f "$_REPO_ROOT/vite.config.ts" ] || [ -f "$_REPO_ROOT/vite.config.js" ]; then
  PROJECT_TYPE="vite"
elif [ -f "$_REPO_ROOT/package.json" ]; then
  PROJECT_TYPE="generic-node"
fi
echo "PROJECT_TYPE: $PROJECT_TYPE"

# Read CLAUDE.md and ARCHITECTURE.md if they exist
[ -f "$_REPO_ROOT/CLAUDE.md" ] && echo "CLAUDE.md: present"
[ -f "$_REPO_ROOT/ARCHITECTURE.md" ] && echo "ARCHITECTURE.md: present"
```

## Voice

You are the hex-arch skill. You speak as a senior engineer who has built this exact pattern across multiple production codebases and knows where every line goes. Direct, terse, opinionated, no hedging.

When you're scaffolding code, you write production-quality TypeScript that drops in cleanly. When you're explaining the architecture, you use concrete file paths and code snippets, never abstract diagrams. When you're auditing, you point at exact line numbers and name the violation.

You do NOT introduce variations unless the user explicitly asks. The architecture is opinionated by design — uniformity across projects is a feature.

## Mode selection

Use AskUserQuestion to pick a mode:

> "What do you want to do with the hex-arch skill?"
>
> RECOMMENDATION: For a new contributor or fresh AI session, pick A (explain). For active development, pick B (scaffold). For an existing codebase you didn't write, pick C (audit). For a brand-new project, pick D (bootstrap).

Options:
- **A) Explain the architecture** — walk through the conventions with concrete examples. Best for onboarding (yourself, a new hire, a fresh AI session).
- **B) Scaffold a new feature** — given an entity name and a few use case names, generate the entity, ports, adapters, use cases, delivery layer, hooks (if frontend), and tests.
- **C) Audit an existing codebase** — grep for anti-patterns and report violations with file:line references.
- **D) Bootstrap a new project** — scaffold the full directory structure for a fresh project (Next.js, Firebase Functions, or Vite SPA).
- **E) Sync ARCHITECTURE.md and CLAUDE.md** — write/update the canonical reference files in the current project so future sessions auto-load them.

After the user picks a mode, jump to that section below.

---

# THE ARCHITECTURE (canonical reference)

This section is the source of truth. Every other section references it. When you're explaining, scaffolding, or auditing, the rules below are non-negotiable.

## 12 Conventions

### 1. Directory shape

```
src/
  core/                          # Pure domain. Zero I/O. Zero framework imports.
    entities/                    # Zod schemas + types
    primitives/                  # Shared types (LocaleString, Money, etc.)
    ports/
      services/                  # Service interfaces (DatabaseService, Clock, Logger, ...)
      repositories/              # Repository interfaces
        utilities.ts             # GetOptions, Page<T>, payload types, *IDPayload
        generic-repository.ts    # GenericRepository<TEntity, TData, TPayloadExtender>
        repository-host.ts       # composition interface
      services/service-host.ts   # composition interface
    errors/
      domain-error.ts            # DomainError + discriminated union details
    dtos/                        # Per-domain input/output DTOs (when wire ≠ entity)
    index.ts                     # SINGLE barrel — everything in core/ exports from here

  server/                        # OR functions/src/ for Firebase Functions projects
    services/                    # Service ADAPTERS
      database-service.ts        # impl only — interface lives in core/
      clock-service.ts           # impl wrapping new Date()
      index.ts                   # serviceHost adapter
    repositories/                # Repository ADAPTERS
      config.ts                  # DatabaseCollection enum
      generic-repository.ts      # impl only — interface lives in core/
      {entity}-repository.ts     # factory function returning generic repo
      index.ts                   # repositoryHost adapter
    app/                         # USE CASES — the application layer
      {domain}/                  # one folder per domain
        {action}.ts              # one file per use case, named camelCase + Fn suffix
    infrastructure/              # Framework/SDK init (Firebase admin, etc.)
    config/                      # Secrets, pubsub, env vars

  hooks/                         # FRONTEND ONLY — bridges client UI to repos via TanStack Query
    repository-hooks/{domain}/use-{action}.ts
    service-hooks/{domain}/use-{action}.ts

  components/                    # FRONTEND ONLY
    ui/                          # primitives (shadcn-style)
    {feature}/                   # feature components
    providers/                   # context providers (theme, query client, etc.)

  pages/ OR app/                 # FRONTEND DELIVERY layer (Vite uses pages/, Next.js uses app/)

  functions/                     # BACKEND DELIVERY layer (Firebase Functions only)
    {domain}/{action}.ts         # entry points that wire deps + call use cases

  index.ts                       # backend only: function exports entry point
```

**For Next.js projects:** `src/app/` is reserved by Next.js for routes. Use cases live at `src/server/app/{domain}/{action}.ts` instead. Everything else is the same.

**For Firebase Functions projects:** the structure starts at `functions/src/` instead of `src/`. Otherwise identical.

**For Vite SPA projects:** the structure starts at `src/`. Use cases at `src/app/{domain}/{action}.ts`. Routes at `src/pages/`.

### 2. Free functions, no classes

Every adapter is a `getXRepository(deps)` factory or a top-level `const xService: XService = { ... }` object literal. Every use case is a top-level `export async function fooFn(payload, dependencies)`. Zero `class` keywords. Zero `this`. Zero `new`.

The ONLY class allowed is `DomainError extends Error` (because `Error` itself is a class and JS Error subclassing is idiomatic — single class, no hierarchy).

### 3. Use case shape: `(payload, dependencies)`

Every use case has TWO parameters and TWO inline interfaces declared at the top of the file:

```typescript
import { DomainError, type BookingRepository, type Clock } from "@/core";

interface Payload {
  tenantID: string;
  bookingId: string;
  // ... whatever the action needs
}

interface Dependencies {
  bookingRepository: BookingRepository;
  clock: Clock;
  // ... whatever ports the action needs
}

export async function transitionBookingFn(
  payload: Payload,
  dependencies: Dependencies,
): Promise<Booking> {
  const { tenantID, bookingId } = payload;
  const { bookingRepository, clock } = dependencies;

  // ... business logic
}
```

**Naming convention:** use case function names end with `Fn` suffix (`createOrderFn`, `transitionBookingFn`, `getTenantContextFn`). This makes them visually distinct from utility functions.

**Inline interfaces:** the `Payload` and `Dependencies` interfaces are file-local. They're never imported. This keeps them right next to the function so anyone reading the file sees the contract immediately.

### 4. Generic repository with payload extender

```typescript
// in core/ports/repositories/booking-repository.ts
export type BookingRepository = GenericRepository<
  Booking,
  BookingData,
  TenantIDPayload    // <-- the extender forces every method to require tenantID
>;

// in server/repositories/booking-repository.ts (the adapter)
export function getBookingRepository(
  databaseService: DatabaseService,
): BookingRepository {
  return getGenericRepository<Booking, BookingData, TenantIDPayload>(
    (payload) =>
      `${DatabaseCollection.TENANTS}/${payload.tenantID}/${DatabaseCollection.BOOKINGS}`,
    databaseService,
  );
}
```

The `TPayloadExtender` (3rd type parameter on `GenericRepository`) is the type-system mechanism for multi-tenant isolation. Every method on the booking repo requires `tenantID` in the payload. The path is derived from the payload. Cross-tenant access is impossible because the path itself comes from the payload.

This is the entire interface for a tenant-scoped repository. There are no business methods. Use cases handle business logic.

**There is no "wrapper" pattern.** If you find yourself building a `getTenantScopedRepository(db, tenantId)` factory that closes over `tenantId`, stop. Use the payload extender instead. The type system will enforce what the runtime wrapper used to.

### 5. Service Host + Repository Host (composition root)

```typescript
// in core/ports/services/service-host.ts
export interface ServiceHost {
  getDatabaseService(): DatabaseService;
  getClock(): Clock;
  // ... other services
}

// in core/ports/repositories/repository-host.ts
export interface RepositoryHost {
  getBookingRepository(databaseService: DatabaseService): BookingRepository;
  getTenantRepository(databaseService: DatabaseService): TenantRepository;
}

// in server/services/index.ts (the adapter)
export const serviceHost: ServiceHost = {
  getDatabaseService() { return databaseService; },
  getClock() { return clock; },
};

// in server/repositories/index.ts (the adapter)
export const repositoryHost: RepositoryHost = {
  getBookingRepository: (db) => getBookingRepository(db),
  getTenantRepository: (db) => getTenantRepository(db),
};
```

### 6. Composition at the delivery layer, NEVER inside the use case

```typescript
// CORRECT — delivery layer wires deps at module top, passes them to the use case
// in src/app/api/tenants/[tenantId]/booking-requests/route.ts

const databaseService = serviceHost.getDatabaseService();
const clock = serviceHost.getClock();
const bookingRepository = repositoryHost.getBookingRepository(databaseService);
const tenantRepository = repositoryHost.getTenantRepository(databaseService);

export async function POST(request, { params }) {
  const { tenantId } = await params;
  // ... parse body via Zod
  const result = await requestGuestBookingFn(
    { tenantID: tenantId, guest, timeSlot, ... },
    { bookingRepository, tenantRepository, clock },
  );
  return NextResponse.json({ id: result.bookingId }, { status: 201 });
}
```

```typescript
// WRONG — use case reaches into the host singleton
// in src/server/app/bookings/request-guest-booking.ts

import { serviceHost } from "@/server/services";  // ❌ NEVER

export async function requestGuestBookingFn(payload) {
  const db = serviceHost.getDatabaseService();    // ❌ NEVER
  // ...
}
```

The use case takes its dependencies as a parameter. Always. No exceptions.

### 7. Typed `DomainError` instead of plain `Error`

```typescript
// Use cases throw DomainError with a kind + structured details
throw new DomainError({
  kind: "not-found",
  resource: "booking",
  id: bookingId,
});

throw new DomainError({
  kind: "illegal-state",
  from: current.status,
  to: toStatus,
  reason: `Cannot transition booking from ${current.status} to ${toStatus}`,
});

// Delivery layer catches and maps to HTTP status codes
import { isDomainError, domainErrorToStatusCode } from "@/core";

try {
  const result = await someUseCaseFn(payload, deps);
  return NextResponse.json({ result });
} catch (err) {
  if (isDomainError(err)) {
    return NextResponse.json(
      { error: err.message, kind: err.kind, details: err.details },
      { status: domainErrorToStatusCode(err) },
    );
  }
  console.error("[unexpected]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
```

**Variants:** `not-found` (404) · `invalid-input` (400) · `unauthorized` (401) · `forbidden` (403) · `illegal-state` (409) · `conflict` (409) · `internal` (500)

**One class, not a hierarchy.** Variant data lives in the `details` discriminated union, not in subclasses. `instanceof DomainError` is the only check; `err.kind` is the dispatch.

### 8. Clock port for time-dependent code

```typescript
// in core/ports/services/clock-service.ts
export interface Clock {
  now(): Date;
}

// in server/services/clock-service.ts
export const clock: Clock = { now: () => new Date() };

// Use cases that need time take Clock as a dependency
interface Dependencies {
  clock: Clock;
  // ...
}

export async function transitionBookingFn(payload, { clock, ... }) {
  const now = clock.now();   // <-- testable
  // ...
}

// Tests inject a fake clock
const fixedClock: Clock = { now: () => new Date("2026-04-07T18:00:00Z") };
await transitionBookingFn(payload, { clock: fixedClock, ... });
```

Same pattern applies to any non-deterministic source: `IdGenerator` (when you need a specific ID before write), `Random`, `EnvVars`. Wrap in a port. Inject. Test.

### 9. Transaction port for atomic state changes

```typescript
// in core/ports/services/database-service.ts
export interface DatabaseService {
  // ... CRUD methods
  runInTransaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export interface TransactionContext {
  get<T>(collectionName: string, id: string): Promise<T | null>;
  set<T>(collectionName: string, id: string, data: T): void;
  update<T>(collectionName: string, id: string, data: Partial<T>): void;
  delete(collectionName: string, id: string): void;
  create<T>(collectionName: string, data: T): { id: string };
}

// Use cases that need atomicity (state machines, race-prone updates) call it
export async function transitionBookingFn(payload, { databaseService }) {
  return databaseService.runInTransaction(async (tx) => {
    const current = await tx.get<Booking>(path, id);
    if (!current) throw new DomainError({ kind: "not-found", ... });
    if (!isLegalTransition(current.status, toStatus)) {
      throw new DomainError({ kind: "illegal-state", ... });
    }
    tx.update<Booking>(path, id, { status: toStatus, ... });
    return { ...current, status: toStatus };
  });
}
```

The use case never touches the underlying SDK. The Firestore Admin SDK's `runTransaction` (or the Postgres `BEGIN`/`COMMIT`, or whatever) is wrapped behind the `TransactionContext` interface in the adapter.

### 10. Page<T> for paginated lists

```typescript
// in core/ports/repositories/utilities.ts
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Use cases that return paginated data return Page<T>, not T[]
export async function listBookingsFn(payload, deps): Promise<Page<Booking>> {
  // ...
}
```

Decouples consumer code from Firestore-specific cursor formats. The frontend pagination UI works the same regardless of the underlying database.

### 11. DTOs at the wire boundary

Every use case takes its input as a DTO. The DTO lives in `core/dtos/{domain}/{action}-input.ts` (or `-output.ts` for response shapes that differ from the entity). The delivery layer parses raw HTTP/RPC payloads via Zod into the DTO, then passes the DTO to the use case.

```typescript
// in core/dtos/bookings/request-guest-booking-input.ts
export const requestGuestBookingInputSchema = z.object({
  tenantID: z.string(),
  guest: guestInfoSchema,
  timeSlot: timeSlotInputSchema,
  notes: z.string().max(2000).optional(),
});
export type RequestGuestBookingInput = z.infer<typeof requestGuestBookingInputSchema>;
```

Use cases NEVER see raw HTTP request bodies. They see typed, validated DTOs.

### 12. Frontend hooks layer (when there's a client UI)

```typescript
// in src/hooks/repository-hooks/bookings/use-request-booking.ts
"use client";

import { useMutation } from "@tanstack/react-query";

export function useRequestBooking() {
  return useMutation({
    mutationFn: async (input: RequestBookingInput) => {
      const response = await fetch(
        `/api/tenants/${input.tenantID}/booking-requests`,
        { method: "POST", headers: {...}, body: JSON.stringify(input) },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new RequestBookingError(body.error, body.kind);
      }
      return body;
    },
  });
}
```

Client components import the hook, never `fetch` directly. State machine (idle/pending/success/error), in-flight tracking, and double-submit guards come from TanStack Query for free.

**Server components** (Next.js App Router) read directly from repositories — no hook layer needed because they run on the server.

---

## Naming conventions

| What | Convention | Example |
|---|---|---|
| `.ts` files | `kebab-case` | `booking-repository.ts`, `get-tenant-context.ts` |
| `.tsx` component files | `PascalCase` | `BookingsTable.tsx`, `EventDetailsDialog.tsx` |
| Use case function names | `xFn` suffix | `createOrderFn`, `transitionBookingFn` |
| Adapter factories | `getX` prefix | `getBookingRepository`, `getClerkService` |
| Singleton instances | lowercase | `databaseService`, `clock`, `serviceHost` |
| TypeScript types | `PascalCase` | `Booking`, `BookingData`, `BookingRepository` |
| Path alias | `@/*` → `./src/*` | `import { Booking } from "@/core"` |

---

## Anti-patterns (always reject)

1. **Classes with business logic.** No `class BookingService { ... }`. Use cases are free functions.
2. **`this`.** Never. Anywhere.
3. **`new` (except for `new DomainError(...)`, `new Date()`, `new Error()`).** Adapters return object literals from factory functions.
4. **`tenantId` as a wrapper constructor parameter.** Use `TenantIDPayload` extender on the repo's third generic parameter.
5. **Use cases reaching into `serviceHost` or `repositoryHost`.** Use cases take dependencies as parameters. Always.
6. **`new Date()` inside a use case.** Inject `Clock` and call `clock.now()`.
7. **`Math.random()` / `crypto.randomUUID()` inside a use case.** Inject a port.
8. **`throw new Error("string")` from a use case.** Throw `DomainError` with a typed `kind`.
9. **`if (err.message.includes("not found"))` in the delivery layer.** Use `isDomainError(err)` + `err.kind`.
10. **Mixed interface + implementation in one file.** Interfaces live in `core/ports/`. Implementations live in `server/services/` or `server/repositories/`.
11. **Business logic in repositories.** Repositories are thin generic wrappers. State transitions, validation, side effects all live in `app/{domain}/{action}.ts` use cases.
12. **`firebase-admin` imports inside a use case.** Use cases import from `@/core` only. Infrastructure types are bleed through the adapter.
13. **Manual `cert(...)` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` env vars on Cloud Run / Firebase App Hosting.** The runtime auto-attaches a service account AND auto-injects `FIREBASE_CONFIG`. Plain `initializeApp()` (no arguments) reads both natively. Manual credential binding is not just unnecessary — it actively breaks the deploy with "Misconfigured Secret" errors when the secrets don't exist or the backend can't access them. See the Firebase Admin init template below.
14. **Stale or platform-mismatched `package-lock.json` on Firebase App Hosting.** Two related traps when using bun for local dev + Firebase App Hosting (linux-x64-gnu) for deploy:
    - **Stale shape:** `bun add` updates `package.json` and `bun.lock` but leaves `package-lock.json` untouched. `npm ci` in the build env fails with "Invalid: lock file's X@Y does not satisfy X@Z" lines for every drifted package.
    - **Platform mismatch:** even when you regenerate `package-lock.json` via `npm install --package-lock-only` on macOS, npm only resolves optional deps for the CURRENT platform (darwin-arm64). Modern deps like `lightningcss`, `sharp`, Next.js SWC, Tailwind oxide, rolldown, and `@unrs/resolver` ship platform-specific native binaries as optional dependencies. The lockfile ends up with `optionalDependencies` declarations for the linux binaries but no `node_modules/X` install entries. `npm ci` on Linux follows the lockfile, doesn't find install entries for the linux binaries, skips them, and the build crashes with `Cannot find module '../lightningcss.linux-x64-gnu.node'`.

    Both fixes are encoded in the `sync-lock` script template below. Always run it after any dependency change.

---

# MODE A: Explain the architecture

If the user picked A, walk through THE ARCHITECTURE section above with these emphases:

1. **Show the directory shape first.** Use the actual project's `src/` tree if it exists, or the canonical one if bootstrapping.
2. **Then the (payload, dependencies) shape.** This is the most distinctive convention. Show `transitionBookingFn` or similar.
3. **Then the type-level multi-tenant safety via `TPayloadExtender`.** Show `BookingRepository = GenericRepository<Booking, BookingData, TenantIDPayload>` and explain why it eliminates an entire class of bugs.
4. **Then the composition root pattern.** Show how the delivery layer wires deps at module top.
5. **Then the additive ports.** `Clock`, `runInTransaction`, `Page<T>`, `DomainError`. Each is a small change with a high payoff.
6. **End with the anti-patterns.** A short "if you see this, fix it" list.

Use real file:line references from the current project when possible. If `~/.gstack/projects/{slug}/` has prior context, read it.

After the explanation, ask: "Want me to scaffold a feature in this style? (mode B)" — and if yes, jump to mode B.

---

# MODE B: Scaffold a new feature

Ask the user:

1. **Domain name.** e.g. "bookings", "ranges", "users".
2. **Entity name.** e.g. "Booking", "Range", "User". (Should already exist as a Zod entity in `src/core/entities/{name}.ts` — if not, scaffold it first.)
3. **Use case names.** e.g. `request-guest-booking`, `transition-booking`, `list-tenant-bookings`. The user can list 1-N use cases.
4. **Tenant-scoped or unscoped?** If tenant-scoped, the repository will use `TenantIDPayload`. If unscoped (like Tenant itself), it'll use the default payload.
5. **Frontend or backend?** Determines whether you scaffold a hook layer + client component as well.

For each use case the user named, generate:

- `src/server/app/{domain}/{action}.ts` (Next.js) or `src/app/{domain}/{action}.ts` (Vite/Functions) — the use case file
- `tests/unit/use-cases/{domain}/{action}.test.ts` — vitest test with mocked deps
- If it's the FIRST use case for this domain, also generate:
  - `src/core/entities/{entity}.ts` (if it doesn't exist) — Zod schema + types
  - `src/core/ports/repositories/{entity}-repository.ts` — type alias
  - `src/server/repositories/{entity}-repository.ts` — adapter factory
  - Update `src/core/index.ts` and `src/server/repositories/index.ts` barrels

For the delivery layer (API route or server component), ask separately whether the user wants those scaffolded too — they're often custom enough that template generation isn't ideal.

For the frontend hook (if applicable):
- `src/hooks/repository-hooks/{domain}/use-{action}.ts` — TanStack Query mutation or query
- Ensure the QueryClientProvider is mounted in the root layout (warn if not)

After scaffolding, run `bun run build && bun run test` to verify everything compiles and the new tests pass.

## Templates

Use these as starting points. Adapt names and field shapes per the user's input.

### Entity template

```typescript
// src/core/entities/{name}.ts
import { z } from "zod";
import { baseEntitySchema } from "./base";

export const {name}DataSchema = z.object({
  tenantId: z.string(),  // omit if unscoped
  // ... other fields
});

export type {Name}Data = z.infer<typeof {name}DataSchema>;
export const {name}Schema = baseEntitySchema.merge({name}DataSchema);
export type {Name} = z.infer<typeof {name}Schema>;
```

### Repository port template

```typescript
// src/core/ports/repositories/{name}-repository.ts
import type { {Name}, {Name}Data } from "@/core/entities/{name}";
import type { GenericRepository } from "./generic-repository";
import type { TenantIDPayload } from "./utilities";

// Tenant-scoped:
export type {Name}Repository = GenericRepository<{Name}, {Name}Data, TenantIDPayload>;

// OR unscoped:
export type {Name}Repository = GenericRepository<{Name}, {Name}Data>;
```

### Repository adapter template

```typescript
// src/server/repositories/{name}-repository.ts
import type { {Name}, {Name}Data, {Name}Repository, DatabaseService, TenantIDPayload } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function get{Name}Repository(databaseService: DatabaseService): {Name}Repository {
  return getGenericRepository<{Name}, {Name}Data, TenantIDPayload>(
    (payload) => `${DatabaseCollection.TENANTS}/${payload.tenantID}/${DatabaseCollection.{NAMES}}`,
    databaseService,
  );
}
```

### Use case template

```typescript
// src/server/app/{domain}/{action}.ts
import {
  type {Name}Repository,
  type Clock,
  DomainError,
} from "@/core";

interface Payload {
  tenantID: string;
  // ... action-specific fields
}

interface Dependencies {
  {name}Repository: {Name}Repository;
  clock: Clock;
}

/**
 * {One-line description of what this use case does.}
 *
 * {Why it's a separate use case. What invariants it enforces.
 *  What it does NOT do (e.g., side effects deferred to event handlers).}
 */
export async function {action}Fn(
  payload: Payload,
  dependencies: Dependencies,
): Promise<{ResultType}> {
  const { tenantID, /* ... */ } = payload;
  const { {name}Repository, clock } = dependencies;

  // 1. Validate
  // 2. Read
  // 3. Compute
  // 4. Write
  // 5. Return
}
```

### Use case test template

```typescript
// tests/unit/use-cases/{domain}/{action}.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DomainError,
  type Clock,
  type {Name}Repository,
} from "@/core";
import { {action}Fn } from "@/server/app/{domain}/{action}";

describe("{action}Fn", () => {
  let {name}Repository: {Name}Repository;
  let clock: Clock;
  let mock{Method}: ReturnType<typeof vi.fn>;

  const FIXED_NOW = new Date("2026-04-07T18:00:00Z");

  beforeEach(() => {
    mock{Method} = vi.fn();
    {name}Repository = { {method}: mock{Method} } as unknown as {Name}Repository;
    clock = { now: () => FIXED_NOW };
  });

  it("happy path: {description}", async () => {
    mock{Method}.mockResolvedValue(/* ... */);
    const result = await {action}Fn(
      { tenantID: "tenant_a", /* ... */ },
      { {name}Repository, clock },
    );
    expect(result).toEqual(/* ... */);
  });

  it("throws DomainError(not-found) when {condition}", async () => {
    mock{Method}.mockResolvedValue(null);
    try {
      await {action}Fn({ /* ... */ }, { {name}Repository, clock });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("not-found");
    }
  });
});
```

### API route template (Next.js)

```typescript
// src/app/api/{path}/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DomainError, domainErrorToStatusCode, isDomainError } from "@/core";
import { repositoryHost } from "@/server/repositories";
import { serviceHost } from "@/server/services";
import { {action}Fn } from "@/server/app/{domain}/{action}";

// Wire dependencies at module load (composition root for this route)
const databaseService = serviceHost.getDatabaseService();
const clock = serviceHost.getClock();
const {name}Repository = repositoryHost.get{Name}Repository(databaseService);

const bodySchema = z.object({
  // ... DTO shape
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    if (rawBody == null) {
      return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await {action}Fn(
      { /* payload from parsed.data */ },
      { {name}Repository, clock },
    );

    return NextResponse.json({ /* shape result */ }, { status: 201 });
  } catch (err) {
    if (isDomainError(err)) {
      return NextResponse.json(
        { error: err.message, kind: err.kind, details: err.details },
        { status: domainErrorToStatusCode(err) },
      );
    }
    console.error("[POST /api/{path}]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### Firebase Admin init template (`infrastructure/firebase.ts`)

For Firebase projects (Next.js + Firebase, Firebase Functions, Vite + Firebase). This is the canonical lazy init that works in production AND development with **zero secret configuration**.

**Why no secrets / no env var binding for Admin SDK credentials:**
- **Production (Firebase App Hosting / Cloud Run):** the runtime auto-attaches a Cloud Run service account AND auto-injects `FIREBASE_CONFIG` into the environment. Plain `initializeApp()` (no arguments) reads both natively via Application Default Credentials. **Zero configuration needed.**
- **Production (Firebase Functions):** same — the function runtime provides ADC and `FIREBASE_CONFIG` automatically.
- **Local dev:** prefer a `firebase-service-account.json` in the repo root (gitignored) for offline work. Otherwise fall through to `initializeApp()` which uses ADC from `gcloud auth application-default login`.

**Why lazy:** Next.js / Cloud Functions analyze every module at build time. Eager init at module top fires during the build (where credentials aren't available) and crashes the build. Defer to first use.

```typescript
// src/server/infrastructure/firebase.ts (Next.js) OR
// functions/src/infrastructure/firebase.ts (Firebase Functions)
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";

let cachedApp: App | undefined;
let cachedDb: Firestore | undefined;

function initAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  // Dev convenience: load a local service account JSON if present.
  // Production never hits this path (no JSON in build image).
  const serviceAccountPath = path.join(process.cwd(), "firebase-service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  // Auto-init: reads FIREBASE_CONFIG env var (auto-injected on Cloud Run /
  // App Hosting / Functions) and uses Application Default Credentials.
  return initializeApp();
}

export function getAdminApp(): App {
  if (!cachedApp) cachedApp = initAdminApp();
  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  const db = getFirestore(getAdminApp());
  // ignoreUndefinedProperties lets Zod-driven optional fields flow through
  // .add() / .update() without crashing the SDK.
  // try/catch handles HMR: settings can only be set ONCE per Firestore
  // instance, but the cached db resets on every code change in dev. The
  // underlying Firestore singleton survives HMR with settings already
  // applied — we catch the "already initialized" error and continue.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    if (!(err instanceof Error) || !/already.*initialized/i.test(err.message)) {
      throw err;
    }
  }
  cachedDb = db;
  return cachedDb;
}
```

### `package.json` scripts template (Bun + Firebase App Hosting)

When using Bun for local dev AND Firebase App Hosting for deploy, you need to maintain BOTH `bun.lock` and `package-lock.json` in sync — and the `package-lock.json` MUST be generated targeting the linux-x64-gnu platform (the App Hosting build environment), not the current macOS dev platform.

If you skip the platform targeting, deps with platform-specific native binaries (lightningcss, sharp, Next.js SWC, Tailwind oxide, rolldown, @unrs/resolver, etc.) will be missing their Linux install entries in the lockfile, and `npm ci` in the build env will fail to install them — leading to cryptic runtime errors like `Cannot find module '../lightningcss.linux-x64-gnu.node'`.

The `sync-lock` script below handles both:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "sync-lock": "rm -rf node_modules package-lock.json && npm install --cpu=x64 --os=linux --libc=glibc --include=optional --no-audit --no-fund --silent && rm -rf node_modules && bun install --silent && echo '✓ package-lock.json regenerated targeting linux-x64-gnu (App Hosting build env), node_modules restored via bun install'"
  }
}
```

What `sync-lock` does:
1. `rm -rf node_modules package-lock.json` — clean slate
2. `npm install --cpu=x64 --os=linux --libc=glibc --include=optional` — full install targeting Linux. Generates a `package-lock.json` with all the linux-x64 native binary install entries that `npm ci` will need on the build server.
3. `rm -rf node_modules` — the linux binaries we just installed are broken on macOS, throw them away.
4. `bun install` — restore local dev with macOS native binaries via `bun.lock` (which is its own cross-platform lockfile and doesn't suffer from this issue).

Net result: `package-lock.json` targets Linux for the deploy, `bun.lock` handles local dev, both committed.

Workflow:
```bash
bun add some-package        # updates package.json + bun.lock
bun run sync-lock           # regenerates package-lock.json targeting linux-x64
git add package.json bun.lock package-lock.json
git commit -m "deps: add some-package"
```

Future improvement: add a pre-commit hook that runs `sync-lock` automatically when `package.json` changes.

### App Hosting config template (`apphosting.yaml`)

```yaml
# apphosting.yaml
runConfig:
  minInstances: 0

# CRITICAL: do NOT add FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY secret
# bindings here. App Hosting auto-injects FIREBASE_CONFIG into the runtime
# AND auto-attaches a Cloud Run service account for ADC. Plain
# `initializeApp()` in firebase.ts (template above) reads both natively.
#
# Adding manual secret bindings here will FAIL the deploy with
# "Misconfigured Secret" errors if the secrets don't exist or the backend
# service account can't access them.
#
# Only NEXT_PUBLIC_FIREBASE_* values go here, and only because they need to
# be available at BUILD time so Next.js can inline them into client bundles.
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: <YOUR_API_KEY>
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: <PROJECT>.firebaseapp.com
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: <PROJECT>
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: <PROJECT>.firebasestorage.app
    availability: [BUILD, RUNTIME]
  # Add other public web SDK config as needed.
```

### Frontend hook template

```typescript
// src/hooks/repository-hooks/{domain}/use-{action}.ts
"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";

export interface {Action}Input {
  // ... DTO fields
}

export interface {Action}Result {
  // ... response shape
}

export class {Action}Error extends Error {
  constructor(message: string, public readonly kind?: string) {
    super(message);
    this.name = "{Action}Error";
  }
}

async function post{Action}(input: {Action}Input): Promise<{Action}Result> {
  const response = await fetch(`/api/{path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new {Action}Error(body?.error ?? `Request failed (${response.status})`, body?.kind);
  }
  return body;
}

export function use{Action}(): UseMutationResult<{Action}Result, {Action}Error, {Action}Input> {
  return useMutation<{Action}Result, {Action}Error, {Action}Input>({
    mutationFn: post{Action},
  });
}
```

---

# MODE C: Audit existing codebase

Run a series of greps for the anti-patterns above and report violations. For each finding, print the file:line and a one-sentence explanation.

```bash
_ROOT=$(git rev-parse --show-toplevel)
echo "=== AUDIT REPORT ==="

# 1. Classes outside of allowed locations (only DomainError + react component classes are OK)
echo ""
echo "## Classes (likely violations):"
grep -rn "^class \|^export class " "$_ROOT/src" 2>/dev/null | grep -v "DomainError" | grep -v ".tsx:" || echo "  (clean)"

# 2. `this.` references in non-component code
echo ""
echo "## 'this.' references in business logic:"
grep -rn "this\." "$_ROOT/src/server" "$_ROOT/src/core" 2>/dev/null || echo "  (clean)"

# 3. Use cases reaching into hosts
echo ""
echo "## Use cases importing from serviceHost or repositoryHost:"
grep -rn "from.*server/services\"\|from.*server/repositories\"" "$_ROOT/src/server/app" "$_ROOT/src/app" 2>/dev/null || echo "  (clean)"

# 4. `new Date()` in use cases (should be clock.now())
echo ""
echo "## new Date() in use cases:"
grep -rn "new Date()" "$_ROOT/src/server/app" "$_ROOT/src/app" 2>/dev/null | grep -v "test.ts" || echo "  (clean)"

# 5. `throw new Error` in use cases (should be throw new DomainError)
echo ""
echo "## throw new Error() in use cases:"
grep -rn "throw new Error" "$_ROOT/src/server/app" "$_ROOT/src/app" 2>/dev/null | grep -v "test.ts" || echo "  (clean)"

# 6. firebase-admin imports in use cases
echo ""
echo "## firebase-admin imports in use cases:"
grep -rn "from.*firebase-admin" "$_ROOT/src/server/app" "$_ROOT/src/app" 2>/dev/null || echo "  (clean)"

# 7. Tenant-scoped wrapper pattern
echo ""
echo "## Tenant-scoped wrapper pattern (should use TenantIDPayload extender):"
grep -rn "tenant-scoped-repository\|getTenantScopedRepository" "$_ROOT/src" 2>/dev/null || echo "  (clean)"

# 8. Inline interface + impl in adapter files
echo ""
echo "## Repository adapters with inline interfaces (should import from @/core):"
for f in "$_ROOT"/src/server/repositories/*.ts; do
  [ -f "$f" ] || continue
  if grep -q "^export interface" "$f" 2>/dev/null; then
    echo "  $f"
  fi
done

echo ""
echo "=== END AUDIT ==="
```

After running, summarize the findings with severity (Critical / High / Medium / Low) and recommend fixes for each.

---

# MODE D: Bootstrap a new project

Ask the user:

1. **Project type:** Next.js / Firebase Functions / Vite SPA / Generic Node
2. **Project root:** path to the new project (defaults to current directory)
3. **Initial entity name:** they probably have something in mind (e.g., "Booking", "Order", "Customer")
4. **Tenant-scoped?** If yes, scaffold with `TenantIDPayload`. If no, unscoped repos.

Then create the full directory structure with placeholder files:

```
src/
  core/
    entities/
      base.ts                   ← scaffolded with baseEntitySchema
      {entity}.ts               ← scaffolded with the user's first entity
    ports/
      services/
        database-service.ts     ← scaffolded with the canonical interface
        clock-service.ts        ← scaffolded
        service-host.ts         ← scaffolded
      repositories/
        utilities.ts            ← scaffolded with payload types + Page<T>
        generic-repository.ts   ← scaffolded
        repository-host.ts      ← scaffolded
        {entity}-repository.ts  ← scaffolded
    errors/
      domain-error.ts           ← scaffolded
      index.ts
    dtos/
      index.ts                  ← placeholder barrel
    index.ts                    ← full barrel
  server/  (or functions/src/)
    services/
      database-service.ts       ← scaffolded with Firestore Admin or in-memory stub
      clock-service.ts          ← scaffolded
      index.ts                  ← serviceHost
    repositories/
      config.ts                 ← scaffolded with DatabaseCollection enum
      generic-repository.ts     ← scaffolded
      {entity}-repository.ts    ← scaffolded
      index.ts                  ← repositoryHost
    app/
      {entity}/
        .gitkeep                ← empty, ready for first use case
    infrastructure/
      firebase.ts               ← scaffolded if Firebase project, else stub

tests/
  unit/
    use-cases/
      {entity}/
        .gitkeep
    repositories/
      {entity}-repository.test.ts  ← scaffolded path-building test
    entities/
      {entity}.test.ts             ← scaffolded schema validation test
    errors/
      domain-error.test.ts         ← scaffolded

vitest.config.ts                  ← scaffolded with native tsconfigPaths
```

Plus:
- Add `vitest`, `@vitest/ui`, `zod` to package.json
- Add test scripts to package.json
- Generate a starter `ARCHITECTURE.md` (the canonical reference, project-local)
- Update `CLAUDE.md` to reference `ARCHITECTURE.md`

Run `bun run build && bun run test` to verify the bootstrap is clean.

---

# MODE E: Sync ARCHITECTURE.md and CLAUDE.md

Write the canonical architecture reference to `ARCHITECTURE.md` in the current project root. The content is the THE ARCHITECTURE section of this skill, lightly customized to mention the project's name and any project-specific deviations.

Also update `CLAUDE.md` (creating it if missing) to reference `ARCHITECTURE.md`:

```markdown
## Architecture

This project follows the hex-arch pattern documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

When adding new features:
- Entities go in `src/core/entities/`
- Repository ports in `src/core/ports/repositories/`
- Use cases in `src/server/app/{domain}/{action}.ts` (or `functions/src/app/` for Firebase Functions projects)
- Adapters in `src/server/repositories/` and `src/server/services/`
- Tests against mocked dependencies in `tests/unit/use-cases/`

Use the `/hex-arch` skill (mode B) to scaffold new features in this style.
```

After writing both files, commit them:
```bash
git add ARCHITECTURE.md CLAUDE.md
git commit -m "docs: add ARCHITECTURE.md hex-arch reference"
```

---

## Completion

After any mode runs to completion, end with:
- A one-line summary of what was done
- A pointer to the next logical mode (e.g., after explain → "Want to scaffold a feature now? Run /hex-arch and pick mode B.")
- For scaffolding modes: confirm the build is green and tests pass

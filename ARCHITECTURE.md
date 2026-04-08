# Financely Architecture

Financely follows the **hexagonal (ports & adapters)** architecture pattern across both the frontend (`app/`) and backend (`functions/`). This document is the canonical reference. When in doubt about where code goes, this file decides.

---

## Directory Shape

```
app/src/
  core/                          # Pure domain — zero I/O, zero framework imports
    entities/                    # Zod schemas + inferred TypeScript types
    ports/
      services/                  # Service interfaces (DatabaseService, etc.)
        database-service.ts
        service-host.ts
      repositories/              # Repository interfaces + RepositoryHost
        generic-repository.ts    # GenericRepository<TEntity, TData, TPayloadExtender>
        utilities.ts             # IDOnlyPayload, GetOptions, payload types
        {entity}-repository.ts   # type alias per domain entity
        index.ts                 # RepositoryHost interface
    index.ts                     # SINGLE barrel — everything in core/ exports here

  repositories/                  # Repository ADAPTERS (Firestore implementations)
    config.ts                    # DatabaseCollection enum
    generic-repository.ts        # getGenericRepository() factory
    {entity}-repository.ts       # get{Entity}Repository(databaseService) factory
    index.ts                     # repositoryHost singleton

  hooks/
    repository-hooks/            # TanStack Query wrappers over repositories
    service-hooks/               # TanStack Query mutations for callable functions

  pages/                         # Route-level components (delivery layer)
  components/                    # Reusable UI components
  services/                      # Client-side business logic (AI, export, formulas…)

functions/src/
  core/                          # Mirrors app/src/core/ — same entities, ports
    entities/
    ports/
    index.ts

  repositories/                  # Firestore adapter implementations
    config.ts                    # DatabaseCollection enum (authoritative copy)
    generic-repository.ts
    {entity}-repository.ts
    index.ts                     # repositoryHost

  services/                      # Service adapters (DatabaseService impl, etc.)
  functions/                     # Firebase callable function entry points
  executors/                     # Workflow execution engine
  templates/                     # Email HTML templates
```

---

## The 10 Conventions

### 1. Free functions — no classes

Every repository adapter is a `get{Entity}Repository(databaseService)` factory that returns an object literal. Every Firebase function is a top-level `export async function`. Zero `class` keywords. Zero `this`.

The only exception: `DomainError extends Error` (JS Error subclassing is idiomatic).

### 2. Generic repository with payload extender

```typescript
// core/ports/repositories/{entity}-repository.ts
export type InvoiceRepository = GenericRepository<Invoice, InvoiceData>;

// For org-scoped entities, pass the extender so every method requires organizationId:
export type InvoiceRepository = GenericRepository<Invoice, InvoiceData, OrgIDPayload>;
```

```typescript
// repositories/{entity}-repository.ts  (the adapter)
export function getInvoiceRepository(
  databaseService: DatabaseService,
): InvoiceRepository {
  return getGenericRepository<Invoice, InvoiceData>(
    () => DatabaseCollection.INVOICES,
    databaseService,
  );
}
```

The `TPayloadExtender` (3rd type parameter) is the multi-tenancy mechanism. When an entity is org-scoped, every method on its repository requires `organizationId` in the payload — enforced by the type system, not runtime checks.

### 3. RepositoryHost — composition interface

```typescript
// core/ports/repositories/index.ts
export interface RepositoryHost {
  getInvoicesRepository(databaseService: DatabaseService): InvoiceRepository;
  getProposalsRepository(databaseService: DatabaseService): ProposalRepository;
  // ... one method per entity
}

// repositories/index.ts  (the adapter)
export const repositoryHost: RepositoryHost = {
  getInvoicesRepository: (db) => getInvoiceRepository(db),
  getProposalsRepository: (db) => getProposalRepository(db),
  // ...
};
```

Consumers call `repositoryHost.get{Entity}Repository(databaseService)` at the delivery layer (hook or Firebase function), never inside business logic.

### 4. Repository adapters are thin

Repositories have NO business logic. They are typed wrappers around `getGenericRepository()`. State transitions, validation, and side effects all live in hooks (`hooks/service-hooks/`) or Firebase functions (`functions/src/functions/`).

If you find yourself adding a method beyond the generic interface, ask whether it belongs in the consuming function instead.

### 5. Core barrel — single import path

Everything in `core/` is re-exported from `core/index.ts`. Consumers always import from `@/core`, never from deep paths like `@/core/entities/invoice`.

```typescript
// Correct
import { Invoice, InvoiceData, InvoiceRepository } from "@/core";

// Wrong
import { Invoice } from "@/core/entities/invoice";
```

### 6. Hooks layer (frontend delivery)

```typescript
// hooks/repository-hooks/use-invoices.ts
export function useInvoices(organizationId: string) {
  const databaseService = useDatabaseService();
  const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);

  return useQuery({
    queryKey: ["invoices", organizationId],
    queryFn: () => invoiceRepository.getAll({ organizationId, queryConstraints: [] }),
  });
}
```

Client components import the hook, never instantiate repositories directly. State machine (idle/pending/success/error) comes from TanStack Query for free.

### 7. Firebase functions — delivery layer

```typescript
// functions/src/functions/invoices/create-invoice.ts
export const createInvoice = onCall(async (request) => {
  const { organizationId, ...rest } = request.data;

  // Wire deps here — this is the composition root
  const databaseService = serviceHost.getDatabaseService();
  const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);

  // Call business logic (service, or inline if simple)
  const id = await invoiceRepository.create({ organizationId, data: rest });
  return { id };
});
```

Dependencies are wired at the function level. Business logic never reaches into `serviceHost` or `repositoryHost` directly.

### 8. Entities — Zod schemas + inferred types

```typescript
// core/entities/invoice.ts
import { z } from "zod";

export const invoiceDataSchema = z.object({
  organizationId: z.string(),
  // ... fields
});
export type InvoiceData = z.infer<typeof invoiceDataSchema>;

export const invoiceSchema = invoiceDataSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Invoice = z.infer<typeof invoiceSchema>;
```

Separate `{Entity}Data` (write shape, no id/timestamps) from `{Entity}` (full read shape). Repository generics use both.

### 9. DatabaseCollection enum

All Firestore collection names are defined once in `functions/src/repositories/config.ts` and mirrored in `app/src/repositories/config.ts`. Never hardcode collection name strings.

```typescript
export enum DatabaseCollection {
  INVOICES = "invoices",
  PROPOSALS = "proposals",
  ORGANIZATIONS = "organizations",
  // ...
}
```

### 10. i18n — no hardcoded strings in components

All user-facing strings go through `useTranslation()`. Translations live in `app/src/locales/`. Add keys to both `en.json` and `bg.json` when adding new UI text.

---

## Adding a New Feature — Checklist

When scaffolding a new entity (e.g., `opportunity`):

**Core (shared between app and functions):**
- [ ] `app/src/core/entities/{entity}.ts` — Zod schemas, `{Entity}Data`, `{Entity}` types
- [ ] `app/src/core/ports/repositories/{entity}-repository.ts` — type alias
- [ ] Update `app/src/core/ports/repositories/index.ts` — add to `RepositoryHost`
- [ ] Update `app/src/core/index.ts` — re-export new types
- [ ] Mirror entity + port in `functions/src/core/`

**App (frontend adapters):**
- [ ] `app/src/repositories/{entity}-repository.ts` — `get{Entity}Repository()` factory
- [ ] Update `app/src/repositories/index.ts` — add to `repositoryHost`
- [ ] `app/src/hooks/repository-hooks/use-{entity}s.ts` — TanStack Query hook
- [ ] `app/src/pages/{entity}s/` — route page component(s)
- [ ] Add route in `App.tsx`

**Functions (backend adapters):**
- [ ] `functions/src/repositories/{entity}-repository.ts` — factory
- [ ] Update `functions/src/repositories/index.ts` — add to `repositoryHost`
- [ ] Update `functions/src/repositories/config.ts` — add `DatabaseCollection` entry
- [ ] `functions/src/functions/{entity}s/` — callable function entry points

---

## Anti-Patterns

| Pattern | Fix |
|---|---|
| `class InvoiceService { ... }` | Top-level factory function returning object literal |
| `this.repository.get(...)` | No `this`. Use factory params or closure. |
| Hardcoded collection string `"invoices"` | `DatabaseCollection.INVOICES` |
| Business logic inside a repository method | Move to the consuming hook or Firebase function |
| Deep core import `@/core/entities/invoice` | Always import from `@/core` |
| `import { serviceHost } from "..."` inside business logic | Wire deps at the delivery layer (hook / Firebase function) |
| Hardcoded English string in a component | `useTranslation()` + translation file key |
| Duplicate entity definitions between `app/` and `functions/` | Keep in sync — same schema, same field names |

---

## Scaffolding New Features

Use the `/hex-arch` skill (mode B) to generate the entity, port, adapter, hook, and function entry point for a new domain entity in this project.

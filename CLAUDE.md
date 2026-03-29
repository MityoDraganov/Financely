# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Financely is a multi-tenant SaaS platform for invoicing, proposals, CRM, products, workflows, and brand sites. It uses a monorepo structure with Firebase as the backend.

## Monorepo Structure

```
app/           # Main React app (Vite, port 5173)
admin/         # Admin panel (Vite, port 3001)
functions/     # Firebase Functions backend (Node 22, TypeScript → lib/)
cloudflare-worker/  # Brand site edge delivery (KV + R2)
docs/          # Mintlify documentation
firebase.json  # Firebase deployment config
firestore.rules
```

## Development Commands

### App (app/)
```bash
npm --prefix app run dev          # Start dev server (localhost:5173)
npm --prefix app run build        # TypeScript check + Vite build
npm --prefix app run lint         # ESLint
npm --prefix app run test         # Vitest
npm --prefix app run test:watch   # Vitest watch mode
npm --prefix app run test:ui      # Vitest UI
```

### Functions (functions/)
```bash
npm --prefix functions run build  # Compile TypeScript → lib/
npm --prefix functions run serve  # Firebase emulators (functions)
npm --prefix functions run test   # Node.js test runner
npm --prefix functions run deploy # Deploy to Firebase
```

### Admin (admin/)
```bash
npm --prefix admin run dev        # localhost:3001
npm --prefix admin run build      # TypeScript + Vite build
```

### Root
```bash
npm test                          # Run tests for both functions and app
```

### Cloudflare Worker
```bash
npm --prefix cloudflare-worker run dev
npm --prefix cloudflare-worker run deploy
```

## App Architecture

### Entry Point & Providers
`app/src/App.tsx` wraps everything in: `ClerkProvider` → `QueryClientProvider` → `ThemeProvider` → `SidebarProvider` → `OrganizationProvider` → Router.

### Key Directories (app/src/)
- `pages/` — Route-level page components
- `components/` — Reusable UI components
- `hooks/` — Custom hooks split into:
  - `repository-hooks/` — React Query hooks over Firestore repositories
  - `service-hooks/` — Hooks for Firebase callable functions
- `repositories/` — Firestore data access layer (generic repository pattern)
- `services/` — Business logic (AI, email templates, export/import, formulas, etc.)
- `contexts/` — React contexts (organization, widget builder, designer, etc.)
- `utils/` — Pure utility functions

### Multi-Tenancy
Organization context is central. The `OrganizationProvider` (`src/contexts/organization-context.tsx`) resolves the active org from Clerk and exposes it app-wide. All Firestore queries are scoped to `organizationId`.

### Data Fetching Pattern
- **Repository layer**: `repositories/*.ts` — typed Firestore collection access
- **Hook layer**: `hooks/repository-hooks/*.ts` — React Query wrappers around repositories
- **Service hooks**: `hooks/service-hooks/*.ts` — React Query mutations for Firebase callable functions

### State Management
- React Query for all async/server state
- Zustand with localStorage persistence for onboarding flow (`hooks/use-onboarding-store.ts`)
- Context API for app-wide synchronous state (org, theme, sidebar)

### Routing
Public routes: `/`, `/sign-in`, `/sign-up`, `/p/:orgSlug/*` (public catalog), `/widget/:orgId/*`

Protected routes (via `<ProtectedRoute>`): `/dashboard`, `/invoices/*`, `/proposals/*`, `/products/*`, `/contacts/*`, `/leads`, `/workflows/*`, `/integrations/*`, `/settings/*`, `/marketplace/*`, `/analytics`, `/content/*`, `/data-sources`

### Styling
Tailwind CSS v4 with Vite plugin (no `tailwind.config.js` needed for v4). Radix UI primitives wrapped by shadcn/ui components in `components/ui/`. Theme via CSS variables, dark/light toggled with `next-themes`.

## Functions Architecture

`functions/src/index.ts` exports 100+ Firebase callable functions and triggers.

### Structure (functions/src/)
- `functions/` — Individual function implementations
- `services/` — Business logic services
- `repositories/` — Firestore access (mirrors app pattern)
- `core/` — Auth helpers, error handling
- `executors/` — Workflow execution engine
- `templates/` — Email HTML templates

### Key Function Categories
- **Invoices**: create, render PDF (Puppeteer/Chromium), email, share links, extraction
- **Workflows**: triggers (invoice created, lead qualified), execution, cron jobs
- **Organizations**: creation, invites, transfers, brand site generation
- **Stripe**: webhooks for billing/checkout/portal
- **Clerk**: webhooks for user lifecycle events
- **Brand Sites**: publish to Cloudflare KV/R2
- **Widgets**: public catalog, versioned definitions

## Important Conventions

### Firestore Collections
Defined in `functions/src/repositories/config.ts`. Key ones: `organizations`, `users`, `invoices`, `proposals`, `templates`, `products`, `contacts`, `leads`, `workflows`, `workflowRuns`, `emailTemplates`, `metaobjects`, `files`, `widgets`, `marketplaceTemplates`.

### Forms
React Hook Form + Zod validation throughout. Schema definitions typically colocated with form components.

### AI Features
Gemini Flash (`gemini-2.0-flash`) for AI features. Callable functions prefixed with `interpret*` or `generate*`.

### i18n
`i18next` + `react-i18next`. Translation files in `app/src/locales/`. Use `useTranslation()` hook; avoid hardcoded English strings in components.

### Path Aliases
`@/*` maps to `app/src/*` (configured in `vite.config.ts` and `tsconfig.json`).

## Cloudflare Worker

Handles multi-tenant brand site delivery: reads `Host` header → KV lookup for `brandSiteId:versionId` → fetches assets from R2 bucket. Public catalog routes (`/p/*`) are also served here.

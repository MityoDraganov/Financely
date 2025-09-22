# Architecture & LLM Implementation Template

Purpose
- Provide precise instructions and an architectural overview so LLMs can make safe, consistent, strongly-typed changes across this monorepo.

Repository Overview
- Monorepo with three main parts:
  - React + TypeScript app.
  - Cloud Functions: Firebase Functions (TypeScript) integrating with Clerk

Architectural Principles
- Strong typing everywhere; never use any.
- Follow established layering and folder conventions.
- Avoid introducing new libraries unless explicitly required.
- Respect module boundaries; prefer extending existing modules.
- Secure by default: no secrets in code, no logging sensitive data.
- Reuse existing utilities, components, and patterns.
- UI must be responsive, modern, and componentized.

Folder Structure Conventions
- Each app/function uses a consistent feature/layered structure:
  - core/: Domain types, invariants, shared models.
  - infrastructure/: External integrations, adapters, frameworks.
  - repositories/: Data-access abstractions and implementations.
  - services/: Business logic orchestrating repositories.
  - utils/: Cross-cutting helpers (formatting, parsing, etc.).
  - functions/: For Cloud Functions, categorized by domain (clerk, audit-log, big-query, temporary-deals, customer-portal, webflow, hubspot).

- Tech: React Router, @tanstack/react-query, Clerk auth.
- Auth: ClerkProvider with publishable key from env (VITE_CLERK_PUBLISHABLE_KEY). SignedIn/SignedOut gates protect routes.
- Data: React Query for fetching, caching, and mutations.
- Routing: Pages mounted under AppLayout for signed-in users.
- Initializers: Components that prefetch user and product data at app start.
- UI: Reuse shared components; maintain consistent styling; keep layout responsive.

- Utilities: URLParameterHandler, ScrollToTop, shared components (Header, Footer, FAQs, testimonials).
- Routing: MVP order/quote pages, success/thank-you flows, catch-all route.
- UI: Customer-facing, responsive, consistent branding.

Cloud Functions (Firebase + TypeScript)
- Firebase Admin initialized once per process.
- Functions exported per domain:
  - Clerk: Webhooks and user lifecycle events.
  - Audit Log: Product/deal change audits.
  - Customer Portal: Quote/order creation flows.
  - Webflow & HubSpot: Webhooks and integrations.
  - Scheduled: Temporary deals cleanup.
  - BigQuery: Reporting sync and range queries.
- Layering: services orchestrate repositories; repositories access external systems; utils/core keep shared logic typed and testable.

Coding Standards
- TypeScript strict: explicit types, no implicit any, precise generics.
- Naming: descriptive file and symbol names; kebab-case files, PascalCase components/classes, camelCase functions.
- Error handling: Fail fast; surface actionable messages; never swallow errors silently.
- Logging: Minimal, non-sensitive, structured if possible.
- Linting/formatting: Respect existing configs; run locally if available.
- Testing (Functions): Prefer unit tests at services/repositories; mock external services.

UI/UX Standards
- Componentized: break complex views into small reusable pieces.
- Responsive: mobile-first, fluid layouts, accessible components.
- Consistency: follow existing styles and interactions; avoid drastic changes.
- Performance: avoid unnecessary re-renders; memoize where appropriate.

Data & Async Patterns (Frontend)
- Use React Query for server state:
  - Define stable query keys by domain and parameters.
  - Keep mutation side-effects localized; invalidate related queries.
  - Model data with strict types; parse/validate where needed.

Security & Configuration
- Secrets in env files only; never commit secrets.
- Validate external payloads (webhooks); sanitize inputs.
- Treat PII with care; avoid logging emails, names, IDs.
- Check configuration files before changing deploy targets or hosting settings.

Change Management
- Prefer editing existing files over creating new ones.
- Align with existing modules; don’t duplicate functionality.
- Avoid adding dependencies; if necessary, justify and confine usage.
- Keep changes minimal, cohesive, and reversible.

LLM Task Execution Template
1) Context
- Describe the task, its scope, and affected domains (admin-portal, customer-portal, functions).
- Note constraints: strong typing, existing patterns, no secrets, minimal dependencies.

2) Discovery
- Identify relevant folders and files.
- Map the change to existing layers (core/infrastructure/repositories/services/utils).

3) Design
- Define inputs/outputs with precise types.
- Specify query keys/mutations (frontend) or service/repository APIs (backend).
- Outline UI components (structure, props, responsiveness).

4) Implementation
- Add/modify code within the correct layer.
- Ensure all imports are present and consistent.
- Write strict types; remove any use of any.
- Reuse utilities/components; avoid duplication.

5) Verification
- Frontend: run/build, check routes and loaders, validate React Query behavior.
- Backend: run unit tests (if available), validate function exports and handlers.
- Security: no secrets, no sensitive logs, inputs validated.

6) Deliverables
- List changed files and purposes.
- Provide short rationale for architectural fit.
- Include testing notes and manual verification steps.

Reference Pointers
- Admin: src/App.tsx (providers, routing, initializers, layout).
- Customer: src/App.tsx (routing, shared components, utilities).
- Functions: src/index.ts (exports, initialization) and domain folders under src/functions/.

Notes for LLMs
- Match the project’s established architecture and style.
- Keep PR-sized changes: focused and incremental.
- If unsure, prefer strengthening types, adding tests, and aligning with existing abstractions.
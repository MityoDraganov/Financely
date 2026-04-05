# Financely PM Reset Plan (2026-04-05)

## 1) Snapshot (Current Reality)

- Repository: `MityoDraganov/Financely`
- Open GitHub Issues: **0**
- Open GitHub PRs: **2 draft PRs**
  - `#1` Fix firestore not found error (draft)
  - `#2` Build invoice template designer (draft)
- Current branch: `Clerk-organizations-and-billing`
- Local workspace contains uncommitted WIP changes (marketplace/admin/auth-related files).

## 2) What Is Missing (From Business Perspective)

The platform has many advanced modules, but there is no single clearly prioritized business journey with measurable outcomes.

### Recommended North Star Journey (v1)

`Lead captured -> Proposal sent -> Proposal accepted -> Invoice issued -> Invoice paid -> Follow-up workflow`

This journey should become the main product narrative, documentation backbone, and roadmap anchor.

## 3) Confirmed Real Issues (Code-Verified)

## P0 (Critical)

1. Missing auth/authz checks in critical callable functions:
- `functions/src/functions/publish-brand-site.ts:84`
- `functions/src/functions/publish-brand-site.ts:108`
- `functions/src/functions/upload-file.ts:57`
- `functions/src/functions/generate-invoice-share-link.ts:46`
- `functions/src/functions/render-invoice-pdf.ts:53`
- `functions/src/functions/delete-brand-site.ts:71`
- `functions/src/functions/update-brand-site-pages.ts:135`

2. Firestore multi-tenant data exposure risk through broad `list` rules:
- `firestore.rules:107` (`users` list)
- `firestore.rules:201` (`proposals` list)
- `firestore.rules:219` (`leads` list)
- `firestore.rules:237` (`contacts` list)
- `firestore.rules:371` (`templateVersions` list)
- `firestore.rules:393` (`emailTemplateVersions` list)
- `firestore.rules:451` (`marketplaceTemplates` list)
- `firestore.rules:605` (`files` list)

3. Unsanitized HTML render paths (XSS risk):
- `app/src/pages/widget/modular-widget-page.tsx:561`
- `app/src/components/templates/email-template-card-preview.tsx:147`

## P1 (High)

4. Documentation drift (docs refer to removed/renamed implementation paths):
- `docs/ONBOARDING_FLOW.md:62` references missing `onboarding-flow.tsx`
- `docs/XSS_PROTECTION_IMPLEMENTATION.md:34` references old onboarding path

5. No CI workflows detected (`.github/workflows` missing).

6. Product planning artifacts are fragmented (many docs, no single source of truth for roadmap + ownership + status).

## P2 (Important)

7. Excessive debug logs in app/admin/functions, including auth-flow logs and verbose repository logs.

8. Test coverage is present but narrow for current scope (few tests vs large surface area).

## 4) 30-Day Execution Plan

## Week 1: Security + Tenant Isolation (Blockers)

1. Implement mandatory auth/authz guard utility in functions.
2. Patch all listed callable functions to enforce auth + org membership + role checks.
3. Restrict Firestore `list` rules to safe queries only (or remove list where not needed).
4. Patch unsafe HTML injection points using existing sanitizer utility.
5. Add regression tests for auth guards and sanitizer-critical paths.

Definition of Done:
- Unauthenticated calls are rejected with `unauthenticated`.
- Cross-organization data query attempts are denied.
- XSS payloads are sanitized in affected render paths.

## Week 2: Core Journey Productization

1. Formalize one canonical E2E flow (Lead -> Paid Invoice).
2. Create one "Quick Start" execution path in product UI and docs.
3. Define KPI set:
- Time to first invoice
- Proposal acceptance rate
- Invoice paid rate
- Days to payment

Definition of Done:
- User can complete end-to-end flow without switching across disconnected modules.
- Metrics emitted for each stage transition.

## Week 3: Roadmap Hygiene + Delivery System

1. Convert this plan into GitHub issues (epics + tasks + acceptance criteria).
2. Resolve stale draft PR strategy:
- Rebase and merge, or close with replacement issues.
3. Add CI baseline:
- typecheck, lint, unit tests for app/functions.

Definition of Done:
- Active backlog exists in GitHub Issues.
- Every PR links to an issue and has test evidence.

## Week 4: Reliability + GTM Readiness

1. Reduce debug logging noise and standardize production logger levels.
2. Update all key docs to match code reality.
3. Build a concise demo script around the North Star journey.

Definition of Done:
- Docs and code paths are aligned.
- Demo can explain business value before technical depth.

## 5) Immediate Task Backlog (Ready to Create as GitHub Issues)

1. `P0: Enforce auth/authz in brand site and invoice callable functions`
2. `P0: Tighten Firestore list rules for tenant isolation`
3. `P0: Sanitize widget headline and email card preview HTML`
4. `P1: Create canonical Lead-to-Payment journey doc and implementation checklist`
5. `P1: Add CI workflow for app/functions lint + test + typecheck`
6. `P1: Audit and resolve stale draft PR #1 and #2`
7. `P2: Remove production debug logs in auth/repository flows`
8. `P2: Expand tests for security-critical paths`

## 6) PM Cadence (Recommended)

- Daily (10 min): Progress, blockers, risk changes.
- Weekly (45 min): Scope review vs KPIs, reprioritization.
- Every 2 weeks: Demo only the North Star journey improvements.

## 7) PM Rule Going Forward

No new feature enters implementation without:
1. Business problem statement.
2. Success metric.
3. Owner and deadline.
4. Acceptance criteria and test plan.

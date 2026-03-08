# Financely

Financely is a multi-tenant platform for invoices, proposals, workflows, CRM-style contacts/leads, embeddable widgets, and AI-assisted content/site generation.

This repository is a monorepo containing the main app, admin app, backend functions, Cloudflare worker, docs, and supporting assets.

## Architecture

- `app/`: customer-facing React + Vite web app
- `admin/`: standalone admin React + Vite web app
- `functions/`: Firebase Functions backend (TypeScript, Node.js 22)
- `cloudflare-worker/`: Worker for branded site delivery (KV + R2 + DNS flows)
- `docs/`: Mintlify documentation content

## Tech Stack

- React 19, TypeScript, Vite, Tailwind CSS
- Firebase (Firestore, Realtime Database, Storage, Hosting, Functions)
- Clerk (authentication)
- Stripe (billing)
- Resend (email)
- Gemini/OpenAI (AI features)
- Cloudflare Workers, KV, R2

## Repository Structure

```text
.
├── app/
├── admin/
├── functions/
├── cloudflare-worker/
├── docs/
├── demo-site/
├── playbooks/
├── promo-videos/
├── firebase.json
└── config.json
```

## Prerequisites

- Node.js 22+
- npm 10+
- Firebase CLI (`npm i -g firebase-tools`)
- Wrangler CLI for Cloudflare tasks (`npm i -g wrangler`)

## Quick Start

1. Install dependencies:

```bash
npm install
npm --prefix app install
npm --prefix admin install
npm --prefix functions install
npm --prefix cloudflare-worker install
```

2. Ensure Firebase web config is available:
- root app reads `config.json`
- admin reads `admin/config.json` (symlink to root file is supported)

```bash
ln -s ../config.json admin/config.json
```

3. Create local env files:
- `app/.env.local`
- `admin/.env`

4. Start local development (separate terminals):

```bash
npm --prefix app run dev
npm --prefix admin run dev
npm --prefix functions run serve
```

Default local URLs:
- app: `http://localhost:5173`
- admin: `http://localhost:3001`

## Environment Variables

### App (`app/.env.local`)

- `VITE_CLERK_PUBLISHABLE_KEY` (required)
- `VITE_STRIPE_PUBLISHABLE_KEY` (optional)
- `VITE_STRIPE_PRICE_ID` (optional)
- `VITE_STRIPE_PRICING_TABLE_ID` (optional)
- `VITE_STRIPE_BUY_BUTTON_ID` (optional)
- `VITE_GOOGLE_FONTS_API_KEY` (optional)

### Admin (`admin/.env`)

- `VITE_CLERK_PUBLISHABLE_KEY` (required)
- `VITE_MAIN_APP_URL` (optional)

### Functions secrets (Firebase Secret Manager)

- `CLERK_API_SECRET`
- `CLERK_WEBHOOK_SECRET`
- `ADMIN_CLERK_API_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `FIREBASE_PROJECT_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_BASE_DOMAIN`

## Scripts

### Root

```bash
npm test
npm run test:functions
npm run test:app
```

### App

```bash
npm --prefix app run dev
npm --prefix app run build
npm --prefix app run lint
npm --prefix app run test
```

### Admin

```bash
npm --prefix admin run dev
npm --prefix admin run build
npm --prefix admin run lint
```

### Functions

```bash
npm --prefix functions run build
npm --prefix functions run serve
npm --prefix functions run test
npm --prefix functions run lint
```

### Cloudflare Worker

```bash
npm --prefix cloudflare-worker run dev
npm --prefix cloudflare-worker run deploy
```

## Deployment

### Firebase (app + backend + rules)

```bash
npm --prefix app run build
npm --prefix functions run build
firebase deploy --only hosting,functions,firestore,database,storage
```

### Admin hosting

```bash
npm --prefix admin run build
cd admin && firebase deploy --only hosting
```

### Cloudflare worker

```bash
npm --prefix cloudflare-worker run deploy
```

## Documentation

- Product/developer docs: `docs/`
- Feature guide: `docs/FINANCELY_FUNCTIONALITIES.md`
- Quick start notes: `docs/QUICK_START.md`
- Engineering playbooks: `playbooks/README.md`

## Contributing

1. Create a branch from `main`.
2. Keep changes scoped and add/update tests where behavior changes.
3. Run lint/tests before opening a PR.
4. Update docs for feature/infrastructure changes.

## Security

- Never commit secrets.
- Use Firebase Secret Manager for backend secrets.
- Review rules before deploy:
  - `firestore.rules`
  - `database.rules.json`
  - `storage.rules`

## License

Licensed under the Apache License 2.0. See [LICENSE](./LICENSE).

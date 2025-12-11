# Financely Admin Panel

Standalone admin panel application for Financely, deployable to a subdomain (e.g., `admin.financely.app`).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_MAIN_APP_URL=https://app.financely.app
```

3. Copy `config.json` from root directory (or create symlink):
```bash
ln -s ../config.json config.json
```

## Development

```bash
npm run dev
```

The admin panel will run on `http://localhost:3001`

## Build

```bash
npm run build
```

Output will be in `dist/` directory.

## Deployment

### Firebase Hosting

1. Create `firebase.json` in admin folder:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

2. Deploy:
```bash
firebase deploy --only hosting
```

### Cloudflare Pages

1. Connect your repository
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Set root directory: `admin`

### Environment Variables

Make sure to set these in your hosting platform:
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `VITE_MAIN_APP_URL` - Main app URL for redirects

## Features

- Dashboard with platform KPIs
- Organizations management
- Users management (coming soon)
- Billing management (coming soon)
- Usage tracking (coming soon)
- System settings (coming soon)
- Logs & monitoring (coming soon)

## Admin Roles

Users need admin role set in Clerk's `publicMetadata.adminRole`:
- `superadmin` - Full access
- `billing_admin` - Billing access
- `support_admin` - Support access
- `read_only_admin` - Read-only access

## Architecture

- **Standalone app**: Completely separate from main app
- **Shared backend**: Uses same Firebase Functions and Firestore
- **Same auth**: Uses Clerk for authentication
- **Independent deployment**: Can be deployed to any subdomain


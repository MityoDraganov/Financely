# The Miles Market - Agent Guide

## Build/Test Commands
- **Functions**: `cd functions && yarn build && yarn test`
- **Customer Portal**: `cd customer-portal && yarn build && yarn lint`
- **Admin Portal**: `cd admin-portal && yarn build && yarn lint`
- **Firebase Deploy**: `firebase deploy --only functions`
- **Emulators**: `cd functions && yarn emulators`

## Architecture
- **Firebase Functions** (`functions/`) - Backend serverless functions (Node.js 22, TypeScript)
- **Customer Portal** (`customer-portal/`) - React/Vite SPA with Clerk auth
- **Admin Portal** (`admin-portal/`) - React/Vite SPA with Clerk auth
- **Database**: Firestore (currently open rules - expires Jul 19, 2025)
- **Auth**: Clerk integration with webhook handling
- **Hosting**: Firebase Hosting for both portals

## Code Style
- **TypeScript**: Strict mode enabled, ES2017 target
- **Import Order**: External packages → config → core → infrastructure → services/repositories
- **Error Handling**: Try-catch with LoggerService, descriptive error messages
- **Barrel Exports**: `index.ts` files for clean imports
- **Dependency Injection**: Services injected through host objects
- **Formatting**: Prettier for all files
- **Linting**: ESLint with TypeScript rules, no unused vars/imports

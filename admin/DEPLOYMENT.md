# Admin Panel Deployment Guide

## Overview

The admin panel is a standalone React app that can be deployed to a subdomain independently from the main Financely app.

## Prerequisites

1. Firebase project configured
2. Clerk account with admin users set up
3. Environment variables configured

## Deployment Options

### Option 1: Firebase Hosting (Recommended)

1. **Install Firebase CLI** (if not already installed):
```bash
npm install -g firebase-tools
```

2. **Login to Firebase**:
```bash
firebase login
```

3. **Initialize Firebase in admin folder** (if not already done):
```bash
cd admin
firebase init hosting
```

4. **Build the app**:
```bash
npm run build
```

5. **Deploy**:
```bash
firebase deploy --only hosting
```

6. **Configure custom domain** (optional):
- Go to Firebase Console → Hosting
- Add custom domain: `admin.financely.app`
- Follow DNS configuration instructions

### Option 2: Cloudflare Pages

1. **Connect Repository**:
   - Go to Cloudflare Dashboard → Pages
   - Connect your Git repository
   - Select the `admin` folder as root directory

2. **Configure Build Settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `admin`

3. **Set Environment Variables**:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_MAIN_APP_URL`

4. **Deploy**:
   - Cloudflare will automatically deploy on push to main branch
   - Or trigger manual deployment from dashboard

### Option 3: Vercel

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Deploy**:
```bash
cd admin
vercel
```

3. **Configure**:
   - Set root directory to `admin`
   - Add environment variables
   - Configure custom domain

### Option 4: Netlify

1. **Install Netlify CLI**:
```bash
npm install -g netlify-cli
```

2. **Deploy**:
```bash
cd admin
netlify deploy --prod
```

3. **Configure**:
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Add environment variables

## Environment Variables

Set these in your hosting platform:

- `VITE_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `VITE_MAIN_APP_URL` - Main app URL (e.g., `https://app.financely.app`)

## Post-Deployment

1. **Verify admin access**:
   - Visit the deployed URL
   - Sign in with an admin user
   - Verify dashboard loads

2. **Test redirects**:
   - Sign out and verify redirect to main app
   - Sign in as non-admin and verify redirect

3. **Check CORS** (if needed):
   - Ensure Firebase Functions allow requests from admin subdomain
   - Update CORS settings if necessary

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Check Node version matches (should be 18+)
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

### Runtime Errors
- Check browser console for errors
- Verify environment variables are set
- Check Firebase config is correct
- Verify Clerk publishable key is valid

### Authentication Issues
- Verify Clerk publishable key is correct
- Check that admin role is set in Clerk metadata
- Ensure redirect URLs are configured in Clerk dashboard

### API Errors
- Check Firebase Functions are deployed
- Verify CORS is configured correctly
- Check network tab for failed requests

## Monitoring

- Set up error tracking (Sentry, etc.)
- Monitor Firebase Functions logs
- Track admin panel usage analytics
- Set up alerts for critical errors


# Quick Setup Guide

## Set Admin Clerk Secret

Run this command and paste your admin Clerk secret key when prompted:

```bash
firebase functions:secrets:set ADMIN_CLERK_API_SECRET
```

When prompted, paste:
```
sk_test_gcYjOG1zz5FORs3cQXbeL8Si07f1LUMLdqkPOMbDCU
```

## Deploy the Function

After setting the secret, deploy the new function:

```bash
cd functions
firebase deploy --only functions:verifyAdminClerkToken
```

## Verify Setup

1. Sign in to the admin panel
2. Open browser console
3. Look for: `[ADMIN AUTH] Successfully signed in to Firebase Auth`
4. Check that `adminRole: "superadmin"` is logged

## Important Notes

- This secret is from your **admin Clerk instance** (separate from main app Clerk)
- The secret starts with `sk_test_` (test) or `sk_live_` (production)
- Make sure the user in your admin Clerk has `adminRole: "superadmin"` in their public metadata


# Check Firebase Functions Secrets

## Current Secrets Status

✅ **CLERK_API_SECRET** (Main App Clerk): Set
✅ **ADMIN_CLERK_API_SECRET** (Admin Panel Clerk): Set

## View Secret Values

```bash
# Main app Clerk secret
firebase functions:secrets:access CLERK_API_SECRET

# Admin panel Clerk secret
firebase functions:secrets:access ADMIN_CLERK_API_SECRET
```

## View Secret Versions (using gcloud)

```bash
# List versions of main app Clerk secret
gcloud secrets versions list CLERK_API_SECRET --project=invoicegenerator-8d7ce

# List versions of admin Clerk secret
gcloud secrets versions list ADMIN_CLERK_API_SECRET --project=invoicegenerator-8d7ce
```

## View in Google Cloud Console

1. Go to: https://console.cloud.google.com/security/secret-manager?project=invoicegenerator-8d7ce
2. Click on the secret name to see all versions
3. Each version shows:
   - Version number
   - State (enabled/disabled)
   - Created date
   - Destroy date (if applicable)

## Quick Check

Both secrets are already configured:
- **CLERK_API_SECRET**: `sk_test_fLrK0Ueexh7RaSpZgR9FvBU1WJorLQ9AGXLgmboD9u`
- **ADMIN_CLERK_API_SECRET**: `sk_test_gcYjOG1zz5FORs3cQXbeL8Si07f1LUMLdqkPOMbDCU`

You can now deploy the `verifyAdminClerkToken` function!


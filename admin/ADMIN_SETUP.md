# Admin Panel Setup Guide

## Setting Admin Role

To give a user admin access, you need to set the `adminRole` in Clerk's publicMetadata:

### Option 1: Via Clerk Dashboard
1. Go to Clerk Dashboard → Users
2. Select the user
3. Go to "Metadata" tab
4. Add to "Public metadata":
   ```json
   {
     "adminRole": "superadmin"
   }
   ```
5. The webhook will automatically sync this to Firebase Auth custom claims

### Option 2: Via Clerk API
```bash
curl -X PATCH https://api.clerk.com/v1/users/{user_id}/metadata \
  -H "Authorization: Bearer {clerk_secret_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "public_metadata": {
      "adminRole": "superadmin"
    }
  }'
```

### Option 3: Directly in Firebase Auth (Quick Fix)
```javascript
// Run in Firebase Console or via Admin SDK
const admin = require('firebase-admin');
await admin.auth().setCustomUserClaims(userId, {
  adminRole: 'superadmin'
});
```

## Available Admin Roles
- `superadmin` - Full access
- `billing_admin` - Billing and subscription management
- `support_admin` - User support and organization management
- `read_only_admin` - Read-only access

## Firestore Rules
The Firestore rules now include an `isAdmin()` function that checks `request.auth.token.adminRole`. 
All collections have `allow read, write: if isAdmin();` at the top, giving admins complete global access.

## Troubleshooting

If you still get permission errors:
1. Make sure the admin role is set in Clerk publicMetadata
2. Wait for the webhook to sync (or trigger user.updated event)
3. Sign out and sign back in to refresh the Firebase Auth token
4. Check Firebase Auth custom claims: `firebase.auth().currentUser.getIdTokenResult()` and look for `claims.adminRole`


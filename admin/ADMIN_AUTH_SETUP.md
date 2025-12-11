# Admin Panel Authentication Setup

## Problem
The admin panel uses a **separate Clerk instance** from the main app. The admin panel needs to:
1. Authenticate with the admin Clerk instance
2. Exchange the admin Clerk token for a Firebase token
3. Include the admin role in Firebase Auth custom claims for Firestore rules

## Solution

### 1. Set Admin Clerk Secret
You need to set the admin Clerk API secret in Firebase:

```bash
firebase functions:secrets:set ADMIN_CLERK_API_SECRET
```

Enter the secret key from your **admin Clerk instance** (not the main app Clerk).

### 2. Deploy Functions
Deploy the new `verifyAdminClerkToken` function:

```bash
cd functions
firebase deploy --only functions:verifyAdminClerkToken
```

### 3. How It Works

1. **Admin Panel** (`admin/src/components/AdminAuthProvider.tsx`):
   - User signs in with Clerk (admin Clerk instance)
   - Gets Clerk session token
   - Calls `verifyAdminClerkToken` Cloud Function
   - Receives Firebase custom token with `adminRole` in custom claims
   - Signs in to Firebase Auth with the custom token

2. **Cloud Function** (`functions/src/functions/clerk/verify-admin-clerk-token.ts`):
   - Verifies Clerk token using **admin Clerk secret**
   - Fetches user from Clerk API to get `publicMetadata.adminRole`
   - Creates Firebase custom token with `adminRole` in custom claims
   - Syncs admin role to Firebase Auth custom claims for persistence

3. **Firestore Rules** (`firestore.rules`):
   - `isAdmin()` function checks `request.auth.token.adminRole`
   - All collections have `allow read, write: if isAdmin();` at the top
   - Admins have complete global access

### 4. Verify It's Working

After signing in to the admin panel, check the browser console for:
```
[ADMIN AUTH] Successfully signed in to Firebase Auth: { uid: "...", adminRole: "superadmin" }
```

You can also verify the custom claims:
```javascript
const tokenResult = await firebase.auth().currentUser?.getIdTokenResult();
console.log('Custom claims:', tokenResult?.claims);
// Should show: { adminRole: "superadmin", ... }
```

## Troubleshooting

### Still getting permission errors?

1. **Check admin role is set in Clerk**:
   - Go to Clerk Dashboard → Users → Your User
   - Public metadata should have: `{ "adminRole": "superadmin" }`

2. **Check Firebase secret is set**:
   ```bash
   firebase functions:secrets:access ADMIN_CLERK_API_SECRET
   ```

3. **Check function is deployed**:
   ```bash
   firebase functions:list | grep verifyAdminClerkToken
   ```

4. **Sign out and sign back in** to refresh the Firebase token

5. **Check browser console** for `[ADMIN AUTH]` logs to see where it's failing


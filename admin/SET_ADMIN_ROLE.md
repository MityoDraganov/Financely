# Quick Fix: Set Admin Role

Since you said "All clerk users to the given clerk are admins", here's the quickest way to fix the permission error:

## Option 1: Set in Firestore User Document (Immediate Fix)

1. Go to Firebase Console → Firestore Database
2. Find your user document in the `users` collection (document ID is your Clerk user ID)
3. Add field: `adminRole` with value: `superadmin`
4. Refresh the admin panel - it should work immediately

## Option 2: Set in Clerk Dashboard (Permanent Fix)

1. Go to Clerk Dashboard → Users
2. Find your user
3. Go to "Metadata" → "Public metadata"
4. Add:
   ```json
   {
     "adminRole": "superadmin"
   }
   ```
5. The webhook will sync this to Firebase Auth custom claims on next user update
6. Sign out and sign back in to refresh the token

## Option 3: Use Firebase Admin SDK (Script)

Create a script to set admin role for all users:

```javascript
const admin = require('firebase-admin');
admin.initializeApp();

async function setAllUsersAsAdmin() {
  const db = admin.firestore();
  const users = await db.collection('users').get();
  
  for (const userDoc of users.docs) {
    await userDoc.ref.update({ adminRole: 'superadmin' });
    await admin.auth().setCustomUserClaims(userDoc.id, { adminRole: 'superadmin' });
    console.log(`Set admin role for user: ${userDoc.id}`);
  }
}

setAllUsersAsAdmin();
```

## Current Status

✅ Firestore rules deployed with admin bypass
✅ All collections allow `allow read, write: if isAdmin();`
✅ Rules check both Firebase Auth custom claims AND Firestore user document

The permission error should be resolved once you set `adminRole: 'superadmin'` in your Firestore user document.


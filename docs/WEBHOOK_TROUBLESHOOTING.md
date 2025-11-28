# Clerk Webhook Troubleshooting Guide

## Current Issues and Fixes

### 1. Permission Issues with `lib` Directory

**Problem**: The `lib` directory has files owned by root or another user, preventing builds.

**Fix**:
```bash
cd /Users/mityodraganov/Documents/GitHub/Financely/functions

# Option 1: Change ownership (recommended)
sudo chown -R $(whoami) lib

# Option 2: Remove and rebuild
sudo rm -rf lib
npm run build

# Option 3: If the above don't work, use Finder
# Open Finder → Go to functions/lib → Get Info → Change permissions to allow write
```

### 2. Build and Deploy

After fixing permissions:

```bash
cd functions

# Install dependencies (if not done)
npm install

# Build
npm run build

# Deploy
firebase deploy --only functions:onClerkWebhookEvent
```

### 3. Set Up Webhook Secret

```bash
# Set the secret (you'll be prompted to paste it)
firebase functions:secrets:set CLERK_WEBHOOK_SECRET

# After setting, redeploy
firebase deploy --only functions:onClerkWebhookEvent
```

## Testing the Webhook

### Test with Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Webhooks**
3. Click on your endpoint
4. Go to **Testing** tab
5. Select `user.created` event
6. Click **Send Example**

### Check Function Logs

```bash
# Watch logs in real-time
firebase functions:log --only onClerkWebhookEvent

# Or view in Firebase Console
# https://console.firebase.google.com/project/YOUR_PROJECT/functions/logs
```

### What to Look For in Logs

**Success**:
```
✅ Received Clerk webhook
✅ Webhook verified successfully, event type: user.created
✅ Handling user.created event
✅ Creating Clerk user in Firestore: user_xxxxx
✅ Clerk user email: user@example.com
✅ User created in Firestore successfully: user_xxxxx
✅ Clerk webhook processed successfully
```

**Common Errors**:

#### Error: "Missing Svix headers"
```
❌ Missing Svix headers
```
**Fix**: Clerk isn't sending proper headers. Check webhook configuration in Clerk Dashboard.

#### Error: "Invalid webhook signature"
```
❌ Error verifying webhook: Error: Invalid webhook signature
```
**Fixes**:
1. Verify the webhook secret matches Clerk:
   ```bash
   firebase functions:secrets:set CLERK_WEBHOOK_SECRET
   ```
2. Copy the **Signing Secret** from Clerk Dashboard (not the webhook URL)
3. Redeploy after changing secret

#### Error: "Clerk user doesn't have an email address"
```
❌ Clerk user doesn't have an email address
```
**Fix**: This shouldn't happen in production. Clerk users always have an email. Check test data.

#### Error: "Failed to create user in Firestore"
```
❌ Failed to create user in Firestore: PERMISSION_DENIED
```
**Fix**: Check Firestore security rules. The Cloud Function needs write access to the `users` collection.

**Firestore Rules** (ensure you have this):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow Cloud Functions to write
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
      // Allow Cloud Functions (admin SDK) full access
      allow write: if request.auth == null; // This allows Cloud Functions
    }
  }
}
```

## Webhook Payload Structure

The webhook you showed is correct. Here's how it maps to our code:

```typescript
// Clerk sends this:
{
  "type": "user.created",  // ← Used to route to correct handler
  "data": {                // ← The actual user data
    "id": "user_xxxxx",
    "email_addresses": [...],
    "first_name": "Mityo",
    "last_name": "Draganov",
    ...
  }
}

// Our code handles it like this:
switch (event.type) {  // "user.created"
  case ClerkEventType.USER_CREATED:
    await createClerkUserInFirestore(
      { clerkUser: event.data },  // Passes the user data
      { loggerService, userRepository }
    );
}
```

## Verifying User Was Created

After a successful webhook:

1. **Check Firestore**:
   - Go to Firebase Console → Firestore Database
   - Look for `users` collection
   - Find document with ID matching Clerk user ID (e.g., `user_33YfsMCfaOoirG81CcHEpagAIEl`)

2. **Expected Document Structure**:
```javascript
{
  clerkId: "user_33YfsMCfaOoirG81CcHEpagAIEl",
  email: "mityodraganow@gmail.com",
  name: "Mityo Draganov",
  avatarUrl: "https://...",
  organizationRoles: {},  // Empty initially
  status: "active",
  preferences: {
    theme: "system",
    language: "en",
    timezone: "UTC"
  },
  createdAt: <timestamp>,
  updatedAt: <timestamp>
}
```

3. **Test in Your App**:
   - Log in with the user
   - The app should detect no organizations
   - Onboarding flow should appear

## Complete Setup Checklist

- [ ] Fix `lib` directory permissions
- [ ] Install dependencies: `npm install`
- [ ] Build successfully: `npm run build`
- [ ] Set webhook secret: `firebase functions:secrets:set CLERK_WEBHOOK_SECRET`
- [ ] Deploy function: `firebase deploy --only functions:onClerkWebhookEvent`
- [ ] Get function URL from deployment output
- [ ] Add endpoint in Clerk Dashboard
- [ ] Subscribe to events: `user.created`, `user.updated`, `user.deleted`
- [ ] Copy signing secret from Clerk and update Firebase secret
- [ ] Send test webhook from Clerk Dashboard
- [ ] Check Firebase logs for success
- [ ] Verify user created in Firestore
- [ ] Test by signing up a real user

## Manual Fix for Existing Users

If you have users who signed up before the webhook was set up:

```typescript
// You can manually create them through the app
// The onboarding flow will create the user document automatically
// when they try to create their first organization

// OR run a one-time migration script
// (Contact me if you need help with this)
```

## Monitoring

### Set Up Alerts

In Firebase Console:
1. Go to Functions → onClerkWebhookEvent
2. Click **Details**
3. Set up alerts for:
   - Error rate > 5%
   - Execution time > 10s

### Clerk Dashboard Monitoring

In Clerk Dashboard → Webhooks → Your Endpoint:
- View recent attempts
- See success/failure rates
- Check retry history
- View detailed error messages

## Common Questions

**Q: Do I need to manually create users in Firestore?**
A: No! The webhook automatically creates users when they sign up in Clerk.

**Q: What if a user signed up before I set up webhooks?**
A: The onboarding flow handles this gracefully. When they create their first organization, the user document will be created automatically.

**Q: Can I test without deploying?**
A: Yes, use Firebase emulators, but webhook signature verification won't work locally.

**Q: How do I update the webhook secret?**
A: Run `firebase functions:secrets:set CLERK_WEBHOOK_SECRET` and then redeploy.

**Q: The webhook is working but users still see onboarding**
A: This is correct! Users need to create an organization through onboarding even after the webhook creates their user document.

## Need Help?

1. Check Firebase logs: `firebase functions:log --only onClerkWebhookEvent`
2. Check Clerk webhook attempts in Clerk Dashboard
3. Verify Firestore rules allow Cloud Functions to write
4. Ensure webhook secret is set correctly
5. Check the webhook URL in Clerk matches your deployment

## Next Steps After Setup

Once webhooks are working:
1. ✅ Users automatically sync from Clerk to Firestore
2. ✅ User signs up → Webhook fires → User created in Firestore
3. ✅ User opens app → Onboarding checks for organizations
4. ✅ No organizations found → Onboarding flow appears
5. ✅ User creates organization → Set as owner
6. ✅ User can start using the app!


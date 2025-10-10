# Clerk Webhook Setup Guide

This guide explains how to set up Clerk webhooks to automatically sync user data between Clerk and Firestore.

## Overview

When users sign up or delete their accounts in Clerk, webhooks automatically:
1. Create/update user documents in Firestore
2. Delete user documents when accounts are removed
3. Sync user profile information (email, name, avatar)

## Architecture

```
Clerk Event (user.created/updated/deleted)
    ↓
Clerk sends webhook to Firebase Function
    ↓
Firebase Function (onClerkWebhookEvent)
    ↓
Verifies signature with Svix
    ↓
Handles event:
    - user.created → Creates user in Firestore
    - user.updated → Updates user in Firestore
    - user.deleted → Deletes user from Firestore
```

## Files Created

### Core Entities
- **`functions/src/core/entities/clerk-user.ts`** - TypeScript types for Clerk user data

### App Handlers
- **`functions/src/app/clerk/create-clerk-user-in-firestore.ts`** - Creates user in Firestore
- **`functions/src/app/clerk/delete-clerk-user-from-firestore.ts`** - Deletes user from Firestore
- **`functions/src/app/clerk/handle-clerk-webhook.ts`** - Main webhook handler with signature verification

### Cloud Function
- **`functions/src/functions/clerk/on-clerk-event-webhook.ts`** - HTTP function that receives webhooks

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

New dependencies added:
- `@clerk/backend` - Clerk types and utilities
- `svix` - Webhook signature verification

### 2. Set Up Webhook Secret

Firebase Functions uses secrets for secure configuration. Set up your Clerk webhook secret:

```bash
# In the functions directory
firebase functions:secrets:set CLERK_WEBHOOK_SECRET
```

When prompted, paste your Clerk webhook signing secret (you'll get this in step 4).

### 3. Deploy the Function

```bash
# Build and deploy
npm run build
firebase deploy --only functions:onClerkWebhookEvent
```

After deployment, you'll get a URL like:
```
https://us-central1-your-project.cloudfunctions.net/onClerkWebhookEvent
```

### 4. Configure Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**
5. Enter your function URL:
   ```
   https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/onClerkWebhookEvent
   ```
6. Subscribe to these events:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
7. Click **Create**
8. Copy the **Signing Secret** and use it in step 2 above

### 5. Test the Webhook

#### Test in Clerk Dashboard
1. In the Webhooks page, click on your endpoint
2. Click **Testing** tab
3. Select an event type (e.g., `user.created`)
4. Click **Send Example**

#### Test with Real User
1. Sign up a new user in your app
2. Check Firebase Console → Firestore
3. You should see a new document in the `users` collection
4. The document ID will match the Clerk user ID

## Data Structure

When a user is created, the following document is added to Firestore:

```typescript
// Collection: users
// Document ID: clerk_user_id
{
  clerkId: string,              // Clerk user ID
  email: string,                // Primary email address
  name: string,                 // Display name (first + last name)
  avatarUrl?: string,           // Profile picture URL
  organizationRoles: {},        // Map of org IDs to roles (initially empty)
  status: "active",             // User status
  preferences: {
    theme: "system",
    language: "en",
    timezone: "UTC"
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Event Handling

### user.created
- Creates new user document in Firestore
- Sets initial preferences and status
- Uses Clerk ID as document ID for easy lookups

### user.updated
- Updates existing user document
- Syncs changes to email, name, avatar
- Creates document if it doesn't exist (handles edge cases)

### user.deleted
- Deletes user document from Firestore
- Logs warnings but doesn't fail if user doesn't exist
- Clean deletion without throwing errors

## Security

### Webhook Signature Verification
All webhooks are verified using Svix signature verification:
- Checks `svix-id`, `svix-timestamp`, and `svix-signature` headers
- Rejects requests with invalid signatures
- Prevents replay attacks

### Access Control
- Function is public but protected by signature verification
- Only Clerk can successfully call this endpoint
- Webhook secret stored securely in Firebase Secrets Manager

## Troubleshooting

### Webhook Failing with 400 Error

**Check 1: Missing Headers**
```
Error: Missing Svix headers
```
Solution: Ensure Clerk is sending the webhook with proper headers

**Check 2: Invalid Signature**
```
Error: Invalid webhook signature
```
Solutions:
- Verify the webhook secret matches Clerk dashboard
- Update secret: `firebase functions:secrets:set CLERK_WEBHOOK_SECRET`
- Redeploy function after changing secret

**Check 3: Secret Not Set**
```
Error: Clerk webhook secret not found
```
Solution: Set the secret using step 2 above

### User Not Created in Firestore

**Check Function Logs**
```bash
firebase functions:log --only onClerkWebhookEvent
```

**Common Issues:**
1. **Missing email**: Clerk user must have at least one email address
2. **Permission error**: Check Firestore rules allow function to write to `users` collection
3. **Repository error**: Ensure UserRepository is properly configured

### Testing Locally

Use Firebase emulators for local testing:

```bash
# Start emulators
cd functions
npm run serve

# In another terminal, send test webhook
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/onClerkWebhookEvent \
  -H "Content-Type: application/json" \
  -H "svix-id: test-id" \
  -H "svix-timestamp: 1234567890" \
  -H "svix-signature: test-sig" \
  -d '{"type":"user.created","data":{"id":"test_user","email_addresses":[{"email_address":"test@example.com"}],"first_name":"Test","last_name":"User"}}'
```

Note: Local testing won't verify signatures unless you mock the Svix verification.

## Monitoring

### View Function Execution
```bash
# Real-time logs
firebase functions:log --only onClerkWebhookEvent

# Recent errors
firebase functions:log --only onClerkWebhookEvent --only-errors
```

### Metrics in Firebase Console
1. Go to Firebase Console → Functions
2. Click on `onClerkWebhookEvent`
3. View:
   - Invocations per minute
   - Execution time
   - Error rate
   - Memory usage

### Clerk Dashboard Monitoring
1. Go to Webhooks in Clerk Dashboard
2. Click on your endpoint
3. View:
   - Recent attempts
   - Success/failure rate
   - Response times
   - Retry history

## Cost Considerations

- **Function invocations**: Free tier includes 2M invocations/month
- **Typical usage**: 3 webhooks per user (created, maybe updated, eventually deleted)
- **Estimate**: Can support ~650K user signups/month on free tier

## Integration with Onboarding

The webhook system integrates seamlessly with the onboarding flow:

1. User signs up with Clerk → `user.created` webhook fires
2. User document created in Firestore
3. User navigates to app → Onboarding checks for organizations
4. If no organizations exist → Show onboarding flow
5. User creates organization → Set as owner in organizationRoles

The onboarding hook (`useOnboardingStatus`) will automatically detect:
- Users who exist in Firestore (from webhook) but have no organizations
- Users who don't exist yet (edge case where they access app before webhook completes)

## Best Practices

1. **Idempotency**: All handlers are idempotent - safe to retry
2. **Error Handling**: Failures are logged but don't crash the function
3. **Validation**: Always validate Clerk data before storing
4. **Monitoring**: Set up alerts for failed webhooks in Clerk dashboard
5. **Testing**: Test webhook after any Firestore structure changes

## Future Enhancements

Potential improvements:
- [ ] Handle `user.updated` event to sync profile changes
- [ ] Add organization membership sync from Clerk organizations
- [ ] Implement webhook retry queue for failures
- [ ] Add analytics events for user lifecycle
- [ ] Send welcome email on user creation
- [ ] Implement soft delete instead of hard delete

## Related Documentation

- [Clerk Webhooks Documentation](https://clerk.com/docs/integrations/webhooks)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)
- [Onboarding Flow](./ONBOARDING_FLOW.md)


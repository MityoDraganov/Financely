# Google Cloud Secret Manager Setup for Email Service

This guide explains how to set up Google Cloud Secret Manager for securely storing and accessing email service credentials in Firebase Functions.

## 🔐 Setting Up Secrets

### 1. Enable Secret Manager API

```bash
# Enable the Secret Manager API
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Secrets

```bash
# Create Resend API Key secret
gcloud secrets create RESEND_API_KEY --data-file=- <<< "re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY"

# Create Resend From Email secret
gcloud secrets create RESEND_FROM_EMAIL --data-file=- <<< "noreply@financely.app"

# Create Resend From Name secret
gcloud secrets create RESEND_FROM_NAME --data-file=- <<< "Financely"
```

### 3. Grant Access Permissions

```bash
# Get your project ID
PROJECT_ID=$(gcloud config get-value project)

# Grant Secret Manager Secret Accessor role to Firebase Functions service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## 📝 Firebase Functions Integration

### 1. Define Secrets in Functions

```typescript
// functions/src/functions/send-email.ts
import { defineSecret } from "firebase-functions/params";

// Define secrets
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

export const sendEmail = onCall<SendEmailPayload>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName], // Include secrets
  },
  async (request) => {
    // Access secrets using .value()
    const emailService = new ResendEmailService({
      apiKey: resendApiKey.value(),
      defaultFromEmail: resendFromEmail.value(),
      defaultFromName: resendFromName.value(),
    });
    
    // ... rest of function logic
  }
);
```

### 2. Update Existing Functions

If you have existing functions that need email capabilities, update them to include the secrets:

```typescript
// Example: Update existing invite email function
export const sendInviteEmail = onCall<SendInviteEmailPayload>(
  { 
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName], // Add secrets
  },
  async (request) => {
    // Use secrets in your email logic
    const emailService = new ResendEmailService({
      apiKey: resendApiKey.value(),
      defaultFromEmail: resendFromEmail.value(),
      defaultFromName: resendFromName.value(),
    });
    
    // ... rest of function logic
  }
);
```

## 🚀 Deployment

### 1. Deploy Functions with Secrets

```bash
# Deploy functions (secrets will be automatically included)
firebase deploy --only functions
```

### 2. Verify Secret Access

After deployment, you can verify that secrets are accessible:

```typescript
// Test function to verify secret access
export const testSecrets = onCall(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async () => {
    return {
      apiKeyLength: resendApiKey.value().length,
      fromEmail: resendFromEmail.value(),
      fromName: resendFromName.value(),
    };
  }
);
```

## 🔧 Usage Examples

### 1. Basic Email Function

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { ResendEmailService } from "../services/resend-email-service";

const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

export const sendWelcomeEmail = onCall<{
  email: string;
  name: string;
}>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async (request) => {
    const { email, name } = request.data;

    const emailService = new ResendEmailService({
      apiKey: resendApiKey.value(),
      defaultFromEmail: resendFromEmail.value(),
      defaultFromName: resendFromName.value(),
    });

    const result = await emailService.sendEmail({
      to: { email, name },
      from: { email: resendFromEmail.value(), name: resendFromName.value() },
      subject: `Welcome to Financely, ${name}!`,
      html: `
        <h1>Welcome ${name}!</h1>
        <p>Thank you for joining Financely.</p>
        <p>We're excited to have you on board!</p>
      `,
    });

    return {
      success: result.success,
      messageId: result.messageId,
    };
  }
);
```

### 2. Workflow Email Integration

```typescript
import { EmailExecutor } from "../executors/email-executor";

export const sendWorkflowEmail = onCall<{
  workflowData: Record<string, unknown>;
  emailConfig: {
    recipients: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
  };
}>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async (request) => {
    const { workflowData, emailConfig } = request.data;

    const emailExecutor = new EmailExecutor({
      resendApiKey: resendApiKey.value(),
      resendFromEmail: resendFromEmail.value(),
      resendFromName: resendFromName.value(),
    });

    const mockAction = {
      id: `workflow_email_${Date.now()}`,
      config: emailConfig,
    };

    const result = await emailExecutor.execute(
      mockAction, 
      workflowData, 
      `workflow_${Date.now()}`
    );

    return result;
  }
);
```

## 🛠️ Management Commands

### Update Secrets

```bash
# Update API key
echo "new_api_key_here" | gcloud secrets versions add RESEND_API_KEY --data-file=-

# Update from email
echo "new-email@financely.app" | gcloud secrets versions add RESEND_FROM_EMAIL --data-file=-

# Update from name
echo "New Financely" | gcloud secrets versions add RESEND_FROM_NAME --data-file=-
```

### List Secrets

```bash
# List all secrets
gcloud secrets list

# Get secret value (for testing)
gcloud secrets versions access latest --secret="RESEND_API_KEY"
```

### Delete Secrets

```bash
# Delete a secret (be careful!)
gcloud secrets delete RESEND_API_KEY
```

## 🔒 Security Best Practices

### 1. Principle of Least Privilege

Only grant the minimum required permissions:

```bash
# Grant only Secret Accessor role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 2. Secret Rotation

Regularly rotate your API keys:

```bash
# Create new version of secret
echo "new_api_key" | gcloud secrets versions add RESEND_API_KEY --data-file=-

# Deploy functions to pick up new secret
firebase deploy --only functions
```

### 3. Audit Logging

Monitor secret access:

```bash
# View secret access logs
gcloud logging read "resource.type=secretmanager.googleapis.com/Secret"
```

## 🧪 Testing

### 1. Local Testing

For local development, you can still use environment variables:

```bash
# .env.local
RESEND_API_KEY=re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY
RESEND_FROM_EMAIL=noreply@financely.app
RESEND_FROM_NAME=Financely
```

### 2. Emulator Testing

The Firebase Functions emulator will use local environment variables when secrets are not available.

## 📊 Monitoring

### 1. Secret Access Monitoring

Monitor secret access in Google Cloud Console:
- Go to IAM & Admin > Audit Logs
- Filter by "Secret Manager API"

### 2. Function Logs

Monitor email sending in Firebase Functions logs:

```bash
# View function logs
firebase functions:log --only sendEmail
```

## 🚨 Troubleshooting

### Common Issues

1. **Secret Not Found**
   ```
   Error: Secret RESEND_API_KEY not found
   ```
   **Solution**: Ensure the secret exists and the service account has access.

2. **Permission Denied**
   ```
   Error: Permission denied accessing secret
   ```
   **Solution**: Grant `roles/secretmanager.secretAccessor` to the service account.

3. **Function Deployment Fails**
   ```
   Error: Secret not accessible during deployment
   ```
   **Solution**: Ensure secrets are properly defined in the function configuration.

### Debug Commands

```bash
# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:$PROJECT_ID@appspot.gserviceaccount.com"

# Test secret access
gcloud secrets versions access latest --secret="RESEND_API_KEY"
```

## 📚 Additional Resources

- [Google Cloud Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Firebase Functions Secrets Documentation](https://firebase.google.com/docs/functions/config-env)
- [Resend API Documentation](https://resend.com/docs)

## ✅ Checklist

- [ ] Secret Manager API enabled
- [ ] Secrets created (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`)
- [ ] Service account has `secretmanager.secretAccessor` role
- [ ] Functions updated to use `defineSecret`
- [ ] Functions deployed with secrets configuration
- [ ] Email service tested with secrets
- [ ] Monitoring and logging configured

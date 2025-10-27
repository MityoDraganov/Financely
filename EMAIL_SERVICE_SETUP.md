# Email Service Configuration

This document explains how to configure the email service for the Financely application.

## Environment Variables

### Required Variables

```bash
# Email Provider (resend, sendgrid, ses, mock)
EMAIL_PROVIDER=resend

# Resend Configuration
RESEND_API_KEY=re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY
RESEND_FROM_EMAIL=noreply@financely.app
RESEND_FROM_NAME=Financely
```

### Optional Variables

```bash
# SendGrid Configuration (if using SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@financely.app
SENDGRID_FROM_NAME=Financely

# AWS SES Configuration (if using SES)
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SES_FROM_EMAIL=noreply@financely.app
AWS_SES_FROM_NAME=Financely
```

## Setup Instructions

### 1. Resend Setup (Recommended)

1. Sign up for a Resend account at [resend.com](https://resend.com)
2. Create an API key in your Resend dashboard
3. Add the API key to your environment variables
4. Verify your domain in Resend (optional but recommended)

### 2. Environment File Setup

Create a `.env.local` file in your app directory:

```bash
# .env.local
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY
RESEND_FROM_EMAIL=noreply@financely.app
RESEND_FROM_NAME=Financely
```

### 3. Firebase Functions Environment

For Firebase Functions, set the environment variables:

```bash
firebase functions:config:set email.provider="resend"
firebase functions:config:set email.resend.api_key="re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY"
firebase functions:config:set email.resend.from_email="noreply@financely.app"
firebase functions:config:set email.resend.from_name="Financely"
```

## Usage Examples

### Basic Email Sending

```typescript
import { sendEmail } from '@/services/email';

const result = await sendEmail({
  to: { email: 'user@example.com', name: 'John Doe' },
  from: { email: 'noreply@financely.app', name: 'Financely' },
  subject: 'Welcome to Financely!',
  html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
  text: 'Welcome! Thank you for joining us.',
});
```

### Template Email

```typescript
import { sendWelcomeEmail } from '@/services/email';

const result = await sendWelcomeEmail(
  { email: 'user@example.com', name: 'John Doe' },
  {
    name: 'John Doe',
    appName: 'Financely',
    dashboardUrl: 'https://app.financely.com/dashboard',
    supportEmail: 'support@financely.com',
  }
);
```

### Batch Email Sending

```typescript
import { unifiedEmailService } from '@/services/email';

const emails = [
  {
    to: { email: 'user1@example.com' },
    subject: 'Newsletter',
    html: '<p>Newsletter content</p>',
  },
  {
    to: { email: 'user2@example.com' },
    subject: 'Newsletter',
    html: '<p>Newsletter content</p>',
  },
];

const results = await unifiedEmailService.sendBatchEmails(emails);
```

## Error Handling

The email service includes comprehensive error handling:

- **Validation Errors**: Invalid email addresses, missing required fields
- **Template Errors**: Missing templates, invalid template data
- **Service Errors**: API failures, network issues
- **Retry Logic**: Automatic retries with exponential backoff

## Monitoring and Logging

All email operations are logged with:
- Email IDs and message IDs
- Recipient information (without sensitive data)
- Success/failure status
- Error details for debugging

## Security Considerations

1. **API Keys**: Store API keys securely in environment variables
2. **Email Validation**: All email addresses are validated before sending
3. **Rate Limiting**: Built-in rate limiting to prevent abuse
4. **Content Sanitization**: HTML content is sanitized to prevent XSS

## Testing

For testing, you can use the mock provider:

```bash
EMAIL_PROVIDER=mock
```

This will simulate email sending without actually sending emails.


# Email Service for Firebase Functions

A simplified, reusable email service implementation for Firebase Functions using Resend.

## Features

- ✅ **Resend Integration** - Uses Resend API for reliable email delivery
- ✅ **Environment Configuration** - Configurable via environment variables
- ✅ **Error Handling** - Comprehensive error handling and logging
- ✅ **Type Safety** - Full TypeScript support
- ✅ **Template Support** - Simple template variable substitution
- ✅ **Validation** - Email address validation
- ✅ **Logging** - Integrated with Firebase Functions logger

## Setup

### 1. Environment Variables

Set the following environment variables in your Firebase Functions:

```bash
# Required
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY

# Optional
RESEND_FROM_EMAIL=noreply@financely.app
RESEND_FROM_NAME=Financely
```

### 2. Firebase Functions Configuration

```bash
firebase functions:config:set email.provider="resend"
firebase functions:config:set email.resend.api_key="re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY"
firebase functions:config:set email.resend.from_email="noreply@financely.app"
firebase functions:config:set email.resend.from_name="Financely"
```

## Usage

### Basic Email Sending

```typescript
import { ResendEmailService } from './services/resend-email-service';
import { getEmailConfig } from './services/email-config';

export const sendWelcomeEmail = functions.https.onCall(async (data, context) => {
  const emailConfig = getEmailConfig();
  const emailService = new ResendEmailService({
    apiKey: emailConfig.resend!.apiKey,
    defaultFromEmail: emailConfig.resend!.defaultFromEmail,
    defaultFromName: emailConfig.resend!.defaultFromName,
  });

  const result = await emailService.sendEmail({
    to: { email: data.email, name: data.name },
    from: { email: emailConfig.resend!.defaultFromEmail, name: emailConfig.resend!.defaultFromName },
    subject: 'Welcome to Financely!',
    html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
  });

  return result;
});
```

### Workflow Integration

The email service is already integrated with the workflow system:

```typescript
// In workflow executor
export class EmailExecutor implements ActionExecutor {
  type = "send_email";
  
  async execute(action: any, context: Record<string, unknown>, runId: string) {
    // Email sending logic is handled automatically
    // The executor uses the ResendEmailService internally
  }
}
```

### Template Email

```typescript
export const sendInvoiceEmail = functions.https.onCall(async (data, context) => {
  const emailConfig = getEmailConfig();
  const emailService = new ResendEmailService({
    apiKey: emailConfig.resend!.apiKey,
    defaultFromEmail: emailConfig.resend!.defaultFromEmail,
    defaultFromName: emailConfig.resend!.defaultFromName,
  });

  const subject = `Invoice #${data.invoiceNumber}`;
  const html = `
    <h1>Invoice #${data.invoiceNumber}</h1>
    <p>Hello ${data.customerName},</p>
    <p>Your invoice amount is ${data.amount}.</p>
    <p>Due date: ${data.dueDate}</p>
    <a href="${data.invoiceUrl}">View Invoice</a>
  `;

  const result = await emailService.sendEmail({
    to: { email: data.customerEmail, name: data.customerName },
    from: { email: emailConfig.resend!.defaultFromEmail, name: emailConfig.resend!.defaultFromName },
    subject,
    html,
  });

  return result;
});
```

## API Reference

### ResendEmailService

#### Constructor

```typescript
new ResendEmailService({
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
})
```

#### Methods

##### `sendEmail(options: EmailSendOptions): Promise<EmailSendResult>`

Send a single email.

```typescript
const result = await emailService.sendEmail({
  to: { email: 'user@example.com', name: 'John Doe' },
  from: { email: 'noreply@financely.app', name: 'Financely' },
  subject: 'Welcome!',
  html: '<h1>Welcome!</h1>',
  text: 'Welcome!',
  cc: [{ email: 'cc@example.com' }],
  bcc: [{ email: 'bcc@example.com' }],
  replyTo: { email: 'support@financely.app' },
  attachments: [{
    filename: 'document.pdf',
    content: 'base64-content',
    contentType: 'application/pdf',
  }],
});
```

##### `validateEmail(email: string): boolean`

Validate email address format.

```typescript
const isValid = emailService.validateEmail('user@example.com'); // true
```

##### `getStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }>`

Check service health.

```typescript
const status = await emailService.getStatus();
if (status.status === 'healthy') {
  console.log('Email service is working');
}
```

### Types

#### EmailSendOptions

```typescript
interface EmailSendOptions {
  to: EmailRecipient | EmailRecipient[];
  from: EmailRecipient;
  subject: string;
  html?: string;
  text?: string;
  cc?: EmailRecipient | EmailRecipient[];
  bcc?: EmailRecipient | EmailRecipient[];
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}
```

#### EmailRecipient

```typescript
interface EmailRecipient {
  email: string;
  name?: string;
}
```

#### EmailSendResult

```typescript
interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: unknown;
}
```

## Error Handling

The service provides comprehensive error handling:

```typescript
try {
  const result = await emailService.sendEmail(options);
  if (result.success) {
    logger.info('Email sent successfully', { messageId: result.messageId });
  } else {
    logger.error('Email failed', { error: result.error });
  }
} catch (error) {
  logger.error('Unexpected error', { error: error instanceof Error ? error.message : 'Unknown error' });
}
```

### Error Types

- **`EmailValidationError`**: Invalid email addresses or missing required fields
- **`EmailServiceError`**: General service errors

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `EMAIL_PROVIDER` | Email provider to use | Yes | `resend` |
| `RESEND_API_KEY` | Resend API key | Yes | - |
| `RESEND_FROM_EMAIL` | Default sender email | No | `noreply@financely.app` |
| `RESEND_FROM_NAME` | Default sender name | No | `Financely` |

### Firebase Functions Config

```bash
# Set configuration
firebase functions:config:set email.provider="resend"
firebase functions:config:set email.resend.api_key="your_api_key"
firebase functions:config:set email.resend.from_email="noreply@yourdomain.com"
firebase functions:config:set email.resend.from_name="Your App Name"

# Get configuration
firebase functions:config:get

# Deploy with configuration
firebase deploy --only functions
```

## Examples

See `email-examples.ts` for comprehensive usage examples including:

- Basic email sending
- Template email with variables
- Invoice notification emails
- Workflow notification emails
- Email with attachments
- Service health checks

## Testing

### Mock Provider

For testing, you can use the mock provider:

```bash
EMAIL_PROVIDER=mock
```

This will simulate email sending without actually sending emails.

### Unit Tests

```typescript
import { ResendEmailService } from './services/resend-email-service';

describe('ResendEmailService', () => {
  let emailService: ResendEmailService;

  beforeEach(() => {
    emailService = new ResendEmailService({
      apiKey: 'test-api-key',
      defaultFromEmail: 'test@example.com',
      defaultFromName: 'Test App',
    });
  });

  it('should send email successfully', async () => {
    const result = await emailService.sendEmail({
      to: { email: 'user@example.com' },
      from: { email: 'test@example.com', name: 'Test App' },
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});
```

## Best Practices

1. **Always validate email addresses** before sending
2. **Use environment variables** for configuration
3. **Handle errors gracefully** and log appropriately
4. **Test with mock provider** in development
5. **Monitor service health** regularly
6. **Use proper logging** for debugging
7. **Sanitize user input** to prevent issues
8. **Use retry logic** for critical emails

## Troubleshooting

### Common Issues

1. **Invalid API Key**: Check your Resend API key in environment variables
2. **Domain Verification**: Ensure your sending domain is verified in Resend
3. **Rate Limiting**: Implement proper rate limiting for bulk emails
4. **Template Errors**: Verify template variables match the data provided
5. **Attachment Issues**: Ensure attachments are properly base64 encoded

### Debug Logging

Enable debug logging by setting:

```bash
DEBUG=email-service
```

This will provide detailed logs of email operations.

## Integration with Workflow System

The email service is automatically integrated with the workflow system through the `EmailExecutor` class. When a workflow step has the type `"send_email"`, it will use this service to send emails.

### Workflow Configuration

```json
{
  "type": "send_email",
  "config": {
    "recipients": ["user@example.com"],
    "subject": "Welcome {{name}}!",
    "body": "Hello {{name}}, welcome to {{appName}}!",
    "isHtml": true,
    "cc": ["admin@example.com"],
    "replyTo": "support@example.com"
  }
}
```

The executor will automatically:
- Resolve template variables from workflow context
- Validate email addresses
- Send the email using Resend
- Log the result
- Return success/failure status

## License

This email service is part of the Financely application and follows the same license terms.

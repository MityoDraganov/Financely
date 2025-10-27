# Email Service

A comprehensive, reusable email service for the Financely application using Resend as the primary email provider.

## Features

- ✅ **Multiple Provider Support**: Resend, SendGrid, AWS SES, and Mock providers
- ✅ **Template System**: Built-in email templates with variable substitution
- ✅ **Batch Sending**: Send multiple emails efficiently
- ✅ **Error Handling**: Comprehensive error handling with retry logic
- ✅ **Type Safety**: Full TypeScript support with strict typing
- ✅ **Validation**: Email address validation and input sanitization
- ✅ **Attachments**: Support for file attachments
- ✅ **CC/BCC**: Support for carbon copy and blind carbon copy
- ✅ **Reply-To**: Custom reply-to addresses
- ✅ **Headers**: Custom email headers
- ✅ **Tags**: Email categorization and tracking
- ✅ **Health Checks**: Service status monitoring

## Quick Start

### 1. Installation

```bash
npm install resend
```

### 2. Environment Setup

```bash
# .env.local
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_ZCRzkrBq_MtQZdv9VErJNnMVPLKxZFBLY
RESEND_FROM_EMAIL=noreply@financely.app
RESEND_FROM_NAME=Financely
```

### 3. Basic Usage

```typescript
import { sendEmail } from '@/services/email';

const result = await sendEmail({
  to: { email: 'user@example.com', name: 'John Doe' },
  from: { email: 'noreply@financely.app', name: 'Financely' },
  subject: 'Welcome!',
  html: '<h1>Welcome to Financely!</h1>',
});
```

## Architecture

### Core Components

1. **Email Service Interface** (`/core/ports/services/email-service.ts`)
   - Defines the contract for all email operations
   - Provides type definitions and error classes

2. **Resend Implementation** (`/services/email/resend-email-service.ts`)
   - Implements the email service using Resend API
   - Handles retry logic and error management

3. **Template Service** (`/services/email/email-template-service.ts`)
   - Manages email templates
   - Handles template rendering with variable substitution

4. **Service Factory** (`/services/email/email-service-factory.ts`)
   - Creates and configures email services
   - Handles environment-based configuration

5. **Unified Service** (`/services/email/unified-email-service.ts`)
   - Provides a single interface for all email operations
   - Includes convenience methods for common use cases

## API Reference

### Core Methods

#### `sendEmail(options: EmailSendOptions): Promise<EmailSendResult>`

Send a single email with full customization options.

```typescript
const result = await sendEmail({
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
  tags: { category: 'welcome', source: 'signup' },
});
```

#### `sendTemplateEmail(templateId, to, templateData, options?): Promise<EmailSendResult>`

Send email using a predefined template.

```typescript
const result = await sendTemplateEmail(
  'welcome',
  { email: 'user@example.com', name: 'John Doe' },
  {
    name: 'John Doe',
    appName: 'Financely',
    dashboardUrl: 'https://app.financely.com/dashboard',
  }
);
```

#### `sendBatchEmails(emails: EmailSendOptions[]): Promise<EmailSendResult[]>`

Send multiple emails efficiently.

```typescript
const results = await sendBatchEmails([
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
]);
```

### Convenience Methods

#### `sendWelcomeEmail(to, data): Promise<EmailSendResult>`

Send a welcome email using the built-in template.

```typescript
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

#### `sendInviteEmail(to, data): Promise<EmailSendResult>`

Send an organization invite email.

```typescript
const result = await sendInviteEmail(
  { email: 'colleague@example.com', name: 'Jane Smith' },
  {
    inviterName: 'John Manager',
    organizationName: 'Acme Corp',
    appName: 'Financely',
    role: 'Member',
    inviteLink: 'https://app.financely.com/invite/abc123',
    expirationDate: '2024-01-15',
  }
);
```

#### `sendInvoiceCreatedEmail(to, data): Promise<EmailSendResult>`

Send an invoice created notification.

```typescript
const result = await sendInvoiceCreatedEmail(
  { email: 'client@example.com', name: 'Client Name' },
  {
    invoiceNumber: 'INV-2024-001',
    companyName: 'Financely Inc',
    customerName: 'Client Name',
    amount: '$1,250.00',
    dueDate: '2024-02-15',
    description: 'Monthly subscription service',
    invoiceUrl: 'https://app.financely.com/invoices/INV-2024-001',
    supportEmail: 'support@financely.com',
  }
);
```

#### `sendWorkflowNotificationEmail(to, data): Promise<EmailSendResult>`

Send a workflow execution notification.

```typescript
const result = await sendWorkflowNotificationEmail(
  { email: 'admin@example.com', name: 'Admin User' },
  {
    workflowName: 'Invoice Processing',
    status: 'Completed',
    statusColor: '#27ae60',
    executedAt: '2024-01-10 14:30:00',
    duration: '2.5 seconds',
    message: 'Invoice processed successfully',
    workflowUrl: 'https://app.financely.com/workflows/123',
  }
);
```

### Utility Methods

#### `validateEmail(email: string): boolean`

Validate email address format.

```typescript
const isValid = validateEmail('user@example.com'); // true
const isInvalid = validateEmail('invalid-email'); // false
```

#### `getEmailServiceStatus(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }>`

Check email service health.

```typescript
const status = await getEmailServiceStatus();
if (status.status === 'healthy') {
  console.log('Email service is working');
} else {
  console.error('Email service issue:', status.details);
}
```

## Built-in Templates

The service includes several built-in templates:

- **`welcome`**: Welcome email for new users
- **`invite`**: Organization invitation email
- **`invoice_created`**: Invoice creation notification
- **`invoice_paid`**: Invoice payment confirmation
- **`invoice_overdue`**: Overdue invoice reminder
- **`password_reset`**: Password reset email
- **`workflow_notification`**: Workflow execution notification

## Error Handling

The service provides comprehensive error handling:

```typescript
try {
  const result = await sendEmail(options);
  if (result.success) {
    console.log('Email sent:', result.messageId);
  } else {
    console.error('Email failed:', result.error);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

### Error Types

- **`EmailValidationError`**: Invalid email addresses or missing required fields
- **`EmailTemplateError`**: Template-related errors
- **`EmailServiceError`**: General service errors

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `EMAIL_PROVIDER` | Email provider to use | Yes | `resend` |
| `RESEND_API_KEY` | Resend API key | Yes* | - |
| `RESEND_FROM_EMAIL` | Default sender email | No | `noreply@financely.app` |
| `RESEND_FROM_NAME` | Default sender name | No | `Financely` |

*Required when using Resend provider

### Provider Configuration

#### Resend
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Your App Name
```

#### SendGrid (Future)
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Your App Name
```

#### AWS SES (Future)
```bash
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_FROM_NAME=Your App Name
```

## Testing

### Mock Provider

For testing, use the mock provider:

```bash
EMAIL_PROVIDER=mock
```

This will simulate email sending without actually sending emails.

### Unit Tests

```typescript
import { EmailServiceFactory } from '@/services/email/email-service-factory';

// Reset singleton for testing
EmailServiceFactory.reset();

// Create mock service
const mockService = EmailServiceFactory.createEmailService({
  provider: 'mock',
  mock: {
    defaultFromEmail: 'test@example.com',
    defaultFromName: 'Test App',
  },
});
```

## Integration Examples

### Workflow Integration

```typescript
// In workflow executor
import { unifiedEmailService } from '@/services/email';

export class EmailExecutor implements ActionExecutor {
  async execute(action: any, context: Record<string, unknown>) {
    const result = await unifiedEmailService.sendEmail({
      to: { email: context.recipient as string },
      from: { email: 'noreply@financely.app', name: 'Financely' },
      subject: context.subject as string,
      html: context.html as string,
    });

    return {
      success: result.success,
      messageId: result.messageId,
    };
  }
}
```

### React Component Integration

```typescript
import { sendWelcomeEmail } from '@/services/email';

export function WelcomePage() {
  const handleSendWelcome = async (userEmail: string, userName: string) => {
    const result = await sendWelcomeEmail(
      { email: userEmail, name: userName },
      {
        name: userName,
        appName: 'Financely',
        dashboardUrl: '/dashboard',
        supportEmail: 'support@financely.com',
      }
    );

    if (result.success) {
      toast.success('Welcome email sent!');
    } else {
      toast.error('Failed to send welcome email');
    }
  };

  return (
    <button onClick={() => handleSendWelcome('user@example.com', 'John Doe')}>
      Send Welcome Email
    </button>
  );
}
```

## Best Practices

1. **Always validate email addresses** before sending
2. **Use templates** for consistent branding and content
3. **Handle errors gracefully** and provide user feedback
4. **Use batch sending** for multiple emails
5. **Monitor service health** regularly
6. **Store API keys securely** in environment variables
7. **Test with mock provider** in development
8. **Use retry logic** for critical emails
9. **Sanitize user input** to prevent XSS
10. **Log email operations** for debugging and monitoring

## Troubleshooting

### Common Issues

1. **Invalid API Key**: Check your Resend API key in environment variables
2. **Domain Verification**: Ensure your sending domain is verified in Resend
3. **Rate Limiting**: Implement proper rate limiting for bulk emails
4. **Template Errors**: Verify template variables match the data provided
5. **Attachment Issues**: Ensure attachments are properly base64 encoded

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=email-service
```

This will provide detailed logs of email operations.

## Contributing

When adding new features:

1. Update the core interface in `/core/ports/services/email-service.ts`
2. Implement the feature in the appropriate service class
3. Add tests for the new functionality
4. Update this documentation
5. Add examples in `/services/email/examples.ts`

## License

This email service is part of the Financely application and follows the same license terms.


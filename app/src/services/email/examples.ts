/**
 * Email Service Usage Examples
 * Demonstrates how to use the email service throughout the application
 */

import {
  unifiedEmailService,
  sendEmail,
  sendWelcomeEmail,
  sendInviteEmail,
  sendInvoiceCreatedEmail,
  sendWorkflowNotificationEmail,
  validateEmail,
  getEmailServiceStatus,
  EmailRecipient,
  EmailSendOptions,
} from '@/services/email';

// Example 1: Basic Email Sending
export async function sendBasicEmail() {
  const result = await sendEmail({
    to: { email: 'user@example.com', name: 'John Doe' },
    from: { email: 'noreply@financely.app', name: 'Financely' },
    subject: 'Welcome to Financely!',
    html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
    text: 'Welcome! Thank you for joining us.',
  });

  if (result.success) {
    console.log('Email sent successfully:', result.messageId);
  } else {
    console.error('Failed to send email:', result.error);
  }
}

// Example 2: Welcome Email with Template
export async function sendWelcomeEmailExample() {
  const recipient: EmailRecipient = { 
    email: 'newuser@example.com', 
    name: 'Jane Smith' 
  };

  const templateData = {
    name: 'Jane Smith',
    appName: 'Financely',
    dashboardUrl: 'https://app.financely.com/dashboard',
    supportEmail: 'support@financely.com',
  };

  const result = await sendWelcomeEmail(recipient, templateData);
  return result;
}

// Example 3: Organization Invite Email
export async function sendInviteEmailExample() {
  const recipients: EmailRecipient[] = [
    { email: 'colleague1@example.com', name: 'Alice Johnson' },
    { email: 'colleague2@example.com', name: 'Bob Wilson' },
  ];

  const inviteData = {
    inviterName: 'John Manager',
    organizationName: 'Acme Corp',
    appName: 'Financely',
    role: 'Member',
    inviteLink: 'https://app.financely.com/invite/abc123',
    expirationDate: '2024-01-15',
  };

  const result = await sendInviteEmail(recipients, inviteData);
  return result;
}

// Example 4: Invoice Created Email
export async function sendInvoiceCreatedEmailExample() {
  const recipient: EmailRecipient = { 
    email: 'client@example.com', 
    name: 'Client Name' 
  };

  const invoiceData = {
    invoiceNumber: 'INV-2024-001',
    companyName: 'Financely Inc',
    customerName: 'Client Name',
    amount: '$1,250.00',
    dueDate: '2024-02-15',
    description: 'Monthly subscription service',
    invoiceUrl: 'https://app.financely.com/invoices/INV-2024-001',
    supportEmail: 'support@financely.com',
  };

  const result = await sendInvoiceCreatedEmail(recipient, invoiceData);
  return result;
}

// Example 5: Workflow Notification Email
export async function sendWorkflowNotificationEmailExample() {
  const recipient: EmailRecipient = { 
    email: 'admin@example.com', 
    name: 'Admin User' 
  };

  const workflowData = {
    workflowName: 'Invoice Processing',
    status: 'Completed',
    statusColor: '#27ae60',
    executedAt: '2024-01-10 14:30:00',
    duration: '2.5 seconds',
    message: 'Invoice #INV-2024-001 has been processed successfully',
    workflowUrl: 'https://app.financely.com/workflows/123',
  };

  const result = await sendWorkflowNotificationEmail(recipient, workflowData);
  return result;
}

// Example 6: Batch Email Sending
export async function sendBatchEmailsExample() {
  const emails: EmailSendOptions[] = [
    {
      to: { email: 'user1@example.com' },
      subject: 'Monthly Newsletter',
      html: '<h1>January Newsletter</h1><p>Latest updates...</p>',
      from: { email: 'newsletter@financely.app', name: 'Financely Newsletter' },
    },
    {
      to: { email: 'user2@example.com' },
      subject: 'Monthly Newsletter',
      html: '<h1>January Newsletter</h1><p>Latest updates...</p>',
      from: { email: 'newsletter@financely.app', name: 'Financely Newsletter' },
    },
  ];

  const results = await unifiedEmailService.sendBatchEmails(emails);
  
  results.forEach((result, index) => {
    if (result.success) {
      console.log(`Email ${index + 1} sent successfully:`, result.messageId);
    } else {
      console.error(`Email ${index + 1} failed:`, result.error);
    }
  });

  return results;
}

// Example 7: Email with Attachments
export async function sendEmailWithAttachments() {
  const result = await sendEmail({
    to: { email: 'client@example.com', name: 'Client Name' },
    from: { email: 'noreply@financely.app', name: 'Financely' },
    subject: 'Invoice and Receipt',
    html: '<p>Please find attached your invoice and receipt.</p>',
    attachments: [
      {
        filename: 'invoice.pdf',
        content: 'base64-encoded-pdf-content',
        contentType: 'application/pdf',
      },
      {
        filename: 'receipt.pdf',
        content: 'base64-encoded-pdf-content',
        contentType: 'application/pdf',
      },
    ],
  });

  return result;
}

// Example 8: Email with CC and BCC
export async function sendEmailWithCCAndBCC() {
  const result = await sendEmail({
    to: { email: 'primary@example.com', name: 'Primary Recipient' },
    cc: [
      { email: 'cc1@example.com', name: 'CC Recipient 1' },
      { email: 'cc2@example.com', name: 'CC Recipient 2' },
    ],
    bcc: [{ email: 'bcc@example.com', name: 'BCC Recipient' }],
    from: { email: 'noreply@financely.app', name: 'Financely' },
    subject: 'Important Update',
    html: '<p>This is an important update for your team.</p>',
  });

  return result;
}

// Example 9: Custom Template Email
export async function sendCustomTemplateEmail() {
  const result = await unifiedEmailService.sendCustomTemplateEmail(
    'custom_template_id',
    { email: 'user@example.com', name: 'User Name' },
    {
      userName: 'User Name',
      customMessage: 'This is a custom message',
      actionUrl: 'https://app.financely.com/action',
    },
    {
      from: { email: 'custom@financely.app', name: 'Custom Sender' },
    }
  );

  return result;
}

// Example 10: Email Validation
export function validateEmailAddresses() {
  const emails = [
    'user@example.com',
    'invalid-email',
    'another@domain.co.uk',
    'not-an-email',
  ];

  emails.forEach(email => {
    const isValid = validateEmail(email);
    console.log(`${email}: ${isValid ? 'Valid' : 'Invalid'}`);
  });
}

// Example 11: Email Service Status Check
export async function checkEmailServiceStatus() {
  const status = await getEmailServiceStatus();
  
  if (status.status === 'healthy') {
    console.log('Email service is healthy');
  } else {
    console.error('Email service is unhealthy:', status.details);
  }

  return status;
}

// Example 12: Email with Retry Logic
export async function sendEmailWithRetry() {
  const emailOptions: EmailSendOptions = {
    to: { email: 'user@example.com' },
    from: { email: 'noreply@financely.app', name: 'Financely' },
    subject: 'Important Email',
    html: '<p>This email will be retried if it fails.</p>',
  };

  const result = await unifiedEmailService.sendEmailWithRetry(
    emailOptions,
    3, // max retries
    2000 // delay between retries (ms)
  );

  return result;
}

// Example 13: Template Management
export async function manageEmailTemplates() {
  // Get all templates
  const templates = await unifiedEmailService.getTemplates();
  console.log('Available templates:', templates.map(t => t.name));

  // Get specific template
  const welcomeTemplate = await unifiedEmailService.getTemplate('welcome');
  console.log('Welcome template:', welcomeTemplate);

  // Create new template
  const newTemplate = await unifiedEmailService.createTemplate({
    name: 'Custom Template',
    subject: 'Custom Subject: {{customVar}}',
    htmlContent: '<h1>Custom Content: {{customVar}}</h1>',
    textContent: 'Custom Content: {{customVar}}',
    variables: ['customVar'],
  });

  console.log('Created template:', newTemplate);

  return { templates, welcomeTemplate, newTemplate };
}

// Example 14: Error Handling
export async function handleEmailErrors() {
  try {
    // This will fail due to invalid email
    const result = await sendEmail({
      to: { email: 'invalid-email' },
      from: { email: 'noreply@financely.app', name: 'Financely' },
      subject: 'Test Email',
      html: '<p>Test content</p>',
    });

    if (!result.success) {
      console.error('Email failed:', result.error);
      // Handle the error appropriately
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    // Handle unexpected errors
  }
}

// Example 15: Integration with Workflow System
export async function sendWorkflowEmail(workflowContext: Record<string, unknown>) {
  const recipient = workflowContext.recipient as string;
  const subject = workflowContext.subject as string;
  const templateId = workflowContext.templateId as string;
  const templateData = workflowContext.templateData as Record<string, unknown>;

  if (templateId) {
    return await unifiedEmailService.sendCustomTemplateEmail(
      templateId,
      { email: recipient },
      templateData
    );
  } else {
    return await sendEmail({
      to: { email: recipient },
      from: { email: 'noreply@financely.app', name: 'Financely' },
      subject,
      html: workflowContext.html as string,
      text: workflowContext.text as string,
    });
  }
}


# Email Service Setup Guide

## Overview

The email service uses SendGrid to send professional, branded emails for invites and welcome messages.

## Setup Instructions

### 1. Create SendGrid Account

1. Go to [SendGrid](https://sendgrid.com) and create an account
2. Verify your account and complete the setup process
3. Go to Settings > API Keys
4. Create a new API key with "Full Access" permissions
5. Copy the API key (you'll need this for the environment variables)

### 2. Set Up Environment Variables

Set the following environment variables in Firebase Functions:

```bash
# Set SendGrid API key
firebase functions:secrets:set SENDGRID_API_KEY

# Set sender email (must be verified in SendGrid)
firebase functions:secrets:set SENDGRID_FROM_EMAIL

# Set sender name (optional)
firebase functions:secrets:set SENDGRID_FROM_NAME
```

### 3. Verify Your Sender Email

1. In SendGrid dashboard, go to Settings > Sender Authentication
2. Add and verify your sender email address
3. This email will be used as the "from" address for all emails

### 4. Deploy the Functions

```bash
cd functions
npm run build
firebase deploy --only functions:sendInviteEmail,sendWelcomeEmail
```

## Features

### Invite Emails
- Professional HTML templates with your branding
- Responsive design that works on all devices
- Clear call-to-action buttons
- Organization and role information
- 7-day expiration notice

### Welcome Emails
- Welcome message with organization details
- Feature overview and getting started guide
- Direct link to dashboard
- Professional styling matching your brand

## Email Templates

The service includes:
- **HTML templates** with modern styling
- **Plain text fallbacks** for all emails
- **Responsive design** for mobile devices
- **Brand colors** and styling
- **Professional typography**

## Testing

Test the email functions:

```bash
# Test invite email
curl -X POST https://your-region-your-project.cloudfunctions.net/sendInviteEmail \
  -H "Content-Type: application/json" \
  -d '{"data": {"inviteId": "invite123", "organizationId": "org456"}}'

# Test welcome email
curl -X POST https://your-region-your-project.cloudfunctions.net/sendWelcomeEmail \
  -H "Content-Type: application/json" \
  -d '{"data": {"userId": "user123", "organizationId": "org456"}}'
```

## Monitoring

- Check SendGrid dashboard for delivery statistics
- Monitor Firebase Functions logs for errors
- Set up alerts for failed email deliveries

## Cost Considerations

- SendGrid free tier: 100 emails/day
- Firebase Functions: Pay per invocation
- Typical usage: 2-3 emails per user (invite + welcome)
- Estimate: Can support ~30-50 new users/day on free tier

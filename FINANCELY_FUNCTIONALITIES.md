# Financely Application - Complete Functionality Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication & Onboarding](#authentication--onboarding)
3. [Organization Management](#organization-management)
4. [Template Designer System](#template-designer-system)
5. [Invoice Management](#invoice-management)
6. [Proposal System](#proposal-system)
7. [Lead Management](#lead-management)
8. [Product Catalog](#product-catalog)
9. [Contact Management](#contact-management)
10. [Workflow Automation](#workflow-automation)
11. [Site Builder & Widgets](#site-builder--widgets)
12. [Analytics & Reporting](#analytics--reporting)
13. [Team Collaboration](#team-collaboration)
14. [AI-Powered Features](#ai-powered-features)
15. [Complete Flow Chains](#complete-flow-chains)

---

## Overview

Financely is a comprehensive financial management platform that combines invoice generation, proposal creation, lead management, workflow automation, and website building capabilities. The application is built with React + TypeScript on the frontend and Firebase Functions (TypeScript) on the backend, using Clerk for authentication.

### Core Architecture
- **Frontend**: React + TypeScript with React Router, TanStack Query, and Clerk authentication
- **Backend**: Firebase Functions (TypeScript) with Firestore and Realtime Database
- **Authentication**: Clerk with organization-based multi-tenancy
- **Storage**: Firebase Storage for file uploads
- **AI Integration**: Gemini AI for proposal generation, invoice conversion, and content creation

---

## Authentication & Onboarding

### User Registration & Sign-In
**Flow:**
1. User visits landing page → clicks "Sign Up"
2. Clerk handles authentication → user account created
3. If first-time user without organization → redirected to onboarding flow
4. If existing user → redirected to dashboard

### Onboarding Flow
**Purpose**: Guide new users through creating their first workspace

**Steps:**
1. **Welcome Screen**
   - Personalized greeting with user's first name
   - Value propositions: Fast invoices, Security, Team collaboration
   - "Get Started" button

2. **Benefits Showcase**
   - Three main benefits:
     - Professional Invoices (drag-and-drop designer)
     - Smart Approvals (automated workflow routing)
     - Never Miss a Renewal (automated reminders)
   - Security trust badge
   - "Create Your Workspace" button

3. **Organization Creation**
   - Form fields:
     - Organization Name (required)
     - Description (optional)
     - Website (optional)
   - Backend actions:
     - Creates user in database (if first time)
     - Creates organization
     - Adds user as member with "owner" role

4. **Success Screen**
   - Success animation
   - Next steps guidance
   - Redirect to dashboard

**Flow Chain:**
```
New User → Sign Up → Onboarding → Organization Created → Dashboard
```

---

## Organization Management

### Organization Settings
**Features:**
- General settings (name, description, website)
- Branding customization (logo, colors, company name)
- Billing management
- AI settings configuration
- User management
- Invite system
- Audit logging

### Branding System
**Flow:**
1. User navigates to Settings → Organization → Branding
2. Uploads logo, sets brand colors (primary, secondary, accent)
3. Changes apply globally across:
   - Invoice templates
   - Site builder
   - Widgets
   - Email templates

**Flow Chain:**
```
Settings → Branding → Upload Assets → Save → Global Application
```

### User Invitations
**Flow:**
1. Owner/Admin navigates to Settings → Invites
2. Creates invite with email and role (owner, admin, member)
3. Invite email sent via Firebase Function
4. Recipient clicks invite link → Accept Invite page
5. User accepts → added to organization with specified role

**Flow Chain:**
```
Create Invite → Email Sent → User Clicks Link → Accept → Organization Member
```

### Audit Logging
**Purpose**: Track all changes to critical entities (products, deals, invoices)

**Flow:**
1. Firestore triggers automatically log document changes
2. Logs stored in `auditLogs` collection
3. Viewable in Settings → Security → Audit Log
4. Includes: user, action, timestamp, before/after values

---

## Template Designer System

### Template Creation & Design
**Purpose**: Create reusable invoice templates with dynamic data bindings

**Flow:**
1. Navigate to Templates → Design Template
2. Drag-and-drop designer interface:
   - Text elements (with bindings)
   - Table elements (for line items)
   - Input fields
   - Images
   - Shapes and layouts
3. Configure element bindings (e.g., `invoice.seller.name`, `invoice.items`)
4. Save template → stored in Realtime Database
5. Template versioning system tracks changes

### Template Bindings
**Concept**: Templates use dot-notation paths to reference invoice data

**Examples:**
- `seller.name` → References `data.seller.name` in invoice
- `items` → References `data.items` array for table rendering
- `invoiceNumber` → References `data.invoiceNumber`

### Template Usage Flow
```
Design Template → Configure Bindings → Save → Use in Invoice Creation
```

---

## Invoice Management

### Invoice Creation
**Flow:**
1. Navigate to Invoices → Create Invoice
2. Select template (determines data structure)
3. Fill in invoice data matching template bindings:
   - Seller information
   - Buyer information
   - Invoice details (number, dates)
   - Line items (table data)
   - Totals and calculations
4. Set status (draft, sent, paid, cancelled)
5. Save → Invoice created in Firestore

### Dynamic Invoice Structure
**Key Feature**: Invoice data structure adapts to template bindings

**Example Structure:**
```json
{
  "orgId": "org_123",
  "templateId": "template_456",
  "data": {
    "seller": { "name": "...", "address": "..." },
    "buyer": { "name": "...", "address": "..." },
    "invoiceNumber": "INV-001",
    "items": [
      { "description": "Item 1", "qty": 1, "unitPrice": 100 }
    ],
    "subtotal": 100,
    "total": 120
  },
  "status": "draft"
}
```

### Invoice PDF Generation
**Flow:**
1. User clicks "Generate PDF" on invoice
2. Firebase Function `renderInvoicePdf` called
3. Template rendered with invoice data
4. PDF generated and stored in Firebase Storage
5. PDF URL returned and stored in invoice document

**Flow Chain:**
```
Invoice → Generate PDF → Template Rendering → PDF Storage → URL Saved
```

### Invoice Email Sending
**Flow:**
1. User clicks "Send Invoice" on invoice
2. Firebase Function `sendInvoiceEmail` called
3. Email composed with invoice PDF attachment
4. Email sent via Resend service
5. Invoice status updated to "sent"

**Flow Chain:**
```
Invoice → Send Email → PDF Attachment → Email Service → Status Updated
```

### Invoice Share Links
**Flow:**
1. User generates share link for invoice
2. Firebase Function `generateInvoiceShareLink` creates secure link
3. Link can be shared externally
4. Recipients can view invoice without authentication

### Invoice Status Workflow
**Flow Chain:**
```
Draft → Sent → Paid/Cancelled
```

**Triggers:**
- Status change to "paid" → triggers workflow automation (if configured)
- Status change to "sent" → email notification sent

---

## Proposal System

### Proposal Creation
**Flow:**
1. Navigate to Proposals → Create Proposal
2. Fill in proposal details:
   - Title
   - Description
   - Items (with quantities, prices, taxes)
   - Terms and conditions
   - Notes
3. Link to lead (optional)
4. Set status (draft, sent, accepted, rejected)
5. Save → Proposal created

### AI Proposal Generation
**Flow:**
1. From Lead page → click "Generate Proposal"
2. Firebase Function `generateProposalSuggestion` called
3. AI analyzes:
   - Lead information
   - Organization products
   - Lead message/requirements
4. AI generates proposal with:
   - Suggested title
   - Recommended items
   - Pricing
   - Terms
5. Proposal created as draft
6. User can review and edit before sending

**Flow Chain:**
```
Lead → Generate Proposal → AI Analysis → Draft Proposal → Review → Send
```

### Auto-Proposal Suggestions
**Flow:**
1. Lead created (from widget or manual entry)
2. Firestore trigger `onLeadCreated` fires
3. Checks if auto-suggestions enabled in organization settings
4. If enabled:
   - Fetches organization products
   - Calls AI service to generate proposal
   - Creates proposal automatically
5. Proposal linked to lead

**Flow Chain:**
```
Lead Created → Trigger → Check Settings → AI Generation → Auto-Proposal Created
```

### Proposal to Invoice Conversion
**Flow:**
1. Proposal accepted by client
2. User navigates to Proposal → Convert to Invoice
3. Select invoice template
4. Firebase Function `convertProposalToInvoice` called
5. AI service converts proposal data to invoice format:
   - Maps proposal items to invoice line items
   - Extracts seller/buyer information
   - Generates invoice number
   - Applies compliance rules (region-based)
6. Invoice created with "draft" status
7. Proposal linked to invoice

**Flow Chain:**
```
Proposal Accepted → Convert → AI Conversion → Invoice Created → Link Established
```

### Proposal Status Workflow
**Flow Chain:**
```
Draft → Sent → Accepted/Rejected → (If Accepted) Convert to Invoice
```

---

## Lead Management

### Lead Creation Sources
**Three Sources:**
1. **Widget Submissions** (Contact Form, Invoice Request, Quote Request)
2. **Manual Entry** (from Leads page)
3. **Import** (bulk import functionality)

### Widget Lead Flow
**Flow:**
1. Visitor submits widget form on website
2. Firebase Function `submitWidgetForm` processes submission
3. Lead created in Firestore with:
   - Contact information
   - Form data
   - Widget type
   - Source: "widget"
4. If auto-proposals enabled → Proposal auto-generated
5. Lead appears in Leads page

**Flow Chain:**
```
Widget Submission → Function Processing → Lead Created → (Optional) Auto-Proposal
```

### Lead Status Management
**Statuses:**
- `new` → Just created
- `viewed` → User has opened lead
- `contacted` → User has reached out
- `converted` → Lead converted to customer
- `archived` → No longer active

**Flow Chain:**
```
New → Viewed → Contacted → Converted/Archived
```

### Lead to Contact Conversion
**Flow:**
1. User views lead
2. Clicks "Convert to Contact"
3. Contact created from lead data
4. Lead status updated to "converted"
5. Contact linked to lead

**Flow Chain:**
```
Lead → Convert to Contact → Contact Created → Lead Status Updated
```

### Lead to Proposal Flow
**Flow:**
1. User views lead
2. Clicks "Create Proposal"
3. Option 1: Manual proposal creation
4. Option 2: AI-generated proposal
5. Proposal linked to lead

**Flow Chain:**
```
Lead → Create Proposal → (Manual/AI) → Proposal Created → Linked
```

---

## Product Catalog

### Product Management
**Features:**
- Create, edit, delete products
- Product details:
  - Name, description, SKU
  - Price, currency
  - Category, tags
  - Images (with featured image)
  - Inventory tracking (optional)
  - Stock quantity, low stock threshold
  - Tax rate, cost
  - Status (active, inactive, archived)

### Product Creation Flow
**Flow:**
1. Navigate to Products → New Product
2. Fill in product details
3. Upload images (first image = featured)
4. Set inventory tracking (if applicable)
5. Save → Product created in Firestore

**Flow Chain:**
```
Create Product → Fill Details → Upload Images → Save → Product Available
```

### Product Usage in Proposals
**Flow:**
1. When generating AI proposals, system fetches organization products
2. AI uses product information to suggest relevant items
3. Products can be manually added to proposals
4. Product prices/descriptions auto-populate

**Flow Chain:**
```
Proposal Creation → Fetch Products → AI Suggestion / Manual Selection → Items Added
```

---

## Contact Management

### Contact Creation
**Flow:**
1. Navigate to Contacts → Add Contact
2. Fill in contact information:
   - Name, email, phone (multiple phones supported)
   - Company, job title
   - Address
   - Status (lead, prospect, customer, active, inactive)
   - Tags, notes
   - Preferences (contact method, marketing opt-in)
   - Social media links
3. Save → Contact created

**Features:**
- Email deduplication (updates existing if email matches)
- Multiple phone numbers per contact
- Search functionality
- Status management

### Contact to Lead Linking
**Flow:**
1. When lead created from widget, system checks for existing contact
2. If contact exists (by email), lead linked to contact
3. If no contact, new contact can be created from lead

**Flow Chain:**
```
Widget Submission → Check Contact → Link/Create → Lead Linked
```

---

## Workflow Automation

### Workflow System Overview
**Purpose**: Automate business processes with event-driven triggers and HTTP actions

### Workflow Creation
**Flow:**
1. Navigate to Workflows → Create Workflow
2. Define workflow:
   - Name, description
   - Steps (actions to execute)
   - Edges (connections between steps)
   - Triggers (when to run)
3. Configure steps:
   - HTTP Request (call external APIs)
   - Email (send notifications)
   - Conditional logic
4. Save → Workflow created

### Workflow Execution
**Triggers:**
1. **Invoice Created** (`invoice.created`)
   - Fires when new invoice created
   - Payload includes invoice data

2. **Invoice Paid** (`invoice.paid`)
   - Fires when invoice status changes to "paid"
   - Payload includes updated invoice data

3. **Manual Trigger**
   - HTTP endpoint for manual execution
   - Custom payload supported

4. **External Webhooks**
   - Custom webhook events
   - Tenant-scoped

### Workflow Steps
**HTTP Request Action:**
- Method (GET, POST, PUT, DELETE, PATCH)
- URL with template variables
- Headers with template variables
- Body with template variables
- Authentication (Bearer, Basic, None)

**Template Variables:**
- `{invoice.number}` → Invoice number
- `{customer.email}` → Customer email
- `{secret.api_key}` → Secret value

**Flow Chain:**
```
Event Triggered → Workflow Queued → Steps Executed → Results Stored
```

### Workflow Execution Flow
**Flow:**
1. Event occurs (e.g., invoice created)
2. Firestore trigger fires
3. Workflow execution engine:
   - Creates workflow run
   - Queues first step
   - Executes steps sequentially/parallel
   - Handles errors and retries
   - Updates run status
4. Results stored in `workflowRuns` collection

**Flow Chain:**
```
Event → Trigger → Workflow Engine → Step Execution → Results → Status Update
```

### Workflow Templates
**Purpose**: Pre-built workflow templates for common scenarios

**Examples:**
- Invoice notification workflow
- Payment reminder workflow
- Renewal automation workflow

---

## Site Builder & Widgets

### AI-Powered Site Generation
**Flow:**
1. Navigate to Site Builder
2. Select "AI Generation" tab
3. Provide context:
   - Company description
   - Brand information
   - Images (optional)
4. Click "Generate Site"
5. Firebase Function `generateSite` called
6. AI generates complete HTML website:
   - Responsive design
   - Brand colors applied
   - Content generated
   - Analytics integration (if configured)
7. Site deployed to Firebase Hosting
8. URL provided for access

**Flow Chain:**
```
Context Input → AI Generation → HTML Generated → Deployment → Live Site
```

### Manual Site Editor
**Flow:**
1. Navigate to Site Builder
2. Select "Manual Editor" tab
3. Edit HTML/CSS/JavaScript directly
4. Preview changes
5. Deploy → Site updated

**Flow Chain:**
```
Manual Edit → Preview → Deploy → Site Updated
```

### Widget System
**Three Widget Types:**

#### 1. Contact Form Widget
**Flow:**
1. Configure widget:
   - Title, description
   - Styling (colors, fonts, position)
   - Localization (text translations)
   - Built-in fields (name, email, phone, message)
   - Custom fields (user-defined)
   - Submit button text
   - Success message
2. Enable widget
3. Copy embed script
4. Paste script on website
5. Widget appears on site
6. Submissions create leads

**Flow Chain:**
```
Configure Widget → Enable → Copy Script → Embed → Submissions → Leads Created
```

#### 2. Invoice Request Widget
**Flow:**
1. Similar configuration to contact form
2. Widget collects invoice request information
3. Submissions create leads with `widgetType: "invoiceRequest"`
4. Can trigger auto-proposal generation

**Flow Chain:**
```
Widget Submission → Lead Created → (Optional) Auto-Proposal
```

#### 3. Quote Request Widget
**Flow:**
1. Similar configuration
2. Submissions create leads with `widgetType: "quoteRequest"`
3. Can trigger auto-proposal generation

### Widget Versioning
**Flow:**
1. Widget configurations saved as versions
2. Each save creates new version
3. Can preview previous versions
4. Can restore previous versions
5. Version history tracked

**Flow Chain:**
```
Save Widget → Version Created → History Tracked → Restore Available
```

### Widget AI Generation
**Flow:**
1. Click "Generate with AI" for widget
2. Select widget type and style
3. Provide context
4. AI generates widget configuration
5. Review and save

**Flow Chain:**
```
AI Generation → Style Selection → Context → Generated Config → Save
```

### Custom Domain
**Flow:**
1. Add custom domain in Site Builder
2. Firebase Function `addCustomDomain` processes request
3. DNS configuration instructions provided
4. Domain verified and linked to site

**Flow Chain:**
```
Add Domain → DNS Config → Verification → Domain Linked
```

---

## Analytics & Reporting

### Analytics Configuration
**Flow:**
1. Navigate to Analytics → Settings
2. Enable analytics
3. Select providers:
   - Google Analytics 4 (GA4)
   - Plausible Analytics
   - Umami Analytics
   - Microsoft Clarity
4. Configure provider-specific settings:
   - GA4 Measurement ID
   - Plausible Domain
   - Umami Script URL & Website ID
   - Clarity Project ID
5. Set consent default (denied/granted)
6. Customize consent banner (if denied)
7. Save → Analytics script updated on site

**Flow Chain:**
```
Configure Analytics → Select Providers → Save → Script Updated → Tracking Active
```

### Analytics Metrics
**Data Collected:**
- Page views
- Unique visitors
- Bounce rate
- Average session duration
- Top pages
- Traffic sources
- Devices
- Browsers
- Referrers
- Page views over time

**Flow:**
1. Analytics events stored in BigQuery (if enabled)
2. Firebase Function `getAnalyticsMetrics` queries data
3. Metrics displayed in Analytics dashboard
4. Date range filtering available

**Flow Chain:**
```
Events Tracked → BigQuery Storage → Query Function → Metrics Displayed
```

### Consent Banner
**Flow:**
1. If consent default = "denied"
2. Custom consent banner displayed on site
3. User can accept/deny tracking
4. Choice stored in browser
5. Analytics scripts load only if accepted

**Flow Chain:**
```
Site Load → Consent Banner → User Choice → Scripts Load (if accepted)
```

---

## Team Collaboration

### Organization Members
**Flow:**
1. Owner/Admin navigates to Settings → Users
2. View all organization members
3. See roles (owner, admin, member)
4. Remove members (if permitted)

**Roles:**
- **Owner**: Full access, can delete organization
- **Admin**: Manage users, settings, all content
- **Member**: Create/edit content, limited settings access

### Invite System
**Flow:**
1. Create invite (email + role)
2. Invite email sent
3. Recipient clicks link
4. Accept invite page
5. User added to organization

**Flow Chain:**
```
Create Invite → Email Sent → Accept → Member Added
```

### Presence System
**Purpose**: Show who's currently viewing/editing documents

**Flow:**
1. User opens document (invoice, proposal, etc.)
2. Presence system tracks active users
3. Other users see who's viewing
4. Real-time updates via Firestore listeners

---

## AI-Powered Features

### AI Service Architecture
**Provider**: Gemini AI (configurable)

**Features:**
- Proposal generation from leads
- Proposal to invoice conversion
- Site generation
- Widget generation
- Template generation
- Content suggestions

### AI Proposal Generation
**Flow:**
1. Lead data analyzed
2. Organization products fetched
3. AI prompt built with context
4. AI generates structured proposal:
   - Title
   - Description
   - Items (with pricing)
   - Terms
   - Notes
5. Proposal validated against products
6. Draft proposal created

**Flow Chain:**
```
Lead Data → AI Analysis → Context Building → AI Generation → Validation → Proposal
```

### AI Proposal to Invoice Conversion
**Flow:**
1. Proposal data analyzed
2. Invoice template bindings extracted
3. AI converts proposal structure to invoice format:
   - Maps items to invoice line items
   - Extracts seller/buyer information
   - Generates invoice number
   - Applies compliance rules
4. Invoice data validated
5. Invoice created

**Flow Chain:**
```
Proposal → AI Analysis → Template Mapping → Data Conversion → Validation → Invoice
```

### AI Site Generation
**Flow:**
1. Context provided (company info, images)
2. AI generates complete HTML website
3. Brand colors and styling applied
4. Analytics integration included
5. Site deployed

**Flow Chain:**
```
Context → AI Generation → HTML Output → Styling → Deployment
```

### AI Widget Generation
**Flow:**
1. Widget type and style selected
2. Context provided
3. AI generates widget configuration
4. Styling and localization included
5. Widget ready to use

**Flow Chain:**
```
Type/Style → Context → AI Generation → Config → Ready
```

---

## Complete Flow Chains

### End-to-End: Lead to Paid Invoice

**Complete Flow:**
```
1. Visitor submits widget form on website
   ↓
2. Lead created in Firestore
   ↓
3. (If enabled) Auto-proposal generated via AI
   ↓
4. User reviews proposal, sends to client
   ↓
5. Client accepts proposal
   ↓
6. User converts proposal to invoice
   ↓
7. AI converts proposal data to invoice format
   ↓
8. Invoice created with template
   ↓
9. User generates PDF
   ↓
10. User sends invoice email
    ↓
11. Client pays invoice
    ↓
12. Invoice status updated to "paid"
    ↓
13. (If configured) Workflow triggered on payment
    ↓
14. Workflow executes (e.g., send thank you email, update CRM)
```

### End-to-End: Site Creation to Lead Conversion

**Complete Flow:**
```
1. User creates organization
   ↓
2. User navigates to Site Builder
   ↓
3. User provides context, generates site with AI
   ↓
4. Site deployed to Firebase Hosting
   ↓
5. User configures widgets (contact form, quote request)
   ↓
6. User copies embed script, adds to site
   ↓
7. User configures analytics
   ↓
8. Site goes live
   ↓
9. Visitor browses site
   ↓
10. Visitor submits widget form
    ↓
11. Lead created
    ↓
12. (If enabled) Auto-proposal generated
    ↓
13. User notified of new lead
    ↓
14. User reviews lead, creates/approves proposal
    ↓
15. Proposal sent to client
    ↓
16. Client accepts
    ↓
17. Invoice created and sent
    ↓
18. Payment received
```

### End-to-End: Template to Invoice Workflow

**Complete Flow:**
```
1. User designs invoice template
   ↓
2. Template saved with bindings
   ↓
3. User creates invoice, selects template
   ↓
4. Invoice data filled matching template bindings
   ↓
5. Invoice saved
   ↓
6. User generates PDF (template rendered with data)
   ↓
7. PDF stored, URL saved to invoice
   ↓
8. User sends invoice email with PDF
   ↓
9. Invoice status updated to "sent"
    ↓
10. (If workflow configured) Workflow triggered
    ↓
11. Workflow sends notification to Slack/email
    ↓
12. Client views invoice via share link
    ↓
13. Client pays
    ↓
14. Invoice status updated to "paid"
    ↓
15. (If workflow configured) Payment workflow triggered
    ↓
16. Workflow executes (e.g., send receipt, update accounting)
```

### End-to-End: Product to Proposal Flow

**Complete Flow:**
```
1. User creates products in catalog
   ↓
2. Products saved with prices, descriptions, images
   ↓
3. Lead created (from widget or manual)
   ↓
4. User clicks "Generate Proposal" from lead
   ↓
5. AI service fetches organization products
   ↓
6. AI analyzes lead requirements
   ↓
7. AI matches lead needs to products
   ↓
8. AI generates proposal with product items
   ↓
9. Proposal created as draft
   ↓
10. User reviews, adjusts pricing/items
    ↓
11. User sends proposal to client
    ↓
12. Client accepts
    ↓
13. User converts proposal to invoice
    ↓
14. Invoice created with product information
```

---

## Key Integration Points

### Firebase Functions
**Critical Functions:**
- `createInvoice` - Invoice creation
- `renderInvoicePdf` - PDF generation
- `sendInvoiceEmail` - Email delivery
- `generateProposalSuggestion` - AI proposal generation
- `convertProposalToInvoice` - Proposal conversion
- `onLeadCreated` - Lead processing trigger
- `submitWidgetForm` - Widget submission handler
- `generateSite` - AI site generation
- `generateWidget` - AI widget generation
- `triggerWorkflow` - Workflow execution
- `getAnalyticsMetrics` - Analytics data retrieval

### Firestore Collections
**Main Collections:**
- `organizations` - Organization data
- `invoices` - Invoice documents
- `proposals` - Proposal documents
- `leads` - Lead records
- `contacts` - Contact records
- `products` - Product catalog
- `templates` - Invoice templates (Realtime Database)
- `workflows` - Workflow definitions
- `workflowRuns` - Workflow execution records
- `auditLogs` - Change tracking
- `brandSites` - Generated websites
- `analyticsConfig` - Analytics configuration

### Real-time Features
- Presence system (who's viewing documents)
- Real-time template updates
- Live workflow execution status
- Instant lead notifications

---

## Security & Compliance

### Multi-Tenancy
- All data scoped by `organizationId`
- Cross-tenant access prevention
- Role-based access control (RBAC)

### Audit Logging
- Automatic change tracking
- User action logging
- Before/after value capture
- Compliance-ready audit trail

### Invoice Compliance
- Region-based compliance rules
- Tax calculation
- Legal requirement validation
- GDPR-compliant data handling

---

## Summary

Financely provides a comprehensive financial management platform with:

1. **Invoice Management**: Dynamic templates, PDF generation, email delivery
2. **Proposal System**: AI-powered generation, conversion to invoices
3. **Lead Management**: Widget-based capture, auto-proposal generation
4. **Product Catalog**: Inventory tracking, AI integration
5. **Contact Management**: CRM functionality, lead linking
6. **Workflow Automation**: Event-driven processes, HTTP actions
7. **Site Builder**: AI-generated websites, widget integration
8. **Analytics**: Multi-provider support, consent management
9. **Team Collaboration**: Invites, roles, presence
10. **AI Features**: Content generation, data conversion, suggestions

All features are interconnected through a sophisticated flow system that automates business processes from lead capture to invoice payment.







# Workflow System Analysis & Improvements

## 1. Current State Analysis

### Existing Triggers
- **Invoice**: created, sent, paid, overdue
- **Proposal**: created, approved, rejected
- **Contract**: expiring, expired
- **User**: joined
- **System**: schedule.cron, webhook.external, manual.trigger

### Existing Actions
- **Communication**: send.email, send.slack, notify.user
- **Invoice**: create.invoice, update.invoice.status, generate.pdf
- **Task**: create.task, assign.task
- **Integration**: call.webhook, create.stripe.invoice
- **System**: wait.delay, archive.record, update.field

### Current UI/UX Issues
1. Form-based builder (not visual flow)
2. No drag-and-drop
3. Limited visual hierarchy
4. Basic card layout
5. No real-time flow visualization
6. Limited interactivity

---

## 2. Enhanced Triggers & Actions (Based on Existing Features)

### New Triggers (Minimal Development)
- `lead.created` - When a lead is created from widget/form
- `lead.converted` - When lead is converted to contact
- `lead.qualified` - When lead status changes to qualified
- `contact.created` - When a new contact is added
- `contact.updated` - When contact information changes
- `proposal.sent` - When proposal is sent to client
- `proposal.converted_to_invoice` - When proposal converts to invoice
- `product.low_stock` - When product stock falls below threshold
- `product.created` - When new product is added

### New Actions (Leveraging Existing Functions)
- `create.lead` - Create a new lead (uses existing lead creation)
- `create.contact` - Create a new contact (uses existing contact creation)
- `create.proposal` - Create proposal from template/data (uses existing proposal creation)
- `convert.lead_to_contact` - Convert lead to contact (uses existing conversion)
- `update.lead_status` - Update lead status (uses existing status update)
- `add.product_to_proposal` - Add product to proposal (uses existing product catalog)
- `send.proposal` - Send proposal email (uses existing email system)
- `create.invoice.from_proposal` - Convert proposal to invoice (uses existing conversion)

---

## 3. UI/UX Improvements

### Visual Flow Builder
- **Node-based visual editor** (like n8n/Zapier)
- **Drag-and-drop** for steps and actions
- **Connection lines** showing flow
- **Real-time preview** of workflow execution
- **Better visual hierarchy** with depth and shadows

### Enhanced Components
- **Trigger card** with icon and clear labeling
- **Step nodes** with visual indicators
- **Action chips** with icons
- **Flow connectors** with animations
- **Status indicators** (active, paused, draft)
- **Quick actions** (duplicate, delete, reorder)

### Improved Interactions
- **Smooth animations** for adding/removing steps
- **Hover states** for better feedback
- **Keyboard shortcuts** for power users
- **Context menus** for quick actions
- **Inline editing** for better flow
- **Collapsible sections** for complex workflows

---

## 4. Implementation Plan

### Phase 1: Enhanced Triggers & Actions
1. Update workflow entity schemas
2. Add new trigger types to enums
3. Add new action types to enums
4. Update trigger/action labels and icons

### Phase 2: Visual Flow Builder
1. Create visual flow component
2. Implement drag-and-drop
3. Add connection lines
4. Create node components
5. Add animations

### Phase 3: UI/UX Refinement
1. Improve spacing and depth
2. Add better icons
3. Enhance color scheme
4. Add micro-interactions
5. Improve mobile responsiveness

---

## 5. Architecture Considerations

### Maintain Existing Patterns
- Follow established folder structure
- Use existing hooks and services
- Maintain type safety
- Follow early return patterns
- Keep components modular

### Performance
- Lazy load visual flow component
- Memoize expensive calculations
- Optimize re-renders
- Use virtual scrolling for long workflows


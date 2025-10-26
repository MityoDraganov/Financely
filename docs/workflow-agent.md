# 🧩 Financely Workflows Specification (LLM-Optimized)

> **Purpose:**  
> Defines the full conceptual and functional system for **Workflows** — automated business processes inside Financely (invoice, renewal, contract, approval, and sync flows).  
> Optimized for use by an LLM agent to interpret natural language and produce structured, executable workflow JSONs.

---

## 🧠 1. Concept Overview

**Entity:** `Workflow`  
**Goal:** Automate finance and operational processes through triggers, conditions, and actions.  
**Execution Context:**  
LLM → interprets user intent → generates workflow JSON → executed by Financely or n8n engine.

---

## 🧩 2. Core Vocabulary

| Term | Description | Example |
|------|--------------|----------|
| **Trigger** | Event starting a workflow | `onInvoiceCreated`, `onPaymentReceived`, `onSchedule` |
| **Condition** | Logic check to branch execution | `if amount > 1000`, `if status == 'unpaid'` |
| **Action** | Operation performed | `sendEmail`, `updateStatus`, `notifySlack` |
| **Output** | Result for logs or analytics | `workflowSuccess`, `auditLogEntry` |
| **Metadata** | Workflow system data | `{ version, createdBy, createdAt }` |

---

## ⚙️ 3. Functional Map

### Triggers
```yaml
onInvoiceCreated
onInvoiceSent
onPaymentReceived
onContractSigned
onProposalApproved
onLicenseExpiring
onSchedule(interval='daily' | 'weekly' | cron)
onManualRun
```

### Conditions
```yaml
if amount > 1000
if invoice.status == 'unpaid'
if days_since_sent >= 7
if license.expires_in <= 30
if customerType == 'VIP'
```

### Actions
```yaml
sendEmail(to, template)
notifyUser(userId, message)
updateStatus(entity, status)
createInvoice(fromProposal)
callWebhook(url, payload)
syncToStripe(customer, subscription)
delay(duration)
createTask(assignee, description)
generatePDF(entity)
logActivity(description)
parallel(actions)
loopOver(collection)
```

### Outputs
```yaml
workflowSuccess
workflowFailure
auditLogEntry
notificationSent
runSummaryReport
```

### Meta
```yaml
retryPolicy(count, delay)
rollbackOnError
runAs(role)
versionControl(enabled)
timeout(seconds)
```

---

## 🧮 4. Workflow JSON Schema

```json
{
  "id": "wf_unique_id",
  "brandId": "brand_123",
  "name": "Workflow Name",
  "description": "Purpose and summary of the workflow.",
  "trigger": { "type": "onInvoiceCreated", "config": {} },
  "conditions": [ "invoice.total < 500" ],
  "actions": [
    { "type": "updateStatus", "parameters": { "entity": "invoice", "status": "approved" } },
    { "type": "notifyUser", "parameters": { "userId": "{{invoice.creatorId}}", "message": "Invoice auto-approved." } }
  ],
  "outputs": [ { "type": "workflowSuccess", "description": "Invoice auto-approved successfully." } ],
  "metadata": { "version": 1, "createdBy": "user_admin", "createdAt": "2025-10-25T13:00:00Z" }
}
```

---

## 🧩 5. Agent Prompt Contract

**System Instruction:**
```
You are the Workflow Agent for Financely.
Your role is to transform user requests about finance or business process automation
into structured JSON workflow blueprints that can be executed by Financely or n8n.

Each workflow consists of:
  - trigger (event)
  - conditions (logical filters)
  - actions (operations)
  - outputs (results)
  - metadata (system data)

Always respond in structured JSON format following the schema provided above.
```

**Input:**
```yaml
natural_language_description: string
user_context: { brand_id, roles, environment }
available_actions: list of supported workflow actions
```

**Output:**
```yaml
workflow_blueprint:
  name: string
  description: string
  trigger: { type: string, config: object }
  conditions: [ expression:string ]
  actions:
    - type: string
      parameters: object
  outputs:
    - type: string
      description: string
  metadata:
    created_by: string
    created_at: timestamp
    version: integer
```

---

## 💼 6. Workflow Categories

| Category | Description | Example Trigger | Common Actions |
|-----------|--------------|----------------|----------------|
| Invoice Lifecycle | Automate invoice creation, approval, reminders | `onInvoiceCreated` | `sendEmail`, `updateStatus` |
| Renewals | Manage renewals and expirations | `onLicenseExpiring` | `createProposal`, `notifyUser` |
| Approvals | Multi-step review pipelines | `onProposalApproved` | `createTask`, `notifyUser` |
| Reminders & Escalations | Handle overdue actions | `onSchedule` | `sendEmail`, `notifySlack` |
| Integrations | Cross-system syncs | `onContractSigned` | `callWebhook`, `syncToStripe` |
| Backups & Audits | Scheduled compliance logs | `onSchedule` | `generateReport`, `uploadToStorage` |

---

## 🧠 7. Examples

### Example 1 – Invoice Reminder
```json
{
  "name": "Invoice Reminder",
  "description": "Send reminder after 3 days if unpaid.",
  "trigger": { "type": "onInvoiceSent" },
  "conditions": [ "status == 'unpaid' && days_since_sent >= 3" ],
  "actions": [
    { "type": "sendEmail", "parameters": { "to": "{{client.email}}", "template": "invoice_reminder" } },
    { "type": "sendEmail", "parameters": { "to": "finance@company.com", "template": "cc_notification" } }
  ],
  "outputs": [ { "type": "workflowSuccess" } ]
}
```

### Example 2 – Renewal Preparation
```json
{
  "name": "Renewal Preparation",
  "trigger": { "type": "onSchedule", "config": { "interval": "daily" } },
  "conditions": [ "license.expires_in <= 30" ],
  "actions": [
    { "type": "createProposal", "parameters": { "from": "license" } },
    { "type": "notifyUser", "parameters": { "userId": "{{accountManager.id}}", "message": "Renewal proposal ready." } }
  ],
  "outputs": [ { "type": "logActivity" } ]
}
```

### Example 3 – Auto-Approve Small Invoices
```json
{
  "name": "Auto-Approve Small Invoices",
  "trigger": { "type": "onInvoiceCreated" },
  "conditions": [ "invoice.total < 500" ],
  "actions": [
    { "type": "updateStatus", "parameters": { "entity": "invoice", "status": "approved" } },
    { "type": "notifyUser", "parameters": { "userId": "{{invoice.creatorId}}", "message": "Invoice auto-approved." } }
  ],
  "outputs": [ { "type": "workflowSuccess" } ]
}
```

---

## 🔁 8. Execution Flow

```
Event Triggered → Workflow Matched → Conditions Evaluated
     ↓ True
   Actions Executed Sequentially
     ↓
   Outputs Recorded → Run Logged → Analytics Updated
```

---

## 📈 9. Versioning & Governance

- `version` increments on modification  
- Store revision history for rollback  
- Only Admins may activate/deactivate workflows  
- Support workflow import/export as JSON  

---

## 🧱 10. Integration Notes (n8n Mapping)

| Financely Action | n8n Node |
|------------------|----------|
| `sendEmail` | Email Node |
| `notifyUser` | Webhook/Notification Node |
| `updateStatus` | HTTP Request Node |
| `callWebhook` | Webhook Node |
| `syncToStripe` | Stripe Node |
| `generatePDF` | Function Node |
| `delay` | Wait Node |

---

## 🧩 11. Agent Instruction Snippet

> You are the **Financely Workflow Agent.**  
> Convert automation requests into valid JSON workflows following this specification.  
> Use logical event → condition → action → output flow.  
> Never invent unsupported actions. Use `{{variable}}` placeholders safely.

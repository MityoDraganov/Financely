# Workflow Execution System

A comprehensive, scalable workflow execution engine built on Firebase Functions that handles HTTP requests, event triggers, and complex automation workflows.

## Architecture Overview

### Core Components

1. **Workflow Execution Engine** (`workflow-execution-engine.ts`)
   - Orchestrates workflow runs and step execution
   - Manages state transitions and error handling
   - Provides pluggable action executor system

2. **Event Ingestion System** (`workflow-triggers.ts`)
   - Handles Firestore triggers (invoice.created, invoice.paid)
   - Provides manual trigger endpoints
   - Supports external webhook events

3. **Action Executors** (`executors/`)
   - HTTP Request executor with template variable support
   - Extensible plugin system for new action types

4. **Workflow Management** (`workflow-management.ts`)
   - CRUD operations for workflows
   - Version management and validation
   - Tenant isolation and security

## Data Model

### Firestore Collections

```
workflows/{workflowId}
├── id: string
├── tenantId: string
├── name: string
├── active: boolean
├── latestVersion: number
├── createdAt: Timestamp
└── updatedAt: Timestamp

workflowVersions/{workflowId}_{version}
├── workflowId: string
├── version: number
├── steps: Record<string, StepDefinition>
├── edges: WorkflowEdge[]
├── inputSchema?: JsonSchema
└── createdAt: Timestamp

workflowRuns/{runId}
├── runId: string
├── workflowId: string
├── version: number
├── tenantId: string
├── status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
├── input: Record<string, unknown>
├── context: Record<string, unknown>
├── createdAt: Timestamp
├── updatedAt: Timestamp
├── startedAt?: Timestamp
├── endedAt?: Timestamp
└── error?: { code?: string; message: string; details?: unknown }

workflowRuns/{runId}/steps/{stepId}
├── stepId: string
├── type: string
├── status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
├── attempt: number
├── rev: number
├── startedAt?: Timestamp
├── endedAt?: Timestamp
├── result?: Record<string, unknown>
├── error?: { code?: string; message: string; details?: unknown }
├── next: string[]
└── idempotencyKey?: string
```

## HTTP Request Action

### Configuration

```typescript
interface HttpRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  auth?: {
    type: "bearer" | "basic" | "none";
    token?: string;
    username?: string;
    password?: string;
  };
  timeoutMs?: number;
}
```

### Template Variables

The HTTP Request executor supports template variables in:
- **URL**: `https://api.stripe.com/v1/customers/{customerId}`
- **Headers**: `{"Authorization": "Bearer {token}"}`
- **Body**: `{"name": "{customer.name}", "email": "{customer.email}"}`
- **Auth**: `{secret.bearer_token}`

Variables are resolved from the workflow context using dot notation.

### Authentication Types

1. **None**: No authentication
2. **Bearer Token**: `Authorization: Bearer {token}`
3. **Basic Auth**: `Authorization: Basic {base64(username:password)}`

## Event Triggers

### Built-in Triggers

1. **Invoice Created** (`invoice.created`)
   - Triggered when a new invoice is created in Firestore
   - Payload includes invoice data

2. **Invoice Paid** (`invoice.paid`)
   - Triggered when invoice status changes to "paid"
   - Payload includes updated invoice data

3. **Manual Trigger** (`manual.trigger`)
   - HTTP endpoint for manual workflow execution
   - Supports custom payload

### External Webhooks

```bash
POST /webhookHandler
{
  "tenantId": "tenant_123",
  "eventType": "custom.event",
  "payload": { "key": "value" }
}
```

## API Endpoints

### Workflow Management

#### Create Workflow
```bash
POST /createWorkflowV2
{
  "tenantId": "tenant_123",
  "name": "Invoice Processing",
  "steps": [
    {
      "id": "step_1",
      "type": "http_request",
      "name": "Send to Slack",
      "config": {
        "method": "POST",
        "url": "https://hooks.slack.com/services/...",
        "body": {
          "text": "Invoice {invoice.number} created"
        }
      }
    }
  ],
  "edges": [
    { "from": "step_1", "to": "step_2" }
  ]
}
```

#### Update Workflow
```bash
POST /updateWorkflow
{
  "workflowId": "workflow_123",
  "tenantId": "tenant_123",
  "name": "Updated Name",
  "active": true
}
```

#### Get Workflow
```bash
POST /getWorkflow
{
  "workflowId": "workflow_123",
  "tenantId": "tenant_123"
}
```

#### List Workflows
```bash
POST /listWorkflows
{
  "tenantId": "tenant_123"
}
```

#### Delete Workflow
```bash
POST /deleteWorkflow
{
  "workflowId": "workflow_123",
  "tenantId": "tenant_123"
}
```

### Workflow Execution

#### Manual Trigger
```bash
POST /triggerWorkflow
{
  "workflowId": "workflow_123",
  "tenantId": "tenant_123",
  "payload": {
    "customData": "value"
  }
}
```

#### Step Execution
```bash
POST /executeStep
{
  "runId": "run_123"
}
```

## Error Handling

### Workflow Level
- Failed workflows are marked with `status: "failed"`
- Error details stored in `error` field
- All running steps are cancelled

### Step Level
- Failed steps are marked with `status: "failed"`
- Retry logic can be implemented per executor
- Error details stored in step `error` field

### Idempotency
- Each step execution has a unique `idempotencyKey`
- Prevents duplicate external API calls
- Handles retries gracefully

## Monitoring & Observability

### Logging
- Structured logs with `runId`, `stepId`, `tenantId`
- Error tracking and debugging information
- Performance metrics

### Metrics
- Workflow execution success rates
- Step execution latency
- Error frequency by step type

### Tracing
- End-to-end workflow execution traces
- Step-by-step execution timeline
- Context propagation between steps

## Security

### Tenant Isolation
- All operations scoped by `tenantId`
- Cross-tenant access prevention
- Secure multi-tenancy

### Authentication
- Clerk token verification for API calls
- Service-to-service authentication
- Webhook signature validation

## Extensibility

### Adding New Action Types

1. Create executor class:
```typescript
export class CustomExecutor {
  async execute(step: StepDefinition, context: Record<string, unknown>, runId: string) {
    // Implementation
  }
}
```

2. Register executor:
```typescript
executionEngine.registerExecutor("custom_action", new CustomExecutor());
```

3. Update frontend to support new action type

### Adding New Triggers

1. Create trigger handler:
```typescript
export const onCustomEvent = onDocumentCreated({
  document: "collection/{docId}",
}, async (event) => {
  // Process event and trigger workflows
});
```

2. Register in main index.ts

## Deployment

### Firebase Functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### Environment Variables
- Set up Firebase project configuration
- Configure external service credentials
- Set up monitoring and alerting

## Example Workflows

### Invoice Notification Workflow
```json
{
  "name": "Invoice Notifications",
  "steps": [
    {
      "id": "notify_slack",
      "type": "http_request",
      "name": "Notify Slack",
      "config": {
        "method": "POST",
        "url": "https://hooks.slack.com/services/...",
        "body": {
          "text": "New invoice {invoice.number} for ${invoice.amount}"
        }
      }
    },
    {
      "id": "send_email",
      "type": "http_request", 
      "name": "Send Email",
      "config": {
        "method": "POST",
        "url": "https://api.sendgrid.com/v3/mail/send",
        "headers": {
          "Authorization": "Bearer {secret.sendgrid_token}"
        },
        "body": {
          "to": [{"email": "{customer.email}"}],
          "subject": "Invoice {invoice.number}",
          "content": [{"type": "text/plain", "value": "Your invoice is ready"}]
        }
      }
    }
  ],
  "edges": [
    {"from": "notify_slack", "to": "send_email"}
  ]
}
```

This workflow system provides a robust, scalable foundation for automating business processes with HTTP requests and event-driven triggers.

# Audit Logging System Guide

## Overview

The audit logging system provides comprehensive tracking of all activities and changes in your application. It captures detailed information about who performed what action, when, and with what outcome.

## Architecture

### Backend Components

1. **Entity** (`functions/src/core/entities/audit-log.ts`)
   - Defines the audit log data structure with comprehensive fields
   - Includes user context, action details, resource information, changes, and outcomes

2. **Repository** (`functions/src/repositories/audit-log-repository.ts`)
   - Handles data persistence in Firestore
   - Stores logs as subcollection: `organizations/{orgId}/auditLogs/{logId}`

3. **Service** (`functions/src/services/audit-log-service.ts`)
   - Provides helper methods for creating audit logs
   - Includes utilities for extracting user context, building changes, etc.

4. **Cloud Functions**
   - `createAuditLog`: Creates audit log entries
   - `queryAuditLogs`: Queries audit logs with filters

### Frontend Components

1. **Service** (`app/src/services/audit-log/audit-log-service.ts`)
   - Frontend service for calling audit log Cloud Functions

2. **Hooks** (`app/src/hooks/use-audit-logs.ts`)
   - React hooks for querying audit logs
   - Includes specialized hooks for resource/user/action queries

3. **UI Page** (`app/src/pages/settings/security/audit-log.tsx`)
   - Comprehensive audit log viewer with filtering and search
   - Detailed view for individual log entries

4. **Utilities** (`app/src/utils/audit-log.ts`)
   - Helper functions for creating audit logs from frontend
   - Automatic user context extraction

## Usage

### Backend Usage

#### In Cloud Functions

```typescript
import { getDatabaseService } from "../services/database-service";
import { getAuditLogRepository } from "../repositories/audit-log-repository";
import { getAuditLogService, AuditLogService } from "../services/audit-log-service";

export async function handleCreateProduct(
  payload: CreateProductInput,
  userContext?: {
    userId: string;
    clerkId: string;
    email: string;
    name: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Your business logic here
    const productId = await productRepository.create({ data: validatedData });
    
    // Log success
    const databaseService = getDatabaseService();
    const auditLogRepository = getAuditLogRepository(databaseService);
    const auditLogService = getAuditLogService(auditLogRepository);
    
    if (userContext) {
      await auditLogService.logSuccess(
        payload.organizationId,
        "product.created",
        AuditLogService.buildUserContext(
          userContext.userId,
          userContext.clerkId,
          userContext.email,
          userContext.name,
          {
            ipAddress: userContext.ipAddress,
            userAgent: userContext.userAgent,
          }
        ),
        {
          resource: {
            type: "product",
            id: productId,
            name: payload.name,
          },
          durationMs: Date.now() - startTime,
        }
      );
    }
    
    return productId;
  } catch (error) {
    // Log failure
    if (userContext) {
      const databaseService = getDatabaseService();
      const auditLogRepository = getAuditLogRepository(databaseService);
      const auditLogService = getAuditLogService(auditLogRepository);
      
      await auditLogService.logFailure(
        payload.organizationId,
        "product.created",
        AuditLogService.buildUserContext(
          userContext.userId,
          userContext.clerkId,
          userContext.email,
          userContext.name,
        ),
        error instanceof Error ? error : new Error(String(error)),
        {
          resource: {
            type: "product",
            id: "unknown",
          },
        }
      );
    }
    
    throw error;
  }
}
```

#### Logging CRUD Operations

```typescript
// For update operations with change tracking
const before = await productRepository.get({ id: productId });
await productRepository.update({ id: productId, data: updatedData });
const after = await productRepository.get({ id: productId });

const changes = AuditLogService.buildChanges(before, after);

await auditLogService.logCRUD(
  organizationId,
  "update",
  "product",
  productId,
  userContext,
  {
    resourceName: after.name,
    changes,
    beforeSnapshot: before,
    afterSnapshot: after,
  }
);
```

### Frontend Usage

#### Using the Utility Function

```typescript
import { logAuditEvent, logCRUDOperation } from "@/utils/audit-log";
import { useUser } from "@clerk/clerk-react";
import { useOrganizationContext } from "@/contexts/organization-context";

function MyComponent() {
  const { user } = useUser();
  const { currentOrganization } = useOrganizationContext();
  
  const handleCreateInvoice = async () => {
    try {
      const invoice = await createInvoice(data);
      
      // Log the action
      await logAuditEvent("invoice.created", {
        organizationId: currentOrganization?.id || "",
        userId: user?.id || "",
        clerkId: user?.id || "",
        email: user?.primaryEmailAddress?.emailAddress || "",
        name: user?.fullName || "",
        resource: {
          type: "invoice",
          id: invoice.id,
          name: invoice.number,
        },
        outcome: {
          status: "success",
        },
      });
    } catch (error) {
      // Log failure
      await logAuditEvent("invoice.created", {
        organizationId: currentOrganization?.id || "",
        userId: user?.id || "",
        clerkId: user?.id || "",
        email: user?.primaryEmailAddress?.emailAddress || "",
        name: user?.fullName || "",
        outcome: {
          status: "failure",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };
}
```

#### Using CRUD Helper

```typescript
import { logCRUDOperation } from "@/utils/audit-log";

await logCRUDOperation("update", "invoice", invoiceId, {
  organizationId: currentOrganization?.id || "",
  userId: user?.id || "",
  clerkId: user?.id || "",
  email: user?.primaryEmailAddress?.emailAddress || "",
  name: user?.fullName || "",
  resourceName: invoice.number,
  changes: [
    { field: "status", oldValue: "draft", newValue: "sent" },
  ],
});
```

## Action Types

The system supports a comprehensive set of action types organized by category:

- **Authentication**: `user.login`, `user.logout`, `user.created`, etc.
- **Organization**: `organization.created`, `organization.updated`, etc.
- **Invoices**: `invoice.created`, `invoice.sent`, `invoice.paid`, etc.
- **Proposals**: `proposal.created`, `proposal.accepted`, etc.
- **Products**: `product.created`, `product.updated`, etc.
- **Workflows**: `workflow.created`, `workflow.executed`, etc.
- **Security**: `access.granted`, `api_key.created`, etc.

See `functions/src/core/entities/audit-log.ts` for the complete list.

## Querying Audit Logs

### Using React Hooks

```typescript
import { useAuditLogs, useResourceAuditLogs } from "@/hooks/use-audit-logs";

// Query with filters
const { data, isLoading } = useAuditLogs({
  filters: {
    action: "invoice.created",
    severity: "info",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  },
  limit: 100,
});

// Query for specific resource
const { data: resourceLogs } = useResourceAuditLogs("invoice", invoiceId);
```

### Using the Service Directly

```typescript
import { auditLogService } from "@/services/audit-log/audit-log-service";

const result = await auditLogService.queryAuditLogs(
  organizationId,
  {
    action: "invoice.created",
    userId: userId,
  },
  {
    limit: 50,
    orderBy: { field: "timestamp", direction: "desc" },
  }
);
```

## Best Practices

1. **Always Log Critical Operations**
   - User authentication changes
   - Data deletion
   - Permission changes
   - Financial transactions

2. **Include Change Tracking for Updates**
   - Use `buildChanges()` to automatically track field changes
   - Include before/after snapshots for critical resources

3. **Log Both Success and Failure**
   - Always log failures with error details
   - Include duration for performance monitoring

4. **Use Appropriate Severity Levels**
   - `info`: Normal operations
   - `warning`: Unusual but expected events
   - `error`: Failed operations
   - `critical`: Security or data integrity issues

5. **Don't Log Sensitive Data**
   - Avoid logging passwords, tokens, or PII in snapshots
   - Use metadata fields for non-sensitive context

6. **Performance Considerations**
   - Audit logging should not block operations
   - Errors in audit logging should not affect business logic
   - Consider async logging for high-volume operations

## UI Features

The audit log UI page (`/settings/security/audit-log`) provides:

- **Filtering**: By action, severity, status, date range, user
- **Search**: Text search across relevant fields
- **Detailed View**: Complete information about each log entry
- **Export**: Download audit logs (coming soon)

## Data Structure

Each audit log entry includes:

- **User Context**: ID, email, name, role, IP, user agent, device info
- **Action**: Type of action performed
- **Resource**: What was acted upon (type, ID, name)
- **Changes**: Field-level change tracking (for updates)
- **Snapshots**: Before/after state (for critical operations)
- **Outcome**: Success/failure status, error details, duration
- **Metadata**: Request ID, correlation ID, tags, custom fields

## Security Considerations

- Audit logs are immutable (write-only)
- Access to audit logs should be restricted to admins
- Consider data retention policies for compliance
- Audit logs themselves should be audited for access

## Future Enhancements

- Real-time audit log streaming
- Advanced analytics and reporting
- Automated alerting on critical events
- Integration with external SIEM systems
- Compliance report generation


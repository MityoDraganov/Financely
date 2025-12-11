# Admin Panel Architecture Patterns

## Hook Patterns from Main App

### 1. Repository Hooks (`hooks/repository-hooks/`)
- **Purpose**: Direct Firestore data access via repositories
- **Pattern**:
  ```typescript
  import { repositoryHost } from "@/repositories";
  import { serviceHost } from "@/services";
  
  const databaseService = serviceHost.getDatabaseService();
  const repository = repositoryHost.getXxxRepository(databaseService);
  
  export const useXxx = (params) => {
    return useQuery({
      queryKey: ["resource", "action", params],
      queryFn: () => repository.getAll({ queryConstraints: [...] }),
    });
  };
  ```

- **Use for**: Simple CRUD operations, direct data fetching
- **Examples**: `useOrganizations`, `useUsers`, `useTemplates`

### 2. Service Hooks (`hooks/service-hooks/`)
- **Purpose**: Cloud Functions and complex business logic
- **Pattern**:
  ```typescript
  import { serviceHost } from "@/services";
  
  const functionsService = serviceHost.getFunctionsService();
  
  export const useXxx = () => {
    return useMutation({
      mutationFn: functionsService.xxxFunction,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["resource"] });
      },
    });
  };
  ```

- **Use for**: Complex operations, server-side logic, mutations
- **Examples**: `useCreateInvoice`, `useRenderInvoicePdf`, `useUsageHistory`

### 3. Service Host Pattern
- **Centralized access**: All services accessed via `serviceHost`
- **Services are singletons**: `databaseService`, `functionsService`, etc.
- **Repository pattern**: Repositories take `databaseService` as parameter

### 4. Query Key Structure
- Format: `["resource", "action", ...params]`
- Examples:
  - `["organizations", "all", queryConstraints]`
  - `["organizations", organizationId]`
  - `["users", "clerkId", clerkId]`
  - `["usageHistory", organizationId, periodType]`

### 5. React Query Patterns
- **Queries**: Use `useQuery` with proper `enabled` conditions
- **Mutations**: Use `useMutation` with `onSuccess` for cache invalidation
- **Stale time**: Set appropriate `staleTime` (e.g., 30s for lists, 5min for user data)
- **Cache invalidation**: Invalidate related queries on mutations

### 6. Auth Patterns
- Use `useAuthReady()` to gate queries
- Use `useUser()` from Clerk for auth state
- Check `isSignedIn` before enabling queries

## Admin Panel Implementation

Admin hooks should follow the same patterns but with admin-specific considerations:

1. **Repository hooks for GET operations**: Use repositories directly (admin has cross-org access)
2. **Service hooks for mutations**: Use Cloud Functions for admin actions
3. **Query keys**: Prefix with `["admin", ...]` to separate from regular app queries
4. **No org filtering**: Admin hooks don't filter by orgId (cross-org access)


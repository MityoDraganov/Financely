# Realtime Designer Migration Guide

## Overview

The template designer has been migrated from Firestore to Firebase Realtime Database to enable real-time collaborative editing. This allows multiple users to work on the same template simultaneously and see each other's changes in real-time.

## Architecture Changes

### What Moved to Realtime Database
- **Templates** (`templates` collection) - Now stored in Realtime Database for live collaboration
  - All template data including elements, brand settings, and page configuration
  - Real-time synchronization across all connected clients
  - Optimistic updates with instant feedback

### What Stayed on Firestore
- **Template Versions** - Historical snapshots remain on Firestore for audit trail
- **Invoices** - All invoice functionality remains on Firestore
- **Proposals** - All proposal functionality remains on Firestore
- **All other entities** - Only templates were migrated

## Key Files Created/Modified

### New Files
1. **`app/src/services/database/realtime-database-service.ts`**
   - Core service for Firebase Realtime Database operations
   - Provides CRUD operations and real-time subscriptions
   - Type-safe wrapper around Firebase Realtime Database SDK

2. **`app/src/repositories/template-realtime-repository.ts`**
   - Template repository implementation using Realtime Database
   - Implements same interface as Firestore repository for consistency
   - Adds `subscribeToAll()` method for real-time updates

3. **`database.rules.json`**
   - Firebase Realtime Database security rules
   - Currently open for development (should be restricted in production)

### Modified Files
1. **`app/src/services/template-service.ts`**
   - Switched from Firestore to Realtime Database repository
   - Template versions still use Firestore for historical records

2. **`app/src/hooks/repository-hooks/use-templates.ts`**
   - Added real-time subscription using React Query
   - Auto-updates cache when templates change
   - Provides `isSubscribed` status indicator

3. **`app/src/pages/designer.tsx`**
   - Added "Live" indicator showing real-time sync status
   - Uses updated `useTemplates` hook with real-time data
   - All drag/drop and editing operations now sync in real-time

4. **`firebase.json`**
   - Added Realtime Database configuration

## How Real-time Collaboration Works

### 1. Initial Load
```typescript
const { data: templates, isSubscribed } = useTemplates("demo-org");
```
- Fetches initial templates from Realtime Database
- Establishes WebSocket connection for real-time updates

### 2. Real-time Updates
- When any user modifies a template, the change is pushed to Realtime Database
- All connected clients receive the update via WebSocket
- React Query cache is automatically updated
- UI re-renders with new data

### 3. Optimistic Updates
- Local changes are immediately reflected in the UI
- Changes are persisted to Realtime Database
- If another user makes a conflicting change, the latest change wins (last-write-wins)

### 4. Collaborative Features
- Multiple users can edit different elements simultaneously
- Snapping alignment guides work across all users
- Element selections and positions update in real-time
- Visual "Live" indicator shows when real-time sync is active

## Data Structure in Realtime Database

```
/templates
  /{templateId}
    - id: string
    - orgId: string
    - name: string
    - description: string
    - pageSize: "A4" | "Letter"
    - brand: { fonts, colors, margins }
    - elements: [ array of template elements ]
    - status: "draft" | "published"
    - createdAt: ISO timestamp
    - updatedAt: ISO timestamp
```

## Migration Steps (For Production)

### 1. Data Migration Script
You'll need to migrate existing templates from Firestore to Realtime Database:

```typescript
// Example migration script (not included)
import { firebase } from './infrastructure';
import { getDocs, collection } from '@firebase/firestore';
import { ref, set } from '@firebase/database';

async function migrateTemplates() {
  const snapshot = await getDocs(collection(firebase.firestore, 'templates'));
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await set(ref(firebase.database, `templates/${doc.id}`), {
      ...data,
      id: doc.id,
    });
  }
}
```

### 2. Deploy Security Rules
```bash
firebase deploy --only database
```

### 3. Update Security Rules for Production
Edit `database.rules.json` to restrict access:

```json
{
  "rules": {
    "templates": {
      "$templateId": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('orgId').val() === newData.child('orgId').val())",
        ".validate": "newData.hasChildren(['orgId', 'name', 'pageSize', 'brand', 'elements', 'status'])"
      }
    }
  }
}
```

## Performance Considerations

### Benefits
- **Instant updates**: Changes propagate to all users immediately
- **Reduced API calls**: Single WebSocket connection instead of polling
- **Better UX**: Users see collaborators' changes in real-time

### Trade-offs
- **Connection overhead**: Each client maintains a WebSocket connection
- **Conflict resolution**: Last-write-wins (no CRDT or OT)
- **Bandwidth**: All template updates are pushed to all connected clients

## Conflict Resolution

The current implementation uses **last-write-wins** strategy:
- If two users edit the same element simultaneously, the last save wins
- For better conflict resolution, consider implementing:
  - Element-level locking
  - Operational Transformation (OT)
  - Conflict-free Replicated Data Types (CRDTs)

## Monitoring & Debugging

### Check Real-time Status
```typescript
const { isSubscribed } = useTemplates("demo-org");
console.log("Realtime sync active:", isSubscribed);
```

### Firebase Console
- Monitor active connections in Firebase Console
- View real-time data structure
- Check security rule evaluations

## Future Enhancements

1. **User Presence**
   - Show which users are currently editing
   - Display cursor positions of other users
   - Show user avatars on selected elements

2. **Element Locking**
   - Lock elements when being edited
   - Prevent simultaneous edits on same element

3. **Undo/Redo Stack**
   - Per-user operation history
   - Collaborative undo with operational transform

4. **Offline Support**
   - Queue changes when offline
   - Sync when connection restored
   - Detect and resolve conflicts

## Rollback Plan

If issues arise, you can rollback to Firestore:

1. Revert changes to these files:
   - `app/src/services/template-service.ts`
   - `app/src/hooks/repository-hooks/use-templates.ts`

2. Change back to Firestore repository:
```typescript
import { getTemplateRepository } from "@/repositories/template-repository";
const templateRepository = getTemplateRepository(databaseService);
```

3. Remove real-time subscription from `useTemplates` hook

## Testing Real-time Collaboration

1. Open designer in two browser windows
2. Create or select a template in both windows
3. Move an element in window 1
4. Observe the element position update in window 2
5. Verify "Live" indicator shows in both windows
6. Test snapping alignment works across windows

## Support & Troubleshooting

### Issue: Authentication error (auth/configuration-not-found)
This occurs when Firebase Auth is not enabled. The app now works without authentication for development:

**Quick Fix:**
- The app will now continue without authentication if it fails
- Deploy the database rules: `firebase deploy --only database`

**Production Setup (Optional):**
1. Enable Firebase Auth in Firebase Console
2. Enable Anonymous Authentication
3. Update database rules in `database.rules.json` to require auth:
```json
{
  "rules": {
    "templates": {
      "$templateId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

### Issue: Real-time updates not working
- Check Firebase Realtime Database is enabled in Firebase Console
- Verify `database.rules.json` allows read/write access
- Check browser console for WebSocket connection errors
- Ensure you're using the same orgId in both windows

### Issue: Data not persisting
- Verify security rules in Firebase Console
- Deploy rules: `firebase deploy --only database`
- Ensure `updatedAt` timestamp is being set
- Check browser console for errors

### Issue: Performance degradation
- Monitor number of active connections
- Consider adding pagination for large template lists
- Implement debouncing on frequent updates


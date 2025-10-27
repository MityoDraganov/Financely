# Workflow Builder Components

This directory contains the refactored workflow builder components, broken down into smaller, reusable components following best practices.

## Component Structure

### Main Components

- **`workflow-builder.tsx`** - Main orchestrator component that manages state and coordinates between sub-components
- **`types.ts`** - Shared types and interfaces for all workflow components

### Sub-Components

#### Core Components
- **`workflow-header.tsx`** - Handles workflow metadata (name, description, trigger, category)
- **`workflow-steps.tsx`** - Container for managing workflow steps
- **`workflow-step.tsx`** - Individual step configuration component
- **`workflow-action.tsx`** - Action configuration component (HTTP/Email)
- **`workflow-actions.tsx`** - Action buttons (Save, Preview, Test)

#### Action Configuration Components
- **`http-action-config.tsx`** - HTTP request specific configuration
- **`email-action-config.tsx`** - Email specific configuration

## Benefits of This Structure

### 1. **Separation of Concerns**
- Each component has a single responsibility
- Easier to test individual components
- Clear boundaries between different parts of the workflow builder

### 2. **Reusability**
- Components can be reused in other parts of the application
- Action config components can be used independently
- Header component can be used for workflow editing

### 3. **Maintainability**
- Smaller files are easier to understand and modify
- Changes to one component don't affect others
- Clear prop interfaces make dependencies explicit

### 4. **Type Safety**
- Strong typing throughout all components
- Shared types prevent inconsistencies
- Better IDE support and error detection

### 5. **Performance**
- Components can be memoized individually
- Smaller re-render scope
- Better React DevTools debugging

## Usage

```tsx
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";

// Use the main component
<WorkflowBuilder 
  editingWorkflow={workflow}
  onCancelEdit={handleCancelEdit}
  onPreview={handlePreview}
/>
```

## Component Props

Each component has well-defined props interfaces in `types.ts`:

- `WorkflowBuilderProps` - Main component props
- `WorkflowHeaderProps` - Header component props
- `WorkflowStepsProps` - Steps container props
- `WorkflowStepProps` - Individual step props
- `WorkflowActionProps` - Action component props
- `WorkflowActionsProps` - Action buttons props

## State Management

The main `WorkflowBuilder` component manages all state and passes down:
- Update functions to child components
- Current workflow data
- Event handlers for user interactions

This follows the "lifting state up" pattern and keeps state management centralized.


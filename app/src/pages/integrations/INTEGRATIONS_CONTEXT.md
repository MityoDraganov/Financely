# Integrations Page - LLM Context Documentation

## Overview

The Integrations Page (`integrations-page.tsx`) is a comprehensive widget configuration interface that allows organizations to create, customize, and embed interactive widgets on their websites. The page manages three types of embeddable widgets: Contact Form, Invoice Request, and Quote Request.

## Supported Widget Types

### 1. Contact Form Widget
- **Purpose**: Collect customer contact information and messages
- **Features**:
  - Built-in fields: name, email, phone, company, message (each configurable: enabled/disabled, required/optional, custom labels)
  - Custom fields: Add unlimited custom fields with types (text, email, tel, textarea, number, select, checkbox, date)
  - Display modes: Floating button or inline embed
  - Position: bottom-right, bottom-left, top-right, top-left, center
  - Full styling customization
  - Multi-language localization support

### 2. Invoice Request Widget
- **Purpose**: Allow customers to request invoices
- **Features**:
  - Configurable title, description, submit button text, success message
  - Position control (bottom-right, bottom-left, top-right, top-left, center)
  - Full styling customization
  - Multi-language localization support

### 3. Quote Request Widget
- **Purpose**: Enable customers to request quotes
- **Features**:
  - Configurable title, description, submit button text, success message
  - Position control (bottom-right, bottom-left, top-right, top-left, center)
  - Full styling customization
  - Multi-language localization support

## Core Features

### Widget Enable/Disable Toggle
- Master toggle to enable/disable all widgets
- When disabled, no widgets are rendered or embedded
- When enabled, individual widgets can be configured independently

### AI-Powered Widget Generation
- **Hook**: `useGenerateWidget()`
- **Supported Styles**: modern, classic, minimal, professional, bold, elegant
- **Context Input**: Optional text context for AI to understand brand/business requirements
- **Output**: Generates complete styling configuration and widget settings
- **Widget Types Supported**: All three widget types (contactForm, invoiceRequest, quoteRequest)
- **Integration**: Dialog-based UI with style selector and context textarea

### Widget Versioning System
- **Hook**: `useRestoreWidgetVersion()`
- **Version Storage**: Each save creates a new version snapshot stored in `organization.settings.widgets.versions[]`
- **Version Metadata**: 
  - Version number (auto-incremented)
  - Widget type (contactForm, invoiceRequest, quoteRequest, or "all")
  - Complete widget configuration snapshot
  - Created timestamp
  - Optional description
- **Features**:
  - View version history
  - Preview any previous version
  - Restore any previous version
  - Current version tracked in `metadata.version`

### Widget Styling System
- **Default Styling**: Automatically derived from organization brand colors (`organization.settings.brandColors`)
- **Styling Properties**:
  - Colors: primary, secondary, background, text, border, error, success
  - Typography: fontFamily, fontSize, fontWeight
  - Spacing: padding, gap
  - Borders: borderRadius
  - Buttons: padding, borderRadius, fontWeight
  - Modal: backdropOpacity, borderRadius, maxWidth
  - Shadow: box-shadow value
- **Per-Widget Styling**: Each widget type has independent styling configuration

### Localization System
- **Structure**: `WidgetLocalization` with `defaultLanguage: "en"` and `languages: Record<string, Record<string, string>>`
- **Normalization**: Handles legacy formats (Record<string, string> or Record<string, Record<string, string>>)
- **Per-Widget**: Each widget has independent localization configuration
- **Translation Keys**: All widget text (titles, descriptions, buttons, messages, field labels) can be translated

### Embed Script Generation
- **Script Format**: 
  ```html
  <script src="{origin}/widget-loader.js" data-org-id="{organizationId}" data-api-url="{apiUrl}"></script>
  ```
- **API URL**: `https://us-central1-{projectId}.cloudfunctions.net`
- **Copy to Clipboard**: One-click copy functionality with success toast
- **Display**: Shown in `EmbedScriptSection` component when widgets are enabled

### Widget Preview
- **Component**: `WidgetPreview`
- **Usage**: Preview dialog shows how widgets will appear
- **Version Preview**: Can preview any historical version
- **Live Preview**: Shows current configuration before saving

## Data Structure

### Organization Settings Schema
```typescript
organization.settings.widgets = {
  enabled: boolean;
  metadata?: {
    version: number;
    lastSavedAt?: string;
  };
  versions?: Array<{
    version: number;
    widgetType: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
    widgets: Record<string, unknown>;
    createdAt: string;
    description?: string;
  }>;
  contactForm?: {
    enabled: boolean;
    title: string;
    description?: string;
    styling?: WidgetStyling;
    localization?: WidgetLocalization;
    builtInFields?: BuiltInFields;
    customFields: CustomField[];
    submitButtonText: string;
    successMessage: string;
    position: WidgetPosition;
    displayMode: "floating" | "inline";
  };
  invoiceRequest?: {
    enabled: boolean;
    title: string;
    description?: string;
    styling?: WidgetStyling;
    localization?: WidgetLocalization;
    submitButtonText: string;
    successMessage: string;
    position: WidgetPosition;
  };
  quoteRequest?: {
    enabled: boolean;
    title: string;
    description?: string;
    styling?: WidgetStyling;
    localization?: WidgetLocalization;
    submitButtonText: string;
    successMessage: string;
    position: WidgetPosition;
  };
}
```

### Type Definitions

**WidgetPosition**: `"bottom-right" | "bottom-left" | "top-right" | "top-left" | "center"`

**WidgetDisplayMode**: `"floating" | "inline"` (Contact Form only)

**WidgetFieldType**: `"text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date"`

**WidgetStyling**: See widget-types.ts for complete interface (25+ properties)

**WidgetLocalization**: 
```typescript
{
  defaultLanguage: "en";
  languages: Record<string, Record<string, string>>;
}
```

**BuiltInFields**:
```typescript
{
  name: BuiltInField;
  email: BuiltInField;
  phone: BuiltInField;
  company: BuiltInField;
  message: BuiltInField;
}
```

**CustomField**:
```typescript
{
  id: string;
  name: string;
  label: string;
  type: WidgetFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select fields
  validation?: { min?: number; max?: number; pattern?: string };
  order: number;
}
```

## Key Hooks & Services

### `useCurrentOrganization()`
- Fetches current organization data
- Provides organization settings including widget configurations
- Used to load existing widget settings on mount

### `useUpdateOrganization()`
- Mutation hook for updating organization settings
- Used to save widget configurations
- Handles optimistic updates and error states

### `useGenerateWidget()`
- Mutation hook for AI widget generation
- Calls `functionsService.generateWidget()`
- Parameters:
  - `organizationId`: string
  - `widgetType`: "contactForm" | "invoiceRequest" | "quoteRequest"
  - `options.style`: Design style preference
  - `options.context`: Optional business context for AI

### `useRestoreWidgetVersion()`
- Mutation hook for restoring widget versions
- Parameters:
  - `organizationId`: string
  - `version`: number
  - `widgetType`: "all" | specific widget type

## Component Architecture

### Main Component: `IntegrationsPage`
- **State Management**: Extensive useState hooks for each widget's configuration, styling, and localization
- **Data Loading**: useEffect hooks to sync state with organization settings
- **Save Logic**: `handleSaveWidgets()` - creates version snapshots, updates organization settings
- **Custom Fields Management**: Add, remove, update custom fields for contact form

### Child Components

1. **WidgetEnableToggle**: Master enable/disable toggle
2. **ContactFormWidgetConfig**: Full configuration UI for contact form widget
3. **InvoiceRequestWidgetConfig**: Configuration UI for invoice request widget
4. **QuoteRequestWidgetConfig**: Configuration UI for quote request widget
5. **WidgetVersionHistory**: Displays version history with preview and restore actions
6. **EmbedScriptSection**: Shows embed script with copy functionality
7. **WidgetPreview**: Renders widget preview in dialog

## User Flow

1. **Enable Widgets**: Toggle master switch to enable widget system
2. **Configure Widgets**: 
   - Configure each widget type independently
   - Set titles, descriptions, button text, success messages
   - Customize styling (colors, fonts, spacing, etc.)
   - Set up localization for multiple languages
   - For contact form: configure built-in fields and add custom fields
3. **AI Generation (Optional)**: 
   - Open AI builder dialog
   - Select widget type and design style
   - Provide optional context
   - Generate and apply AI-generated configuration
4. **Preview**: Use preview dialogs to see how widgets will appear
5. **Save**: Save configuration (creates version snapshot)
6. **Version Management**: View history, preview versions, restore if needed
7. **Embed**: Copy embed script and paste into website HTML

## Technical Implementation Details

### Default Styling Builder
- `buildDefaultStylingFromBranding()` function creates default styling from organization brand colors
- Falls back to sensible defaults if brand colors not available
- Merges with existing styling when loading from organization settings

### Localization Normalization
- `normalizeLocalization()` handles multiple legacy formats
- Converts old formats to new `WidgetLocalization` structure
- Ensures backward compatibility

### Version Snapshot Logic
- Before saving, creates snapshot of current enabled widgets
- Stores complete widget state in versions array
- Increments version number in metadata
- Filters out invalid versions (null widgets)

### State Synchronization
- Multiple useEffect hooks sync organization settings to component state
- Handles brand color changes to update default styling
- Watches for widget configuration changes in organization data

## Integration Points

### Backend Functions
- **Widget Generation**: `functionsService.generateWidget()` - AI-powered widget generation
- **Widget Versioning**: `functionsService.restoreWidgetVersion()` - Version restoration
- **Widget Loader**: Served at `/widget-loader.js` - Client-side widget loader script
- **API Endpoint**: Cloud Functions endpoint for widget form submissions

### External Dependencies
- **React Query**: Data fetching and mutations
- **React i18next**: Internationalization
- **Sonner**: Toast notifications
- **Lucide React**: Icons
- **shadcn/ui**: UI component library (Dialog, Card, Button, Select, etc.)

## Current Limitations & Notes

1. **Contact Form Only**: Custom fields are only supported for Contact Form widget
2. **Display Mode**: Only Contact Form supports "inline" display mode; others are floating only
3. **Version Restoration**: Restores entire widget configuration, not individual widget types
4. **AI Generation**: Requires organization ID and may have API rate limits
5. **Embed Script**: Requires widget-loader.js to be available at root domain
6. **Styling Inheritance**: Styling defaults from brand colors but can be fully overridden

## Future Enhancement Opportunities

- Individual widget type versioning (not just "all")
- More widget types (e.g., Support Ticket, Feedback Form)
- Widget templates/presets
- A/B testing different widget configurations
- Analytics integration for widget usage
- Conditional widget display based on page/route
- Widget scheduling (show/hide based on time/date)

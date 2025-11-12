# Multi-Currency Money Field System

## Overview

A comprehensive multi-currency money field system for the Financely invoice designer that supports:
- Currency input fields with live exchange rate conversion
- Visual field linking with automatic conversion
- Cycle detection and dependency graph management
- Minor units storage for precision
- Real-time API-based exchange rates

## Architecture

### Core Components

1. **Currency Field Entities** (`app/src/core/entities/currency-field.ts`)
   - `CurrencyValue`: Stores amounts in minor units (cents, etc.)
   - `FxRate`: Exchange rate information with provenance
   - `CurrencyFieldLink`: Link configuration (FX_PAIR, FIXED_MULTIPLIER, FORMULA)
   - `FieldDependency`: Dependency graph nodes

2. **Dependency Graph** (`app/src/utils/currency-dag.ts`)
   - Builds dependency graph from field links
   - Detects cycles using DFS
   - Topological sort for computation order
   - Validates linking configurations

3. **Currency Field Service** (`app/src/services/currency-field-service.ts`)
   - Currency conversion with minor units
   - Exchange rate fetching with priority (snapshot → manual → triangulation → API)
   - Linked field computation
   - Rate provenance formatting

4. **UI Components**
   - `CurrencyInputElement`: Currency input with selector
   - `CurrencyFieldLinking`: Visual linking interface with arrows
   - Enhanced `InputProperties`: Currency-specific configuration

### Template Schema Extension

The input element schema has been extended to support currency fields:

```typescript
{
  type: "input",
  variant: "currency", // New variant
  currency: "USD", // ISO 4217 currency code
  currencyLinks: [...], // Array of link configurations
  mode: "independent" | "linked" | "formula", // Field mode
  // ... other input properties
}
```

## Features

### 1. Currency Input Element

- Currency selector dropdown with all ISO 4217 currencies
- Visual indicator for linked fields
- Proper locale formatting
- Minor units precision

### 2. Field Linking

**Link Types:**
- **FX_PAIR**: Direct currency conversion from another field
  - Source field selection
  - Target currency selection
  - Visual arrow indicator (→)
  
- **FIXED_MULTIPLIER**: Apply a constant multiplier
  - Multiplier input
  - Direct calculation

- **FORMULA**: Computed expression (coming soon)
  - Formula parser
  - Field references

### 3. Visual Schematic UI

The linking interface provides:
- Visual arrows showing conversion direction
- Source field → Target currency display
- Active links list with remove buttons
- Cycle detection warnings
- Real-time validation

### 4. Dependency Graph (DAG)

- **Cycle Detection**: Prevents circular dependencies
- **Topological Sort**: Ensures correct computation order
- **Validation**: Validates links before adding

### 5. Exchange Rate Management

**Priority System:**
1. Snapshot rates (frozen at posting time)
2. Manual overrides (user-defined)
3. Organization base triangulation (via org base currency)
4. Provider API (exchangerate-api.com)

**Rate Provenance:**
- Source tracking (api, manual, snapshot, triangulation)
- Timestamp recording
- Conversion path for triangulation

### 6. Precision & Storage

- **Minor Units**: All amounts stored in minor units (cents, etc.)
- **Decimal.js**: Precise arithmetic (fallback to native Number)
- **Banker's Rounding**: ROUND_HALF_EVEN for financial accuracy
- **Scale Management**: Proper decimal place handling

## Usage

### Creating a Currency Field

1. Add an input element in the designer
2. Set variant to "Currency"
3. Select currency code (e.g., USD, EUR, GBP)
4. Choose mode: Independent, Linked, or Formula

### Linking Fields

1. Set field mode to "Linked"
2. Click "Add Link"
3. Select link type (FX_PAIR or FIXED_MULTIPLIER)
4. For FX_PAIR:
   - Select source field
   - Select target currency
   - Visual arrow shows conversion direction
5. System validates for cycles automatically

### Example: Multi-Currency Invoice

```
Field 1: Amount (USD) - Independent
Field 2: Amount (EUR) - Linked to Field 1 (FX_PAIR: USD → EUR)
Field 3: Amount (GBP) - Linked to Field 1 (FX_PAIR: USD → GBP)
```

When Field 1 changes, Fields 2 and 3 automatically update with live exchange rates.

## API Integration

### Exchange Rate Provider

Currently uses **exchangerate-api.com** (free tier):
- 1,500 requests/month
- Real-time rates
- 170+ currencies
- No API key required for basic usage

**Alternative Providers** (can be configured):
- Fixer.io
- CurrencyAPI.com
- CurrencyBeacon
- ExchangeRate-API

### Rate Caching

- 1-hour cache duration
- Automatic refresh
- Fallback to cached rates on API failure

## Installation

### Required Packages

```bash
npm install decimal.js
```

The system includes a fallback if decimal.js is not installed, but for production use, install it for precise calculations.

### Optional Packages

```bash
npm install dinero.js  # Alternative currency library
```

## Data Structure

### Currency Value

```typescript
{
  amountMinor: 10000, // Amount in minor units (100.00 USD)
  currency: "USD",   // ISO 4217 code
  scale: 2,          // Decimal places
  asOf: "2025-11-12T..." // ISO timestamp
}
```

### Exchange Rate

```typescript
{
  base: "USD",
  quote: "EUR",
  rate: 0.85,
  asOf: "2025-11-12T...",
  source: "api" | "manual" | "snapshot" | "triangulation",
  path?: ["USD", "EUR"] // For triangulation
}
```

### Field Link

```typescript
{
  type: "FX_PAIR",
  sourceFieldId: "field-123",
  targetCurrency: "EUR",
  rate: 0.85,
  rateSource: "api",
  rateDate: "2025-11-12T..."
}
```

## Best Practices

1. **Always use minor units** for storage to avoid floating-point errors
2. **Freeze snapshots** when posting invoices - never recalculate later
3. **Validate links** before adding to prevent cycles
4. **Show provenance** - display rate source and timestamp to users
5. **Handle errors gracefully** - fallback to cached rates if API fails
6. **Use organization base currency** for triangulation when direct rates unavailable

## Future Enhancements

- [ ] Formula link type implementation
- [ ] Historical rate support
- [ ] Multiple link support per field
- [ ] Rate override UI
- [ ] Batch conversion optimization
- [ ] Rate alerting for significant changes
- [ ] Custom rate provider configuration
- [ ] Rate export/import for audit

## Troubleshooting

### Cycle Detection

If you see "Cycle detected" error:
- Review your field links
- Remove circular dependencies
- Use independent fields to break cycles

### Rate Fetching Issues

- Check API rate limits
- Verify internet connection
- Review cached rates fallback
- Check organization base currency configuration

### Precision Issues

- Ensure decimal.js is installed
- Verify scale settings match currency requirements
- Check minor units conversion

## Related Files

- `app/src/core/entities/currency-field.ts` - Core types
- `app/src/utils/currency-dag.ts` - Dependency graph
- `app/src/services/currency-field-service.ts` - Conversion logic
- `app/src/components/designer/elements/currency-input.tsx` - UI component
- `app/src/components/designer/currency-field-linking.tsx` - Linking UI
- `app/src/utils/currencies.ts` - Currency utilities


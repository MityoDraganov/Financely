/**
 * Designer Properties Panel Design System
 * 
 * A comprehensive design system for consistent styling across all property panels.
 * This ensures visual hierarchy, readability, and professional UX.
 */

// Typography Scale
export const typography = {
  // Section Headers (Main category titles like "Text", "Table", "Watermark")
  sectionTitle: "text-sm font-semibold text-neutral-900 tracking-tight",
  
  // Subsection Headers (Grouped settings like "Typography", "Position")
  subsectionTitle: "text-xs font-medium text-neutral-700 uppercase tracking-wider",
  
  // Field Labels (Individual input labels)
  fieldLabel: "text-xs font-medium text-neutral-600",
  
  // Helper Text (Descriptions, hints)
  helperText: "text-[11px] text-neutral-500 leading-relaxed",
  
  // Error/Warning Text
  errorText: "text-[11px] font-medium text-amber-800",
  errorTextSecondary: "text-[11px] text-amber-700",
};

// Spacing Scale (using Tailwind's 4px base unit)
export const spacing = {
  // Panel container padding
  panelPadding: "p-4",
  
  // Section spacing (between major sections)
  sectionGap: "space-y-6",
  
  // Subsection spacing (within a section)
  subsectionGap: "space-y-4",
  
  // Field group spacing (related fields together)
  fieldGroupGap: "space-y-3",
  
  // Field spacing (label + input)
  fieldGap: "space-y-1.5",
  
  // Grid gaps
  gridGap: "gap-3",
  gridGapTight: "gap-2",
};

// Visual Separators
export const separators = {
  // Section divider (between major sections)
  sectionDivider: "border-t border-neutral-200 pt-6 mt-6",
  
  // Subsection divider (within a section)
  subsectionDivider: "border-t border-neutral-100 pt-4 mt-4",
  
  // Nested content indicator (for collapsible/conditional content)
  nestedContent: "pl-3 ml-3 border-l-2 border-neutral-200",
  
  // Accent border (for important/active sections)
  accentBorder: "pl-3 ml-3 border-l-2 border-blue-500",
};

// Component Styles
export const components = {
  // Section Container
  section: "space-y-4",
  
  // Subsection Container
  subsection: "space-y-3",
  
  // Field Container
  field: "space-y-1.5",
  
  // Grid Container (for multiple fields side by side)
  grid: "grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3",
  gridNarrow: "grid grid-cols-1 gap-3",
  
  // Input Heights (consistent across all inputs)
  inputHeight: "h-9",
  inputHeightSmall: "h-8",
  
  // Card/Group Container (for grouped related settings)
  card: "p-3 bg-neutral-50/50 rounded-md border border-neutral-200",
  
  // Highlighted Section (for important/active content)
  highlighted: "p-3 bg-blue-50/50 rounded-md border border-blue-200",
};

// Color Palette
export const colors = {
  // Text Colors
  textPrimary: "text-neutral-900",
  textSecondary: "text-neutral-600",
  textTertiary: "text-neutral-500",
  textMuted: "text-neutral-400",
  
  // Border Colors
  borderDefault: "border-neutral-200",
  borderLight: "border-neutral-100",
  borderAccent: "border-blue-500",
  
  // Background Colors
  bgDefault: "bg-neutral-50",
  bgCard: "bg-neutral-50/50",
  bgAccent: "bg-blue-50/50",
  bgWarning: "bg-amber-50/50",
  bgSuccess: "bg-green-50/50",
};

// Reusable Component Patterns
export const patterns = {
  // Section Header Pattern
  sectionHeader: (title: string) => (
    <h3 className={typography.sectionTitle}>{title}</h3>
  ),
  
  // Subsection Header Pattern
  subsectionHeader: (title: string) => (
    <h4 className={typography.subsectionTitle}>{title}</h4>
  ),
  
  // Field Label Pattern
  fieldLabel: (label: string, required?: boolean) => (
    <label className={typography.fieldLabel}>
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  ),
  
  // Helper Text Pattern
  helperText: (text: string) => (
    <p className={typography.helperText}>{text}</p>
  ),
};


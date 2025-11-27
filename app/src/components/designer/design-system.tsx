/**
 * Designer Properties Panel Design System
 * 
 * A comprehensive design system for consistent styling across all property panels.
 * This ensures visual hierarchy, readability, and professional UX.
 */

// Typography Scale
export const typography = {
  // Section Headers (Main category titles like "Text", "Table", "Watermark")
  sectionTitle: "text-sm font-semibold text-foreground tracking-tight",
  
  // Subsection Headers (Grouped settings like "Typography", "Position")
  subsectionTitle: "text-xs font-medium text-foreground/80 uppercase tracking-wider",
  
  // Field Labels (Individual input labels)
  fieldLabel: "text-xs font-medium text-foreground",
  
  // Helper Text (Descriptions, hints)
  helperText: "text-[11px] text-muted-foreground leading-relaxed",
  
  // Error/Warning Text
  errorText: "text-[11px] font-medium text-amber-800 dark:text-amber-400",
  errorTextSecondary: "text-[11px] text-amber-700 dark:text-amber-500",
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
  sectionDivider: "border-t border-border pt-6 mt-6",
  
  // Subsection divider (within a section)
  subsectionDivider: "border-t border-border/50 pt-4 mt-4",
  
  // Nested content indicator (for collapsible/conditional content)
  nestedContent: "pl-3 ml-3 border-l-2 border-border",
  
  // Accent border (for important/active sections)
  accentBorder: "pl-3 ml-3 border-l-2 border-primary",
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
  card: "p-3 bg-muted/50 rounded-md border border-border",
  
  // Highlighted Section (for important/active content)
  highlighted: "p-3 bg-primary/10 dark:bg-primary/20 rounded-md border border-primary/30 dark:border-primary/50",
};

// Color Palette
export const colors = {
  // Text Colors
  textPrimary: "text-foreground",
  textSecondary: "text-foreground/80",
  textTertiary: "text-muted-foreground",
  textMuted: "text-muted-foreground/70",
  
  // Border Colors
  borderDefault: "border-border",
  borderLight: "border-border/50",
  borderAccent: "border-primary",
  
  // Background Colors
  bgDefault: "bg-background",
  bgCard: "bg-muted/50",
  bgAccent: "bg-primary/10 dark:bg-primary/20",
  bgWarning: "bg-amber-50/50 dark:bg-amber-950/20",
  bgSuccess: "bg-green-50/50 dark:bg-green-950/20",
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
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  ),
  
  // Helper Text Pattern
  helperText: (text: string) => (
    <p className={typography.helperText}>{text}</p>
  ),
};


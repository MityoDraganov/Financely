/**
 * Design Token Service
 * 
 * Generates CSS design tokens from organization brand kit settings.
 * These tokens are used to theme generated sites consistently.
 */

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface BrandFonts {
  heading?: string;
  body?: string;
}

interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

/**
 * Generate design tokens from brand colors and fonts
 */
export function generateDesignTokens(
  brandColors: BrandColors,
  brandFonts?: BrandFonts,
): DesignTokens {
  // Calculate derived colors for better contrast and hierarchy
  const primary = brandColors.primary;
  const secondary = brandColors.secondary;
  const accent = brandColors.accent;

  // Generate text colors with proper contrast
  const text = "#111827"; // Dark gray for primary text
  const textMuted = "#6b7280"; // Medium gray for secondary text
  const background = "#ffffff"; // White background
  const surface = "#f9fafb"; // Light gray for surfaces
  const border = "#e5e7eb"; // Light border color

  // Semantic colors
  const error = "#ef4444"; // Red
  const success = accent || "#10b981"; // Use accent or default green
  const warning = "#f59e0b"; // Amber

  // Font stack
  const headingFont = brandFonts?.heading || "Inter, system-ui, sans-serif";
  const bodyFont = brandFonts?.body || "Inter, system-ui, sans-serif";
  const monoFont = "ui-monospace, 'Courier New', monospace";

  return {
    colors: {
      primary,
      secondary,
      accent,
      background,
      surface,
      text,
      textMuted,
      border,
      error,
      success,
      warning,
    },
    fonts: {
      heading: headingFont,
      body: bodyFont,
      mono: monoFont,
    },
    spacing: {
      xs: "0.25rem", // 4px
      sm: "0.5rem", // 8px
      md: "1rem", // 16px
      lg: "1.5rem", // 24px
      xl: "2rem", // 32px
      "2xl": "3rem", // 48px
      "3xl": "4rem", // 64px
    },
    radius: {
      sm: "0.375rem", // 6px
      md: "0.5rem", // 8px
      lg: "0.75rem", // 12px
      xl: "1rem", // 16px
      full: "9999px",
    },
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    },
  };
}

/**
 * Generate CSS file with design tokens as CSS custom properties
 */
export function generateTokensCSS(tokens: DesignTokens): string {
  return `:root {
  /* Colors */
  --color-primary: ${tokens.colors.primary};
  --color-secondary: ${tokens.colors.secondary};
  --color-accent: ${tokens.colors.accent};
  --color-background: ${tokens.colors.background};
  --color-surface: ${tokens.colors.surface};
  --color-text: ${tokens.colors.text};
  --color-text-muted: ${tokens.colors.textMuted};
  --color-border: ${tokens.colors.border};
  --color-error: ${tokens.colors.error};
  --color-success: ${tokens.colors.success};
  --color-warning: ${tokens.colors.warning};

  /* Typography */
  --font-heading: ${tokens.fonts.heading};
  --font-body: ${tokens.fonts.body};
  --font-mono: ${tokens.fonts.mono};

  /* Spacing */
  --spacing-xs: ${tokens.spacing.xs};
  --spacing-sm: ${tokens.spacing.sm};
  --spacing-md: ${tokens.spacing.md};
  --spacing-lg: ${tokens.spacing.lg};
  --spacing-xl: ${tokens.spacing.xl};
  --spacing-2xl: ${tokens.spacing["2xl"]};
  --spacing-3xl: ${tokens.spacing["3xl"]};

  /* Border Radius */
  --radius-sm: ${tokens.radius.sm};
  --radius-md: ${tokens.radius.md};
  --radius-lg: ${tokens.radius.lg};
  --radius-xl: ${tokens.radius.xl};
  --radius-full: ${tokens.radius.full};

  /* Shadows */
  --shadow-sm: ${tokens.shadows.sm};
  --shadow-md: ${tokens.shadows.md};
  --shadow-lg: ${tokens.shadows.lg};
  --shadow-xl: ${tokens.shadows.xl};
}

/* Utility classes using design tokens */
.text-primary { color: var(--color-primary); }
.text-secondary { color: var(--color-secondary); }
.text-accent { color: var(--color-accent); }
.bg-primary { background-color: var(--color-primary); }
.bg-secondary { background-color: var(--color-secondary); }
.bg-accent { background-color: var(--color-accent); }
.bg-surface { background-color: var(--color-surface); }
`;
}

/**
 * Generate base CSS with reset, typography, and layout utilities
 */
export function generateBaseCSS(): string {
  return `/* CSS Reset & Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-body, system-ui, sans-serif);
  color: var(--color-text, #111827);
  background-color: var(--color-background, #ffffff);
  line-height: 1.6;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 40%);
}

main {
  flex: 1;
  width: 100%;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading, system-ui, sans-serif);
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text, #111827);
  margin-bottom: var(--spacing-md, 1rem);
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.75rem; }
h4 { font-size: 1.5rem; }
h5 { font-size: 1.25rem; }
h6 { font-size: 1rem; }

p {
  margin-bottom: var(--spacing-md, 1rem);
  color: var(--color-text, #111827);
}

a {
  color: var(--color-primary, #2563eb);
  text-decoration: none;
  transition: opacity 0.2s;
}

a:hover {
  opacity: 0.8;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

ul, ol {
  margin-left: var(--spacing-lg, 1.5rem);
  margin-bottom: var(--spacing-md, 1rem);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm, 0.5rem) var(--spacing-lg, 1.5rem);
  font-weight: 600;
  border-radius: var(--radius-full, 9999px);
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary {
  background: var(--color-primary);
  color: #ffffff;
}

.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.05);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* Layout Utilities */
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-md, 1rem);
}

.section {
  padding: var(--spacing-3xl, 4rem) 0;
  position: relative;
}

.grid {
  display: grid;
  gap: var(--spacing-lg, 1.5rem);
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.flex {
  display: flex;
  gap: var(--spacing-md, 1rem);
  flex-wrap: wrap;
}

.section + .section {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* Hero */
.hero {
  position: relative;
  overflow: hidden;
  padding: var(--spacing-3xl, 4rem) 0;
  background: radial-gradient(circle at top right, rgba(255,255,255,0.8), rgba(255,255,255,0)) var(--color-primary);
  color: #ffffff;
}

.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top left, rgba(255,255,255,0.3), transparent 55%);
  pointer-events: none;
}

.hero .container {
  position: relative;
  z-index: 1;
}

.hero-eyebrow {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.8);
  margin-bottom: var(--spacing-sm);
}

.hero-actions {
  margin-top: var(--spacing-lg);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

/* Cards & Surfaces */
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-xl);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.feature-card {
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: rgba(0,0,0,0.05);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  margin-bottom: var(--spacing-md);
}

/* Stats */
.stat-card {
  text-align: center;
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: white;
  box-shadow: var(--shadow-sm);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  margin-top: var(--spacing-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}

/* Testimonials */
.testimonial {
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: white;
  box-shadow: var(--shadow-md);
}

.testimonial-quote {
  font-size: 1.125rem;
  font-style: italic;
  color: var(--color-text);
}

.testimonial-author {
  margin-top: var(--spacing-md);
  font-weight: 600;
}

.testimonial-role {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

/* Pricing */
.pricing-card {
  padding: var(--spacing-xl);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: var(--shadow-lg);
  background: linear-gradient(180deg, #ffffff 0%, #fdf2f8 100%);
}

.pricing-price {
  font-size: 3rem;
  font-weight: 700;
  margin: var(--spacing-md) 0;
}

.pricing-features {
  list-style: none;
  margin: var(--spacing-md) 0 0;
  padding: 0;
}

.pricing-features li {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  color: var(--color-text);
}

/* CTA section */
.cta-section {
  text-align: center;
  padding: var(--spacing-3xl);
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  box-shadow: var(--shadow-xl);
}

.cta-section p {
  color: rgba(255,255,255,0.85);
}

/* Footer */
footer {
  padding: var(--spacing-xl) 0;
  border-top: 1px solid rgba(0,0,0,0.08);
  background: #0f172a;
  color: rgba(255,255,255,0.7);
}

footer a {
  color: rgba(255,255,255,0.85);
}

/* Responsive */
@media (max-width: 768px) {
  h1 { font-size: 2rem; }
  h2 { font-size: 1.75rem; }
  h3 { font-size: 1.5rem; }
  
  .section {
    padding: var(--spacing-xl, 2rem) 0;
  }
  
  .container {
    padding: 0 var(--spacing-sm, 0.5rem);
  }
  
  .hero {
    padding: var(--spacing-2xl) 0;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .card-grid {
    grid-template-columns: 1fr;
  }
}
`;
}


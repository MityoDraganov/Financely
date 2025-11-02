import { Organization } from "@/core";

/**
 * Get the organization's custom logo URL or fallback to default
 */
export function getOrganizationLogo(organization?: Organization | null): string | null {
  if (organization?.settings?.branding?.customLogo) {
    return organization.settings.branding.customLogo;
  }
  return null;
}

/**
 * Get the organization's custom company name or fallback to "Financely"
 */
export function getOrganizationName(organization?: Organization | null): string {
  if (organization?.settings?.branding?.companyName) {
    return organization.settings.branding.companyName;
  }
  return "Financely";
}

/**
 * Get the organization's primary brand color or fallback to default
 */
export function getPrimaryColor(organization?: Organization | null): string {
  return organization?.settings?.brandColors?.primary || "#2563eb";
}

/**
 * Get the organization's secondary brand color or fallback to default
 */
export function getSecondaryColor(organization?: Organization | null): string {
  return organization?.settings?.brandColors?.secondary || "#6b7280";
}

/**
 * Get the organization's accent brand color or fallback to default
 */
export function getAccentColor(organization?: Organization | null): string {
  return organization?.settings?.brandColors?.accent || "#10b981";
}

/**
 * Get all brand colors as a CSS custom properties object
 */
export function getBrandColorsCSS(organization?: Organization | null): Record<string, string> {
  return {
    "--brand-primary": getPrimaryColor(organization),
    "--brand-secondary": getSecondaryColor(organization),
    "--brand-accent": getAccentColor(organization),
  };
}

/**
 * Apply brand colors to the document root as CSS custom properties
 */
export function applyBrandColors(organization?: Organization | null): void {
  const colors = getBrandColorsCSS(organization);
  const root = document.documentElement;
  
  Object.entries(colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  // Also update Tailwind primary/accent colors for shadcn components
  const primary = getPrimaryColor(organization);
  const accent = getAccentColor(organization);
  const secondary = getSecondaryColor(organization);
  
  // Convert hex to HSL for Tailwind compatibility
  const primaryHsl = hexToHsl(primary);
  const accentHsl = hexToHsl(accent);
  const secondaryHsl = hexToHsl(secondary);
  
  if (primaryHsl) {
    root.style.setProperty('--primary', `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
  }
  if (accentHsl) {
    root.style.setProperty('--accent-color', accent);
    root.style.setProperty('--light-accent-color', lightenColor(accent, 20));
  }
  if (secondaryHsl) {
    root.style.setProperty('--gray-color', secondary);
  }
}

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round((255 - (num >> 16)) * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * percent / 100));
  const b = Math.min(255, (num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Get the organization's favicon URL or fallback to default
 */
export function getOrganizationFavicon(organization?: Organization | null): string {
  if (organization?.settings?.branding?.customFavicon) {
    return organization.settings.branding.customFavicon;
  }
  return "/favicon.ico"; // Default favicon
}

/**
 * Apply organization favicon to the document
 */
export function applyOrganizationFavicon(organization?: Organization | null): void {
  const faviconUrl = getOrganizationFavicon(organization);
  
  // Remove existing favicon links
  const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
  existingFavicons.forEach(link => link.remove());
  
  // Add new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = faviconUrl;
  link.type = 'image/x-icon';
  document.head.appendChild(link);
}

/**
 * Get the organization's email from name or fallback to organization name
 */
export function getEmailFromName(organization?: Organization | null): string {
  if (organization?.settings?.branding?.emailFromName) {
    return organization.settings.branding.emailFromName;
  }
  return getOrganizationName(organization);
}

/**
 * Get the organization's email from address or fallback to default
 */
export function getEmailFromAddress(organization?: Organization | null): string {
  if (organization?.settings?.branding?.emailFromAddress) {
    return organization.settings.branding.emailFromAddress;
  }
  return "noreply@financely.app"; // Default email
}

/**
 * Get the organization's footer text or fallback to default
 */
export function getFooterText(organization?: Organization | null): string {
  if (organization?.settings?.branding?.footerText) {
    return organization.settings.branding.footerText;
  }
  return `© ${new Date().getFullYear()} ${getOrganizationName(organization)}. All rights reserved.`;
}

/**
 * Check if the organization has custom branding enabled
 */
export function hasCustomBranding(organization?: Organization | null): boolean {
  if (!organization?.settings) return false;
  
  const branding = organization.settings.branding;
  const brandColors = organization.settings.brandColors;
  
  return !!(
    branding?.customLogo ||
    branding?.companyName ||
    branding?.customFavicon ||
    (brandColors && (
      brandColors.primary !== "#2563eb" ||
      brandColors.secondary !== "#6b7280" ||
      brandColors.accent !== "#10b981"
    ))
  );
}

/**
 * Generate a gradient background using organization brand colors
 */
export function getBrandGradient(organization?: Organization | null): string {
  const primary = getPrimaryColor(organization);
  const secondary = getSecondaryColor(organization);
  
  return `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
}

/**
 * Get contrast color (black or white) for text on brand colors
 */
export function getContrastColor(hexColor: string): string {
  // Remove # if present
  const color = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

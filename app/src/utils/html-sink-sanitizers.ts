import { sanitizeHtml, sanitizeTranslationHtml } from "./html-sanitizer";

const toKebabCaseCssProperty = (property: string): string =>
  property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

const normalizeInlineStylePropertyNames = (html: string): string => {
  if (!html || !html.includes("style=")) return html;

  const normalizeStyleValue = (styleValue: string): string =>
    styleValue.replace(/(^|;)\s*([a-z][a-zA-Z0-9]*)\s*:/g, (_full, prefix: string, prop: string) => {
      if (prop.startsWith("--") || prop.includes("-")) {
        return `${prefix}${prop}:`;
      }
      return `${prefix}${toKebabCaseCssProperty(prop)}:`;
    });

  return html.replace(/style\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote: string, styleValue: string) => {
    const normalized = normalizeStyleValue(styleValue);
    return `style=${quote}${normalized}${quote}`;
  });
};

export function sanitizeWidgetHeadlineHtml(headline: string | null | undefined): string {
  return sanitizeTranslationHtml(headline ?? "");
}

export function sanitizeEmailPreviewHtml(html: string | null | undefined): string {
  const normalized = normalizeInlineStylePropertyNames(html ?? "");
  return sanitizeHtml(normalized, {
    mode: "moderate",
    allowedAttributes: ["style", "target", "rel"],
  });
}


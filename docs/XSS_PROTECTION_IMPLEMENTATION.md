# XSS Protection Implementation

## Overview

This document describes the HTML sanitization implementation that protects the Financely application from Cross-Site Scripting (XSS) attacks.

## Implementation Date

January 2025

## Problem Statement

The application previously used `dangerouslySetInnerHTML` in multiple components without sanitization, creating XSS vulnerabilities. HTML content from the following sources could potentially execute malicious scripts:

- Translation strings (i18n)
- Email designer templates and blocks
- AI-generated or user-generated site builder content

## Solution

A centralized HTML sanitization utility was implemented using DOMPurify, a battle-tested HTML sanitization library.

### Key Components

1. **Centralized Sanitization Utility** (`app/src/utils/html-sanitizer.ts`)
   - Provides three sanitization modes: `strict`, `moderate`, and `permissive`
   - Specialized functions for different content types:
     - `sanitizeEmailHtml()` - For email designer content
     - `sanitizeSiteBuilderHtml()` - For site builder content
     - `sanitizeTranslationHtml()` - For translation strings
   - Configurable allowed tags and attributes

2. **Updated Components**
   - `app/src/components/onboarding/onboarding-flow.tsx` (4 usages)
   - `app/src/components/email-designer/email-designer-canvas.tsx` (2 usages)
   - `app/src/components/site-builder/ai-chat-builder.tsx` (2 usages)

3. **Unit Tests** (`app/src/utils/html-sanitizer.test.ts`)
   - Comprehensive test coverage for XSS prevention
   - Tests for various attack vectors
   - Edge case handling

## Security Guarantees

The sanitization utility ensures:

✅ **Script tags are stripped** - No `<script>` tags can execute  
✅ **Event handlers are removed** - `onclick`, `onerror`, `onload`, etc. are stripped  
✅ **JavaScript URLs are blocked** - `javascript:` and dangerous `data:` URLs are removed  
✅ **Dangerous elements are forbidden** - `iframe`, `embed`, `object`, `form` are stripped  
✅ **Safe formatting is preserved** - Paragraphs, lists, links, and basic formatting work correctly  

## Usage Guidelines

### For Translation Strings

```tsx
import { sanitizeTranslationHtml } from "@/utils/html-sanitizer";

<p dangerouslySetInnerHTML={{ 
  __html: sanitizeTranslationHtml(t("translation.key")) 
}} />
```

### For Email Designer Content

```tsx
import { sanitizeEmailHtml } from "@/utils/html-sanitizer";

<div dangerouslySetInnerHTML={{ 
  __html: sanitizeEmailHtml(emailBlock.content) 
}} />
```

### For Site Builder Content

```tsx
import { sanitizeSiteBuilderHtml } from "@/utils/html-sanitizer";

<div dangerouslySetInnerHTML={{ 
  __html: sanitizeSiteBuilderHtml(aiGeneratedHtml) 
}} />
```

### For Custom Use Cases

```tsx
import { sanitizeHtml } from "@/utils/html-sanitizer";

// Strict mode (default) - for untrusted content
const safe = sanitizeHtml(userHtml, { mode: "strict" });

// Moderate mode - for translation/CMS content
const safe = sanitizeHtml(cmsHtml, { mode: "moderate" });

// With custom allowed tags
const safe = sanitizeHtml(html, { 
  mode: "strict",
  allowedTags: ["custom-tag"],
  allowedAttributes: ["data-custom"]
});
```

## Critical Rules

⚠️ **NEVER use `dangerouslySetInnerHTML` without sanitization**

❌ **BAD:**
```tsx
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

✅ **GOOD:**
```tsx
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
```

## Sanitization Modes

### Strict Mode (Default)
- **Use for:** User-generated content, AI-generated content, email designer, site builder
- **Removes:** Scripts, iframes, embeds, event handlers, JavaScript URLs
- **Allows:** Basic formatting tags (p, div, span, strong, em, lists, links, tables)

### Moderate Mode
- **Use for:** Translation strings, CMS content (trusted but may contain HTML)
- **Removes:** Scripts, event handlers, JavaScript URLs
- **Allows:** Everything in strict mode, plus images, sub/sup, mark, del/ins

### Permissive Mode
- **Use for:** Known-safe internal content (use with extreme caution)
- **Removes:** Only scripts and event handlers
- **Allows:** Most HTML tags except dangerous ones

## Testing

Run the sanitization tests:

```bash
npm test html-sanitizer.test.ts
```

The test suite covers:
- Basic functionality
- XSS prevention (scripts, event handlers, JavaScript URLs)
- Safe HTML preservation
- Edge cases and malformed HTML
- Real-world attack vectors

## Maintenance

### Adding New `dangerouslySetInnerHTML` Usage

1. **Always** import the appropriate sanitization function
2. **Always** sanitize the HTML before passing to `dangerouslySetInnerHTML`
3. **Add a comment** noting that HTML is sanitized:
   ```tsx
   {/* HTML is sanitized before rendering to prevent XSS */}
   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
   ```

### Updating Sanitization Rules

If you need to allow additional tags or attributes:

1. Update the appropriate configuration in `html-sanitizer.ts`
2. Add tests to verify the new tags/attributes work correctly
3. Document the change and security implications
4. Consider if the change applies to all modes or just specific ones

### Security Review Checklist

When reviewing code that uses `dangerouslySetInnerHTML`:

- [ ] Is the HTML being sanitized?
- [ ] Is the correct sanitization function being used for the content type?
- [ ] Is the sanitization mode appropriate for the trust level of the content?
- [ ] Are there any code paths that bypass sanitization?
- [ ] Have edge cases been considered (null, undefined, empty strings)?

## Known Limitations

1. **DOMPurify runs in the browser** - Server-side rendering (SSR) would need a Node.js version of DOMPurify
2. **Style-based XSS** - Some CSS-based attacks may still be possible, but JavaScript execution is prevented
3. **Content Security Policy (CSP)** - Consider implementing CSP headers as an additional layer of defense

## Future Improvements

- [ ] Add ESLint rule to detect unsanitized `dangerouslySetInnerHTML` usage
- [ ] Implement server-side sanitization for SSR scenarios
- [ ] Add Content Security Policy (CSP) headers
- [ ] Regular security audits of sanitization rules
- [ ] Automated security scanning in CI/CD pipeline

## References

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)


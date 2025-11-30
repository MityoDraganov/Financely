import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  sanitizeEmailHtml,
  sanitizeSiteBuilderHtml,
  sanitizeTranslationHtml,
} from "./html-sanitizer";

describe("sanitizeHtml", () => {
  describe("Basic functionality", () => {
    it("should return empty string for null/undefined input", () => {
      expect(sanitizeHtml(null)).toBe("");
      expect(sanitizeHtml(undefined)).toBe("");
      expect(sanitizeHtml("")).toBe("");
    });

    it("should preserve plain text", () => {
      const input = "Hello, world!";
      const output = sanitizeHtml(input);
      expect(output).toBe(input);
    });

    it("should preserve safe HTML tags", () => {
      const input = "<p>Hello <strong>world</strong>!</p>";
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).toContain("<p>");
      expect(output).toContain("<strong>");
      expect(output).toContain("Hello");
      expect(output).toContain("world");
    });
  });

  describe("XSS prevention - Script tags", () => {
    it("should strip script tags", () => {
      const input = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("<script>");
      expect(output).not.toContain("alert");
      expect(output).toContain("<p>Hello</p>");
      expect(output).toContain("<p>World</p>");
    });

    it("should strip script tags with src attribute", () => {
      const input = '<script src="https://evil.com/script.js"></script><p>Content</p>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("<script");
      expect(output).toContain("<p>Content</p>");
    });

    it("should strip inline script in event handlers", () => {
      const input = '<p onclick="alert(\'XSS\')">Click me</p>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("onclick");
      expect(output).not.toContain("alert");
      expect(output).toContain("<p>");
      expect(output).toContain("Click me");
    });

    it("should strip multiple event handlers", () => {
      const input = '<div onerror="evil()" onload="evil()" onclick="evil()">Content</div>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("onerror");
      expect(output).not.toContain("onload");
      expect(output).not.toContain("onclick");
      expect(output).toContain("Content");
    });
  });

  describe("XSS prevention - JavaScript URLs", () => {
    it("should strip javascript: protocol in href", () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const output = sanitizeHtml(input, { mode: "strict" });
      // DOMPurify should remove or sanitize the javascript: URL
      expect(output).not.toContain("javascript:");
      expect(output).not.toContain("alert");
    });

    it("should strip data: URLs with scripts", () => {
      const input = '<img src="data:text/html,<script>alert(\'XSS\')</script>">';
      const output = sanitizeHtml(input, { mode: "strict" });
      // In strict mode, img tags may not be allowed, but data: URLs should be stripped
      expect(output).not.toContain("data:text/html");
    });
  });

  describe("XSS prevention - iframe and embed", () => {
    it("should strip iframe tags", () => {
      const input = '<iframe src="https://evil.com"></iframe><p>Content</p>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("<iframe");
      expect(output).toContain("<p>Content</p>");
    });

    it("should strip embed tags", () => {
      const input = '<embed src="evil.swf"><p>Content</p>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("<embed");
      expect(output).toContain("<p>Content</p>");
    });

    it("should strip object tags", () => {
      const input = '<object data="evil.swf"></object><p>Content</p>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("<object");
      expect(output).toContain("<p>Content</p>");
    });
  });

  describe("Safe HTML preservation", () => {
    it("should preserve paragraph tags", () => {
      const input = "<p>Hello world</p>";
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).toContain("<p>");
      expect(output).toContain("Hello world");
    });

    it("should preserve formatting tags", () => {
      const input = "<p>Hello <strong>bold</strong> and <em>italic</em> text</p>";
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).toContain("<strong>");
      expect(output).toContain("<em>");
      expect(output).toContain("bold");
      expect(output).toContain("italic");
    });

    it("should preserve links with safe URLs", () => {
      const input = '<a href="https://example.com">Link</a>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).toContain("<a");
      expect(output).toContain("href");
      expect(output).toContain("https://example.com");
      expect(output).toContain("Link");
    });

    it("should preserve lists", () => {
      const input = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).toContain("<ul>");
      expect(output).toContain("<li>");
      expect(output).toContain("Item 1");
      expect(output).toContain("Item 2");
    });
  });

  describe("Sanitization modes", () => {
    it("should be more restrictive in strict mode", () => {
      const input = '<img src="image.jpg" alt="Image">';
      const moderateOutput = sanitizeHtml(input, { mode: "moderate" });
      expect(moderateOutput).toContain("<img");
    });

    it("should allow more tags in moderate mode", () => {
      const input = '<img src="image.jpg"><sub>subscript</sub><sup>superscript</sup>';
      const moderateOutput = sanitizeHtml(input, { mode: "moderate" });
      expect(moderateOutput).toContain("<img");
      expect(moderateOutput).toContain("<sub>");
      expect(moderateOutput).toContain("<sup>");
    });
  });

  describe("Edge cases", () => {
    it("should handle malformed HTML gracefully", () => {
      const input = "<p>Unclosed tag<div>Nested</p>";
      const output = sanitizeHtml(input, { mode: "strict" });
      // Should not throw, should return sanitized HTML
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);
    });

    it("should handle empty tags", () => {
      const input = "<p></p><div></div>";
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).toContain("<p>");
      expect(output).toContain("<div>");
    });

    it("should handle nested dangerous content", () => {
      const input = '<div><p><script>alert("XSS")</script></p></div>';
      const output = sanitizeHtml(input, { mode: "strict" });
      expect(output).not.toContain("<script>");
      expect(output).not.toContain("alert");
    });

    it("should handle HTML entities", () => {
      const input = "<p>&lt;script&gt;alert('XSS')&lt;/script&gt;</p>";
      const output = sanitizeHtml(input, { mode: "strict" });
      // Entities should be preserved or decoded safely
      expect(output).toContain("&lt;");
      expect(output).not.toContain("<script>");
    });
  });

  describe("Custom allowed tags and attributes", () => {
    it("should allow custom tags when specified", () => {
      const input = '<custom-tag>Content</custom-tag>';
      const output = sanitizeHtml(input, {
        mode: "strict",
        allowedTags: ["custom-tag"],
      });
      expect(output).toContain("<custom-tag>");
    });

    it("should allow custom attributes when specified", () => {
      const input = '<div data-custom="value">Content</div>';
      const output = sanitizeHtml(input, {
        mode: "strict",
        allowedAttributes: ["data-custom"],
      });
      expect(output).toContain("data-custom");
      expect(output).toContain("value");
    });
  });
});

describe("sanitizeEmailHtml", () => {
  it("should sanitize email HTML content", () => {
    const input = '<p>Email content</p><script>alert("XSS")</script>';
    const output = sanitizeEmailHtml(input);
    expect(output).toContain("<p>Email content</p>");
    expect(output).not.toContain("<script>");
  });

  it("should allow email-specific tags", () => {
    const input = '<table><tr><td>Cell</td></tr></table>';
    const output = sanitizeEmailHtml(input);
    expect(output).toContain("<table>");
    expect(output).toContain("<tr>");
    expect(output).toContain("<td>");
  });
});

describe("sanitizeSiteBuilderHtml", () => {
  it("should sanitize site builder HTML content", () => {
    const input = '<div>Site content</div><script>alert("XSS")</script>';
    const output = sanitizeSiteBuilderHtml(input);
    expect(output).toContain("<div>Site content</div>");
    expect(output).not.toContain("<script>");
  });

  it("should use strict mode for site builder", () => {
    const input = '<img src="image.jpg">';
    const output = sanitizeSiteBuilderHtml(input);
    // In strict mode, img may not be allowed
    expect(output).not.toContain("<img");
  });
});

describe("sanitizeTranslationHtml", () => {
  it("should sanitize translation HTML content", () => {
    const input = '<p>Translation text</p><script>alert("XSS")</script>';
    const output = sanitizeTranslationHtml(input);
    expect(output).toContain("<p>Translation text</p>");
    expect(output).not.toContain("<script>");
  });

  it("should use moderate mode for translations", () => {
    const input = '<img src="image.jpg" alt="Image">';
    const output = sanitizeTranslationHtml(input);
    // In moderate mode, img should be allowed
    expect(output).toContain("<img");
  });
});

describe("Real-world XSS attack vectors", () => {
  it("should prevent classic XSS payload", () => {
    const input = '<img src=x onerror=alert("XSS")>';
    const output = sanitizeHtml(input, { mode: "strict" });
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("alert");
  });

  it("should prevent SVG-based XSS", () => {
    const input = '<svg><script>alert("XSS")</script></svg>';
    const output = sanitizeHtml(input, { mode: "strict" });
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("alert");
  });

  it("should prevent encoded XSS attempts", () => {
    const input = '<img src="x" onerror="&#97;lert(\'XSS\')">';
    const output = sanitizeHtml(input, { mode: "strict" });
    expect(output).not.toContain("onerror");
    expect(output).not.toContain("alert");
  });

  it("should prevent style-based XSS", () => {
    const input = '<div style="background:url(\'javascript:alert("XSS")\')">Content</div>';
    const output = sanitizeHtml(input, { mode: "strict" });
    // In strict mode, style attribute is removed entirely to prevent CSS-based XSS
    // This is safer than trying to sanitize CSS content
    expect(output).not.toContain("style");
    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("alert");
    expect(output).toContain("Content");
  });
});


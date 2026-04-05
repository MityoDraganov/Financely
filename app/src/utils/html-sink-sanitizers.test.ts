import { describe, expect, it } from "vitest";
import {
  sanitizeEmailPreviewHtml,
  sanitizeWidgetHeadlineHtml,
} from "./html-sink-sanitizers";

describe("html sink sanitizers", () => {
  describe("sanitizeWidgetHeadlineHtml", () => {
    it("removes script tags and inline handlers while preserving safe formatting", () => {
      const input =
        '<em>Almost ready</em><script>alert("xss")</script><img src="x" onerror="alert(1)">';

      const output = sanitizeWidgetHeadlineHtml(input);

      expect(output).toContain("<em>Almost ready</em>");
      expect(output).not.toContain("<script");
      expect(output).not.toContain("onerror");
      expect(output).not.toContain("alert(");
    });
  });

  describe("sanitizeEmailPreviewHtml", () => {
    it("sanitizes dangerous HTML in email preview sink", () => {
      const input =
        '<div onclick="alert(1)" style="fontSize:16px;color:red">Hello</div><script>alert(2)</script>';

      const output = sanitizeEmailPreviewHtml(input);

      expect(output).toContain("Hello");
      expect(output).not.toContain("<script");
      expect(output).not.toContain("onclick");
      expect(output).not.toContain("alert(");
    });

    it("normalizes camelCase inline style property names before sanitization", () => {
      const input = '<p style="fontSize:14px;lineHeight:20px">Body</p>';
      const output = sanitizeEmailPreviewHtml(input);

      expect(output).toContain("font-size");
      expect(output).toContain("line-height");
      expect(output).not.toContain("fontSize");
      expect(output).not.toContain("lineHeight");
    });

    it("strips javascript: URLs", () => {
      const input = '<a href="javascript:alert(1)" style="color:red">Click</a>';
      const output = sanitizeEmailPreviewHtml(input);

      expect(output).toContain("Click");
      expect(output).not.toContain("javascript:");
      expect(output).not.toContain("alert(");
    });
  });
});


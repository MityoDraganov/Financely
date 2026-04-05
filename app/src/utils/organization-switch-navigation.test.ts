import { describe, expect, it } from "vitest";
import { getPostOrganizationSwitchRedirect } from "./organization-switch-navigation";

describe("getPostOrganizationSwitchRedirect", () => {
  it("redirects known detail routes to their list routes", () => {
    expect(getPostOrganizationSwitchRedirect("/invoices/abc")).toBe("/invoices");
    expect(getPostOrganizationSwitchRedirect("/contacts/abc")).toBe("/contacts");
    expect(getPostOrganizationSwitchRedirect("/products/abc")).toBe("/products");
    expect(getPostOrganizationSwitchRedirect("/proposals/abc")).toBe("/proposals");
    expect(getPostOrganizationSwitchRedirect("/workflows/abc")).toBe("/workflows");
    expect(getPostOrganizationSwitchRedirect("/integrations/abc")).toBe("/integrations");
  });

  it("redirects widget-builder detail route to integrations list", () => {
    expect(getPostOrganizationSwitchRedirect("/integrations/widget-builder/abc")).toBe(
      "/integrations",
    );
  });

  it("returns null for non-detail routes", () => {
    expect(getPostOrganizationSwitchRedirect("/invoices")).toBeNull();
    expect(getPostOrganizationSwitchRedirect("/dashboard")).toBeNull();
    expect(getPostOrganizationSwitchRedirect("/settings/organization/general")).toBeNull();
    expect(getPostOrganizationSwitchRedirect("")).toBeNull();
  });
});


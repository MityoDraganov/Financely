type RouteRedirectRule = {
  pattern: RegExp;
  redirectTo: string;
};

const DETAIL_ROUTE_REDIRECT_RULES: RouteRedirectRule[] = [
  { pattern: /^\/invoices\/[^/]+$/, redirectTo: "/invoices" },
  { pattern: /^\/contacts\/[^/]+$/, redirectTo: "/contacts" },
  { pattern: /^\/products\/[^/]+$/, redirectTo: "/products" },
  { pattern: /^\/proposals\/[^/]+$/, redirectTo: "/proposals" },
  { pattern: /^\/workflows\/[^/]+$/, redirectTo: "/workflows" },
  { pattern: /^\/integrations\/[^/]+$/, redirectTo: "/integrations" },
  { pattern: /^\/integrations\/widget-builder\/[^/]+$/, redirectTo: "/integrations" },
];

export function getPostOrganizationSwitchRedirect(pathname: string): string | null {
  if (!pathname) return null;

  const matchedRule = DETAIL_ROUTE_REDIRECT_RULES.find((rule) =>
    rule.pattern.test(pathname),
  );

  if (!matchedRule) return null;
  if (matchedRule.redirectTo === pathname) return null;

  return matchedRule.redirectTo;
}


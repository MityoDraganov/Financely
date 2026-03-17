export const APP_ORIGIN = "https://financely.app";

export function getAppOrigin(): string {
  const configured = process.env.APP_URL?.trim();
  if (!configured) return APP_ORIGIN;
  return configured.replace(/\/+$/, "");
}

export function buildAppUrl(path: string): string {
  const base = getAppOrigin();
  if (!path) return base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

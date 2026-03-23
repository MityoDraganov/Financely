type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type QrFormat = "png" | "svg";

function normalizeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  return color.trim().replace(/^#/, "") || fallback;
}

export function buildQrCodeServerUrl(
  value: string,
  options?: {
    size?: number;
    level?: ErrorCorrectionLevel;
    marginSize?: number;
    includeMargin?: boolean;
    format?: QrFormat;
    bgColor?: string;
    fgColor?: string;
  },
): string {
  const size = options?.size ?? 256;
  const level = options?.level ?? "M";
  const qzone = options?.marginSize ?? (options?.includeMargin ? 4 : 0);
  const format = options?.format ?? "svg";
  const bgColor = normalizeColor(options?.bgColor, "ffffff");
  const fgColor = normalizeColor(options?.fgColor, "000000");

  const url = new URL("https://api.qrserver.com/v1/create-qr-code/");
  url.searchParams.set("size", `${size}x${size}`);
  url.searchParams.set("ecc", level);
  url.searchParams.set("format", format);
  url.searchParams.set("qzone", String(qzone));
  url.searchParams.set("color", fgColor);
  url.searchParams.set("bgcolor", bgColor);
  url.searchParams.set("data", value);
  return url.toString();
}

const URL_SEPARATOR_PATTERN = /[\s,]+/;

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[)\],.;!?]+$/g, "");
}

export function extractUrls(value: string): string[] {
  if (!value) {
    return [];
  }
  const seen = new Set<string>();
  value
    .split(URL_SEPARATOR_PATTERN)
    .map((part) => trimTrailingPunctuation(part.trim()))
    .forEach((part) => {
      if (!part) {
        return;
      }
      if (part.startsWith("http://") || part.startsWith("https://")) {
        seen.add(part);
      }
    });
  return Array.from(seen);
}

export function getFileLabelFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastSegment = pathname.split("/").pop();
    if (!lastSegment) {
      return url;
    }
    return decodeURIComponent(lastSegment);
  } catch {
    return url;
  }
}

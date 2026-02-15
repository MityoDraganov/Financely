import { logger } from "firebase-functions";
import type { DocumentPage, FontMatch, VisionLayout, VisionStyleCluster } from "./pipeline-types";

export type FontMatchingInput = {
  pages: DocumentPage[];
  visionLayout: VisionLayout;
};

export interface FontMatchingService {
  matchFonts(input: FontMatchingInput): Promise<FontMatch[]>;
}

class DefaultFontMatchingService implements FontMatchingService {
  async matchFonts(input: FontMatchingInput): Promise<FontMatch[]> {
    if (input.visionLayout.styleClusters.length === 0) {
      return [];
    }

    const apiUrl = process.env.FONT_MATCH_API_URL;
    const apiKey = process.env.FONT_MATCH_API_KEY;

    if (apiUrl && apiKey) {
      try {
        const externalMatches = await this.matchWithExternalApi(apiUrl, apiKey, input);
        if (externalMatches.length > 0) {
          return externalMatches;
        }
      } catch (error) {
        logger.warn("External font matching failed, using fallback", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return input.visionLayout.styleClusters.map((cluster) => fallbackMatch(cluster));
  }

  private async matchWithExternalApi(
    apiUrl: string,
    apiKey: string,
    input: FontMatchingInput
  ): Promise<FontMatch[]> {
    const payload = {
      pages: input.pages.map((page) => ({
        pageIndex: page.pageIndex,
        imageUrl: page.imageUrl,
      })),
      styleClusters: input.visionLayout.styleClusters.map((cluster) => ({
        id: cluster.id,
        fontFamilyHint: cluster.fontFamilyHint,
        fontWeightHint: cluster.fontWeightHint,
        fontSizePx: cluster.fontSizePx,
        color: cluster.color,
        sampleTexts: cluster.sampleTexts.slice(0, 6),
      })),
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Font API error ${response.status}: ${body}`);
    }

    const result = await response.json() as {
      matches?: Array<{
        clusterId?: string;
        fontFamily?: string;
        fallbackFont?: string;
        confidence?: number;
        raw?: Record<string, unknown>;
      }>;
    };

    const matches = Array.isArray(result.matches) ? result.matches : [];
    const normalized: FontMatch[] = [];

    for (const cluster of input.visionLayout.styleClusters) {
      const candidate = matches.find((match) => match.clusterId === cluster.id);
      if (!candidate || !candidate.fontFamily) {
        normalized.push(fallbackMatch(cluster));
        continue;
      }

      normalized.push({
        clusterId: cluster.id,
        provider: "external_api",
        matchedFont: candidate.fontFamily,
        fallbackFont: candidate.fallbackFont || mapFontToFallback(candidate.fontFamily),
        confidence: clamp(typeof candidate.confidence === "number" ? candidate.confidence : 0.7),
        raw: candidate.raw,
      });
    }

    return normalized;
  }
}

function fallbackMatch(cluster: VisionStyleCluster): FontMatch {
  const descriptor = `${cluster.fontFamilyHint || ""} ${cluster.fontWeightHint || ""} ${cluster.sampleTexts.join(" ")}`.toLowerCase();

  const guessedFont = guessFontFamily(descriptor);
  return {
    clusterId: cluster.id,
    provider: "fallback",
    matchedFont: guessedFont,
    fallbackFont: mapFontToFallback(guessedFont),
    confidence: 0.55,
  };
}

function guessFontFamily(descriptor: string): string {
  if (descriptor.includes("times") || descriptor.includes("serif") || descriptor.includes("garamond")) {
    return "Times New Roman";
  }
  if (descriptor.includes("mono") || descriptor.includes("courier") || descriptor.includes("code")) {
    return "Courier New";
  }
  if (descriptor.includes("condensed") || descriptor.includes("narrow")) {
    return "Arial Narrow";
  }
  if (descriptor.includes("georgia")) {
    return "Georgia";
  }
  if (descriptor.includes("helvetica")) {
    return "Helvetica";
  }
  if (descriptor.includes("roboto")) {
    return "Roboto";
  }
  return "Inter";
}

function mapFontToFallback(fontFamily: string): string {
  const normalized = fontFamily.toLowerCase();
  if (normalized.includes("times") || normalized.includes("georgia") || normalized.includes("garamond")) {
    return "Georgia, 'Times New Roman', serif";
  }
  if (normalized.includes("courier") || normalized.includes("mono")) {
    return "'Courier New', Courier, monospace";
  }
  if (normalized.includes("helvetica") || normalized.includes("arial")) {
    return "Arial, Helvetica, sans-serif";
  }
  if (normalized.includes("roboto")) {
    return "Roboto, Arial, sans-serif";
  }
  if (normalized.includes("inter")) {
    return "Inter, Arial, sans-serif";
  }
  return "Inter, Arial, sans-serif";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

let fontMatchingServiceInstance: FontMatchingService | null = null;

export function getFontMatchingService(): FontMatchingService {
  if (!fontMatchingServiceInstance) {
    fontMatchingServiceInstance = new DefaultFontMatchingService();
  }
  return fontMatchingServiceInstance;
}

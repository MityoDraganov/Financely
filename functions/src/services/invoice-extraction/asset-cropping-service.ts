import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer";
import type { BoundingBox, DocumentPage, VisionLayout } from "./pipeline-types";

export type CroppedAsset = {
  id: string;
  pageIndex: number;
  kind: "logo" | "image";
  imageUrl: string;
  boundingBox: BoundingBox;
  confidence: number;
};

export type AssetCroppingInput = {
  orgId: string;
  jobId: string;
  pages: DocumentPage[];
  visionLayout: VisionLayout;
  maxAssets?: number;
};

export interface AssetCroppingService {
  cropAssets(input: AssetCroppingInput): Promise<CroppedAsset[]>;
}

class DefaultAssetCroppingService implements AssetCroppingService {
  async cropAssets(input: AssetCroppingInput): Promise<CroppedAsset[]> {
    const maxAssets = Math.max(0, Math.min(input.maxAssets ?? 8, 20));
    const candidates = input.visionLayout.elements
      .filter((element) => (element.kind === "logo" || element.kind === "image") && element.confidence >= 0.3)
      .slice(0, maxAssets);

    if (candidates.length === 0) {
      return [];
    }

    const storage = getStorage();
    const bucket = storage.bucket();

    let browser: Browser | null = null;
    const croppedAssets: CroppedAsset[] = [];

    try {
      const executablePath = await chromium.executablePath();
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        executablePath,
        headless: true,
      });

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const pageModel = input.pages.find((page) => page.pageIndex === candidate.pageIndex);
        if (!pageModel) continue;

        try {
          const clip = normalizeClip(candidate.boundingBox, pageModel.width, pageModel.height);
          if (!clip) continue;

          const imageBuffer = await this.captureClip(browser, pageModel, clip);

          const storagePath = `organizations/${input.orgId}/invoice-extractions/${input.jobId}/assets/${candidate.id}-${index + 1}.png`;
          const storageFile = bucket.file(storagePath);
          await storageFile.save(imageBuffer, {
            metadata: {
              contentType: "image/png",
              metadata: {
                source: "asset_cropping",
                jobId: input.jobId,
                pageIndex: String(candidate.pageIndex),
                candidateId: candidate.id,
              },
            },
          });
          await storageFile.makePublic();

          croppedAssets.push({
            id: candidate.id,
            pageIndex: candidate.pageIndex,
            kind: candidate.kind === "logo" ? "logo" : "image",
            imageUrl: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
            boundingBox: clip,
            confidence: candidate.confidence,
          });
        } catch (error) {
          logger.warn("Failed to crop candidate asset", {
            candidateId: candidate.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return croppedAssets;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async captureClip(
    browser: Browser,
    pageModel: DocumentPage,
    clip: BoundingBox
  ): Promise<Buffer> {
    const page = await browser.newPage();

    try {
      const viewportWidth = Math.max(400, Math.min(3000, Math.round(pageModel.width)));
      const viewportHeight = Math.max(400, Math.min(4000, Math.round(pageModel.height)));

      await page.setViewport({
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: 1,
      });

      const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fff;overflow:hidden;">
    <img src="${pageModel.imageUrl}" style="width:${viewportWidth}px;height:${viewportHeight}px;display:block;object-fit:fill;" />
  </body>
</html>`;

      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: 120000,
      });

      await sleep(120);

      const screenshot = await page.screenshot({
        type: "png",
        clip: {
          x: clip.x,
          y: clip.y,
          width: clip.width,
          height: clip.height,
        },
      });

      return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  }
}

function normalizeClip(
  box: BoundingBox,
  pageWidth: number,
  pageHeight: number
): BoundingBox | null {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.max(0, Math.floor(box.width));
  const height = Math.max(0, Math.floor(box.height));

  if (width < 24 || height < 24) return null;
  if (x >= pageWidth || y >= pageHeight) return null;

  const clampedWidth = Math.min(width, Math.floor(pageWidth - x));
  const clampedHeight = Math.min(height, Math.floor(pageHeight - y));

  if (clampedWidth < 24 || clampedHeight < 24) return null;

  return {
    x,
    y,
    width: clampedWidth,
    height: clampedHeight,
  };
}

let assetCroppingServiceInstance: AssetCroppingService | null = null;

export function getAssetCroppingService(): AssetCroppingService {
  if (!assetCroppingServiceInstance) {
    assetCroppingServiceInstance = new DefaultAssetCroppingService();
  }
  return assetCroppingServiceInstance;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer";
import type { DocumentPage } from "./pipeline-types";

export type RenderPdfPagesInput = {
  fileUrl: string;
  orgId: string;
  jobId: string;
  maxPages?: number;
};

export interface PdfPageRendererService {
  renderPages(input: RenderPdfPagesInput): Promise<DocumentPage[]>;
}

class DefaultPdfPageRendererService implements PdfPageRendererService {
  async renderPages(input: RenderPdfPagesInput): Promise<DocumentPage[]> {
    const maxPages = Math.max(1, Math.min(input.maxPages ?? 5, 5));
    const storage = getStorage();
    const bucket = storage.bucket();

    let browser: Browser | null = null;

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

      const page = await browser.newPage();
      const viewportWidth = 1240;
      const viewportHeight = 1754;

      await page.setViewport({
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: 1,
      });

      await page.goto(input.fileUrl, {
        waitUntil: "networkidle2",
        timeout: 120000,
      });

      await sleep(900);

      const pages: DocumentPage[] = [];

      for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        await page.evaluate((params: { pageIndex: number; viewportHeight: number }) => {
          const g = globalThis as { scrollTo: (x: number, y: number) => void };
          g.scrollTo(0, params.pageIndex * params.viewportHeight);
        }, { pageIndex, viewportHeight });

        await sleep(180);

        const screenshot = await page.screenshot({
          type: "png",
          fullPage: false,
        });

        const storagePath = `organizations/${input.orgId}/invoice-extractions/${input.jobId}/rendered-pages/page-${pageIndex + 1}.png`;
        const file = bucket.file(storagePath);

        await file.save(screenshot, {
          metadata: {
            contentType: "image/png",
            metadata: {
              source: "pdf_page_renderer",
              pageIndex: String(pageIndex),
              jobId: input.jobId,
            },
          },
        });

        await file.makePublic();

        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

        pages.push({
          pageIndex,
          width: viewportWidth,
          height: viewportHeight,
          imageUrl,
          mimeType: "image/png",
          source: "rendered_pdf",
        });

        const hasMoreContent = await page.evaluate((params: { pageIndex: number; viewportHeight: number }) => {
          const g = globalThis as {
            innerHeight: number;
            document?: {
              body?: { scrollHeight?: number };
              documentElement?: { scrollHeight?: number };
            };
          };
          const consumedHeight = (params.pageIndex + 1) * params.viewportHeight;
          const bodyHeight = g.document?.body?.scrollHeight || 0;
          const rootHeight = g.document?.documentElement?.scrollHeight || 0;
          const docHeight = Math.max(bodyHeight, rootHeight, g.innerHeight || params.viewportHeight);
          return docHeight > consumedHeight + 100;
        }, { pageIndex, viewportHeight });

        if (!hasMoreContent) {
          break;
        }
      }

      return pages;
    } catch (error) {
      logger.error("PDF page rendering failed", {
        fileUrl: input.fileUrl,
        jobId: input.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

let rendererServiceInstance: PdfPageRendererService | null = null;

export function getPdfPageRendererService(): PdfPageRendererService {
  if (!rendererServiceInstance) {
    rendererServiceInstance = new DefaultPdfPageRendererService();
  }
  return rendererServiceInstance;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

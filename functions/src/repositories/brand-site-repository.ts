import { DatabaseService } from "../core";
import { BrandSite, BrandSiteData } from "../core/entities/brand-site";
import { BrandSiteRepository } from "../core/ports/repositories/brand-site-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";
import { BrandSiteStorageService } from "../services/brand-site-storage-service";
import { loggerService } from "../services/logger-service";

/**
 * Factory for a `BrandSiteRepository` backed by the provided `DatabaseService`.
 * Automatically offloads large content (html, files, versions) to Cloud Storage
 * to avoid Firestore's 1MB document size limit.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {BrandSiteRepository} Repository with CRUD operations for brand sites.
 */
export function getBrandSiteRepository(
  databaseService: DatabaseService,
): BrandSiteRepository {
  const baseRepository = getGenericRepository<BrandSite, BrandSiteData>(
    () => DatabaseCollection.BRAND_SITES,
    databaseService,
  );
  const storageService = new BrandSiteStorageService();

  // Helper function to process large content and offload to storage
  const processLargeContent = async (
    id: string,
    data: Partial<BrandSiteData>,
  ): Promise<Partial<BrandSiteData>> => {
    const processedData: any = { ...data };

    // Offload html to Cloud Storage if present and large
    if (processedData.html) {
      const htmlSize = Buffer.from(processedData.html, "utf-8").length;
      if (htmlSize > 100 * 1024) {
        // Offload if > 100KB
        try {
          await storageService.storeHtml(id, processedData.html);
          processedData.html = undefined; // Remove from Firestore
          processedData._storageHtmlPath = `brand-sites/${id}/html.html`;
          loggerService.debug("Offloaded HTML to Cloud Storage", { brandSiteId: id, size: htmlSize });
        } catch (error) {
          loggerService.error("Failed to offload HTML to storage", {
            brandSiteId: id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Continue with storing in Firestore as fallback
        }
      }
    }

    // Offload files to Cloud Storage if present and large
    if (processedData.files && Object.keys(processedData.files).length > 0) {
      const filesSize = Buffer.from(JSON.stringify(processedData.files), "utf-8").length;
      if (filesSize > 100 * 1024) {
        // Offload if > 100KB
        try {
          await storageService.storeFiles(id, processedData.files);
          processedData.files = undefined; // Remove from Firestore
          processedData._storageFilesPath = `brand-sites/${id}/files.json`;
          loggerService.debug("Offloaded files to Cloud Storage", { brandSiteId: id, size: filesSize });
        } catch (error) {
          loggerService.error("Failed to offload files to storage", {
            brandSiteId: id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Continue with storing in Firestore as fallback
        }
      }
    }

    // Offload versions to Cloud Storage if present and large
    if (processedData.versions && processedData.versions.length > 0) {
      const versionsSize = Buffer.from(JSON.stringify(processedData.versions), "utf-8").length;
      if (versionsSize > 200 * 1024) {
        // Offload if > 200KB (versions can be large)
        try {
          // Store each version separately
          const versionPaths: string[] = [];
          for (const version of processedData.versions) {
            if (version.html) {
              const path = await storageService.storeVersion(
                id,
                version.version,
                version.html,
                version.files,
              );
              versionPaths.push(path);
            }
          }
          // Replace versions array with metadata only
          processedData.versions = processedData.versions.map((v: any) => ({
            version: v.version,
            deployedUrl: v.deployedUrl,
            previewUrl: v.previewUrl,
            metadata: v.metadata,
            createdAt: v.createdAt,
            description: v.description,
            _storagePath: `brand-sites/${id}/versions/v${v.version}.json`,
          })) as any;
          loggerService.debug("Offloaded versions to Cloud Storage", {
            brandSiteId: id,
            versionCount: processedData.versions.length,
            size: versionsSize,
          });
        } catch (error) {
          loggerService.error("Failed to offload versions to storage", {
            brandSiteId: id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Continue with storing in Firestore as fallback
        }
      }
    }

    return processedData;
  };

  return {
    ...baseRepository,
    async update(payload) {
      const { id, data } = payload;
      const processedData = await processLargeContent(id, data);
      return baseRepository.update({ id, data: processedData as BrandSiteData });
    },
    async set(payload) {
      const { id, data } = payload;
      const processedData = await processLargeContent(id, data);
      return baseRepository.set({ id, data: processedData as BrandSiteData });
    },
    async create(payload) {
      // Create with minimal data first to get the ID
      const minimalData: Partial<BrandSiteData> = {
        organizationId: payload.data.organizationId,
        brandName: payload.data.brandName,
        brandColors: payload.data.brandColors,
        tone: payload.data.tone || "professional",
        status: payload.data.status || "pending",
        pages: [],
        versions: [],
        conversations: [],
        contextImages: [],
      };
      const brandSiteId = await baseRepository.create({ data: minimalData as BrandSiteData });
      // Now process and update with full data including large content
      if (brandSiteId) {
        const processedData = await processLargeContent(brandSiteId, payload.data);
        await baseRepository.update({ id: brandSiteId, data: processedData as BrandSiteData });
      }
      return brandSiteId;
    },
    async get(payload) {
      const brandSite = await baseRepository.get(payload);
      if (!brandSite) {
        return null;
      }

      // Restore html from Cloud Storage if needed
      if (!brandSite.html && (brandSite as any)._storageHtmlPath) {
        try {
          const html = await storageService.getHtml(payload.id, (brandSite as any)._storageHtmlPath);
          if (html) {
            brandSite.html = html;
          }
        } catch (error) {
          loggerService.warn("Failed to retrieve HTML from storage", {
            brandSiteId: payload.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Restore files from Cloud Storage if needed
      if (!brandSite.files && (brandSite as any)._storageFilesPath) {
        try {
          const files = await storageService.getFiles(payload.id, (brandSite as any)._storageFilesPath);
          if (files) {
            brandSite.files = files;
          }
        } catch (error) {
          loggerService.warn("Failed to retrieve files from storage", {
            brandSiteId: payload.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Restore versions from Cloud Storage if needed
      if (brandSite.versions && brandSite.versions.length > 0) {
        for (const version of brandSite.versions) {
          if (!version.html && (version as any)._storagePath) {
            try {
              const versionData = await storageService.getVersion(payload.id, version.version);
              if (versionData) {
                version.html = versionData.html;
                if (versionData.files) {
                  version.files = versionData.files;
                }
              }
            } catch (error) {
              loggerService.warn("Failed to retrieve version from storage", {
                brandSiteId: payload.id,
                version: version.version,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }
        }
      }

      return brandSite;
    },
  };
}


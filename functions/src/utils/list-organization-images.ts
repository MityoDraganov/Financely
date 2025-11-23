/**
 * Utility to list all available images from an organization's Firebase Storage
 * This ensures the AI only uses images that actually exist
 */

import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";

/**
 * List all image files from an organization's storage folders
 * @param organizationId - The organization ID
 * @param firebaseProjectId - Firebase project ID for generating proxy URLs
 * @returns Array of image URLs (using proxy format)
 */
export async function listOrganizationImages(
  organizationId: string,
  firebaseProjectId?: string,
): Promise<string[]> {
  const bucket = getStorage().bucket();
  const imageUrls: string[] = [];
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

  try {
    // List images from branding folder
    const brandingPrefix = `organizations/${organizationId}/branding/`;
    const [brandingFiles] = await bucket.getFiles({ prefix: brandingPrefix });
    
    for (const file of brandingFiles) {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      if (imageExtensions.includes(extension)) {
        const url = firebaseProjectId
          ? `https://us-central1-${firebaseProjectId}.cloudfunctions.net/proxyStorageImage?path=${encodeURIComponent(file.name)}`
          : `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        imageUrls.push(url);
      }
    }

    // List images from products folder
    const productsPrefix = `organizations/${organizationId}/products/`;
    const [productFiles] = await bucket.getFiles({ prefix: productsPrefix });
    
    for (const file of productFiles) {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      if (imageExtensions.includes(extension)) {
        const url = firebaseProjectId
          ? `https://us-central1-${firebaseProjectId}.cloudfunctions.net/proxyStorageImage?path=${encodeURIComponent(file.name)}`
          : `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        imageUrls.push(url);
      }
    }

    // List images from articles folder
    const articlesPrefix = `organizations/${organizationId}/articles/`;
    const [articleFiles] = await bucket.getFiles({ prefix: articlesPrefix });
    
    for (const file of articleFiles) {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      if (imageExtensions.includes(extension)) {
        const url = firebaseProjectId
          ? `https://us-central1-${firebaseProjectId}.cloudfunctions.net/proxyStorageImage?path=${encodeURIComponent(file.name)}`
          : `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        imageUrls.push(url);
      }
    }

    logger.info("Listed organization images", {
      organizationId,
      totalImages: imageUrls.length,
      brandingCount: brandingFiles.length,
      productsCount: productFiles.length,
      articlesCount: articleFiles.length,
    });

    return imageUrls;
  } catch (error) {
    logger.error("Failed to list organization images", {
      organizationId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Return empty array on error - better than crashing
    return [];
  }
}

/**
 * Filter product images to only include those that exist in storage
 * @param productImages - Array of image URLs from product records
 * @param availableImages - Array of all available image URLs from storage
 * @returns Filtered array of product images that actually exist
 */
export function filterValidProductImages(
  productImages: string[],
  availableImages: string[],
): string[] {
  if (!productImages || productImages.length === 0) {
    return [];
  }

  // Check which product images exist in available images
  const validImages = productImages.filter((productImage) => {
    // Extract path from product image URL
    let productPath: string | null = null;
    const storageMatch = productImage.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
    if (storageMatch) {
      productPath = storageMatch[1];
    } else {
      const proxyMatch = productImage.match(/proxyStorageImage\?path=([^&]+)/);
      if (proxyMatch) {
        productPath = decodeURIComponent(proxyMatch[1]);
      } else {
        const firebaseStorageMatch = productImage.match(/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/);
        if (firebaseStorageMatch) {
          productPath = decodeURIComponent(firebaseStorageMatch[1]);
        }
      }
    }

    if (!productPath) {
      return false;
    }

    // Check if this path exists in available images (by checking if any available image contains this path)
    return availableImages.some((availableImage) => {
      const availablePathMatch = availableImage.match(/proxyStorageImage\?path=([^&]+)/);
      if (availablePathMatch) {
        const availablePath = decodeURIComponent(availablePathMatch[1]);
        return availablePath === productPath;
      }
      return false;
    });
  });

  return validImages;
}


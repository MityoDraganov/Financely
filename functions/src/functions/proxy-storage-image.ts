/**
 * Cloud Function to proxy Firebase Storage images with CORS headers
 * This fixes CORS issues when loading images from Firebase Storage in deployed sites
 */

import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";

export const proxyStorageImage = onRequest(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request, response) => {
    try {
      const imagePath = request.query.path as string;
      
      if (!imagePath) {
        response.status(400).json({ error: "path parameter is required" });
        return;
      }

      // Decode the path (it might be URL encoded)
      const decodedPath = decodeURIComponent(imagePath);
      
      // Get the file from Firebase Storage
      const bucket = getStorage().bucket();
      const file = bucket.file(decodedPath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        response.status(404).json({ error: "Image not found" });
        return;
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || "image/jpeg";

      // Set CORS headers
      response.set("Access-Control-Allow-Origin", "*");
      response.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.set("Access-Control-Allow-Headers", "Content-Type");
      response.set("Cache-Control", "public, max-age=31536000, immutable");
      response.set("Content-Type", contentType);

      // Handle OPTIONS request (CORS preflight)
      if (request.method === "OPTIONS") {
        response.status(204).send();
        return;
      }

      // Stream the file
      const stream = file.createReadStream();
      stream.pipe(response);

      stream.on("error", (error) => {
        logger.error("Error streaming image", {
          path: decodedPath,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (!response.headersSent) {
          response.status(500).json({ error: "Failed to load image" });
        }
      });
    } catch (error) {
      logger.error("Error proxying storage image", {
        error: error instanceof Error ? error.message : "Unknown error",
        path: request.query.path,
      });
      if (!response.headersSent) {
        response.status(500).json({ error: "Internal server error" });
      }
    }
  }
);


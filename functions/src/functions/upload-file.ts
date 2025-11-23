import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { extractUserContextFromRequest } from "../utils/request-context";

interface UploadFilePayload {
  organizationId: string;
  fileName: string;
  fileData: string; // Base64 encoded file data
  contentType: string;
  path?: string; // Optional custom path, defaults to branding folder
}

/**
 * Firebase Cloud Function for uploading files.
 * 
 * This function handles file uploads to Firebase Storage.
 * All file uploads (create operations) must go through this backend function.
 * 
 * Request payload:
 * {
 *   organizationId: string,
 *   fileName: string,
 *   fileData: string (base64 encoded),
 *   contentType: string,
 *   path?: string (optional, defaults to branding folder)
 * }
 * 
 * Response: { url: string }
 */
export const uploadFile = onCall<UploadFilePayload, Promise<{ url: string }>>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    const startTime = Date.now();
    const { organizationId, fileName, fileData, contentType, path } = request.data;

    try {
      // TODO: Add authentication check when Clerk is integrated
      // if (!request.auth) {
      //   throw new HttpsError("unauthenticated", "User must be authenticated");
      // }

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      if (!fileName) {
        throw new HttpsError("invalid-argument", "fileName is required");
      }

      if (!fileData) {
        throw new HttpsError("invalid-argument", "fileData is required");
      }

      if (!contentType) {
        throw new HttpsError("invalid-argument", "contentType is required");
      }

      // Validate file type (only images allowed for now)
      if (!contentType.startsWith("image/")) {
        throw new HttpsError("invalid-argument", "Only image files are allowed");
      }

      // Decode base64 file data
      let fileBuffer: Buffer;
      try {
        // Remove data URL prefix if present (e.g., "data:image/png;base64,")
        const base64Data = fileData.includes(",") 
          ? fileData.split(",")[1] 
          : fileData;
        fileBuffer = Buffer.from(base64Data, "base64");
      } catch (error) {
        throw new HttpsError("invalid-argument", "Invalid base64 file data");
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (fileBuffer.length > maxSize) {
        throw new HttpsError("invalid-argument", "File size must be less than 10MB");
      }

      // Determine storage path
      const fileExtension = fileName.split(".").pop() || "png";
      const timestamp = Date.now();
      const storagePath = path || `organizations/${organizationId}/branding/site-builder-${timestamp}.${fileExtension}`;

      // Upload to Firebase Storage
      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType,
          metadata: {
            uploadedAt: new Date().toISOString(),
            organizationId,
            uploadedBy: (await extractUserContextFromRequest(request))?.userId || "unknown",
          },
        },
      });

      // Make file publicly readable (needed for displaying in sites)
      await file.makePublic();

      // Get public URL
      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      logger.info("File uploaded successfully", {
        organizationId,
        fileName,
        contentType,
        fileSize: fileBuffer.length,
        storagePath,
        durationMs: Date.now() - startTime,
      });

      return { url };
    } catch (error) {
      logger.error("Failed to upload file", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId,
        fileName,
        contentType,
        durationMs: Date.now() - startTime,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to upload file",
      );
    }
  },
);


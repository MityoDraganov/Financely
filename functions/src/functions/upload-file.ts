import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { extractUserContextFromRequest } from "../utils/request-context";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

interface UploadFilePayload {
  organizationId: string;
  fileName: string;
  fileData: string; // Base64 encoded file data
  contentType: string;
  path?: string; // Optional custom path, defaults to branding folder
  validationMode?: "default" | "image" | "video" | "any";
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
 *   path?: string (optional, defaults to branding folder),
 *   validationMode?: "default" | "image" | "video" | "any"
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
    let mode: NonNullable<UploadFilePayload["validationMode"]> = "default";
    const {
      organizationId,
      fileName,
      fileData,
      contentType,
      path,
      validationMode,
    } = request.data;

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

      mode = validationMode ?? "default";
      if (!["default", "image", "video", "any"].includes(mode)) {
        throw new HttpsError(
          "invalid-argument",
          "validationMode must be one of: default, image, video, any",
        );
      }

      // Validate file type (images + common document formats)
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/csv",
        "text/plain",
        "application/rtf",
        "application/vnd.oasis.opendocument.text",
      ];
      const allowedExtensions = [
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".csv",
        ".txt",
        ".rtf",
        ".odt",
      ];
      const normalizedFileName = fileName.toLowerCase();
      const hasAllowedExtension = allowedExtensions.some((ext) =>
        normalizedFileName.endsWith(ext),
      );

      const isImageType = contentType.startsWith("image/");
      const isVideoType = contentType.startsWith("video/");
      const isAllowedInDefaultMode =
        allowedTypes.includes(contentType) || isImageType || hasAllowedExtension;
      const isAllowedType =
        mode === "any"
          ? true
          : mode === "image"
          ? isImageType
          : mode === "video"
          ? isVideoType
          : isAllowedInDefaultMode;
      
      if (!isAllowedType) {
        const message =
          mode === "image"
            ? "Only image files are allowed"
            : mode === "video"
            ? "Only video files are allowed"
            : "Only image files and common document files (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, CSV, TXT, RTF, ODT) are allowed";
        throw new HttpsError(
          "invalid-argument",
          message,
        );
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

      // Validate file size (20MB max for documents, 10MB for images)
      const isDocument = hasAllowedExtension || contentType === "application/pdf";
      const useLargeFileLimit = mode === "any" || mode === "video" || isDocument;
      const maxSize = useLargeFileLimit ? 20 * 1024 * 1024 : 10 * 1024 * 1024; // 20MB for documents/video/any, 10MB for images
      if (fileBuffer.length > maxSize) {
        throw new HttpsError(
          "invalid-argument",
          `File size must be less than ${useLargeFileLimit ? "20MB" : "10MB"}`,
        );
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
        validationMode: mode,
        fileSize: fileBuffer.length,
        storagePath,
        durationMs: Date.now() - startTime,
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "uploadFile",
        organizationId,
        action: "data.imported",
        resource: {
          type: "file",
          id: storagePath,
          name: fileName,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "uploadFile",
          customFields: {
            contentType,
            validationMode: mode,
            fileSizeBytes: fileBuffer.length,
            storagePath,
            url,
          },
        },
      });

      return { url };
    } catch (error) {
      logger.error("Failed to upload file", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId,
        fileName,
        contentType,
        validationMode: mode,
        durationMs: Date.now() - startTime,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "uploadFile",
        organizationId,
        action: "data.imported",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: organizationId
          ? {
              type: "file",
              id: path || fileName || "unknown",
              name: fileName || undefined,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "uploadFile",
          customFields: {
            contentType,
            validationMode: mode,
            hasFileData: Boolean(fileData),
          },
        },
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

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateFile } from "../app/handle-create-file";
import { CreateFileInput } from "../core/entities/file";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

export const createContentFile = onCall<CreateFileInput, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const payload = request.data;

      if (!payload) {
        throw new HttpsError("invalid-argument", "Request payload is required");
      }

      if (!payload.organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      await verifyAuthAndOrgMembership(request, payload.organizationId, {
        requireOwnerOrAdmin: true,
      });

      if (!payload.filename) {
        throw new HttpsError("invalid-argument", "Filename is required");
      }

      if (!payload.url) {
        throw new HttpsError("invalid-argument", "URL is required");
      }

      if (!payload.contentType) {
        throw new HttpsError("invalid-argument", "Content type is required");
      }

      loggerService.info("Creating file", {
        organizationId: payload.organizationId,
        filename: payload.filename,
        fileType: payload.fileType,
      });

      const fileId = await handleCreateFile(payload);

      loggerService.info("File created successfully", { fileId });

      return { id: fileId };
    } catch (error: any) {
      loggerService.error("Failed to create file", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to create file: ${error.message}`
      );
    }
  }
);

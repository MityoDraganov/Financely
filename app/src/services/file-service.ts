import { File, CreateFileInput, UpdateFileInput } from "@/core";
import { getFileRepository } from "@/repositories/file-repository";
import { databaseService } from "./database/database-service";

const fileRepository = getFileRepository(databaseService);

export type FileService = {
  createFile: (data: CreateFileInput) => Promise<string>;
  getFile: (id: string) => Promise<File | null>;
  listFiles: (orgId: string, params?: { fileType?: string; limit?: number; offset?: number }) => Promise<File[]>;
  updateFile: (id: string, data: UpdateFileInput) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
};

export const fileService: FileService = {
  async createFile(data) {
    const result = await fileRepository.create({
      data: {
        ...data,
        fileStatus: data.fileStatus || "PENDING",
      },
    });
    return result;
  },

  async getFile(id) {
    return fileRepository.get({ id });
  },

  async listFiles(orgId, params) {
    const constraints: import("@/core").QueryConstraint[] = [
      { field: "organizationId", operator: "==" as const, value: orgId }
    ];
    if (params?.fileType) {
      constraints.push({ field: "fileType", operator: "==" as const, value: params.fileType });
    }
    const result = await fileRepository.getAll({
      queryConstraints: constraints,
      pagination: {
        limit: params?.limit || 50,
      },
    });
    return result || [];
  },

  async updateFile(id, data) {
    await fileRepository.update({
      id,
      data,
    });
  },

  async deleteFile(id) {
    await fileRepository.delete({ id });
  },
};

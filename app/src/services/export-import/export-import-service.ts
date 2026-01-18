import { firebase } from "@/infrastructure/firebase";
import { httpsCallable } from "@firebase/functions";
import type {
  ExportDataInput,
  ImportDataInput,
  ExportJob,
  ImportJob,
} from "@/core/entities/export-import";

export interface ExportImportService {
  /**
   * Export data to file
   */
  exportData(input: ExportDataInput): Promise<{ jobId: string }>;

  /**
   * Import data from file
   */
  importData(input: ImportDataInput): Promise<{ jobId: string }>;

  /**
   * Get export job status
   */
  getExportJob(orgId: string, jobId: string): Promise<ExportJob>;

  /**
   * Get import job status
   */
  getImportJob(orgId: string, jobId: string): Promise<ImportJob>;
}

export const exportImportService: ExportImportService = {
  async exportData(input: ExportDataInput): Promise<{ jobId: string }> {
    const result = await httpsCallable<ExportDataInput, { jobId: string }>(
      firebase.functions,
      "exportData",
    )(input);
    return result.data;
  },

  async importData(input: ImportDataInput): Promise<{ jobId: string }> {
    const result = await httpsCallable<ImportDataInput, { jobId: string }>(
      firebase.functions,
      "importData",
    )(input);
    return result.data;
  },

  async getExportJob(orgId: string, jobId: string): Promise<ExportJob> {
    const result = await httpsCallable<
      { orgId: string; jobId: string },
      ExportJob
    >(firebase.functions, "getExportJob")({ orgId, jobId });
    return result.data;
  },

  async getImportJob(orgId: string, jobId: string): Promise<ImportJob> {
    const result = await httpsCallable<
      { orgId: string; jobId: string },
      ImportJob
    >(firebase.functions, "getImportJob")({ orgId, jobId });
    return result.data;
  },
};

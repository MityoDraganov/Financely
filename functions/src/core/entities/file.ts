import z from "zod";
import { baseEntitySchema } from "./base";

export const fileDataSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  filename: z.string().min(1, "Filename is required"),
  originalFilename: z.string().optional(),
  url: z.string().url("URL must be valid"),
  contentType: z.string().min(1, "Content type is required"),
  fileSize: z.number().int().min(0).optional(),
  alt: z.string().optional(),
  fileStatus: z.enum(["PENDING", "READY", "FAILED"]).default("PENDING"),
  fileType: z.enum(["IMAGE", "VIDEO", "EXTERNAL_VIDEO", "MODEL_3D", "GENERIC"]).default("GENERIC"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FileData = z.infer<typeof fileDataSchema>;
export const fileSchema = baseEntitySchema.merge(fileDataSchema);
export type File = z.infer<typeof fileSchema>;

export type CreateFileInput = Omit<FileData, "organizationId" | "fileStatus"> & {
  organizationId: string;
  fileStatus?: FileData["fileStatus"];
};

export type UpdateFileInput = Partial<Omit<FileData, "organizationId">>;

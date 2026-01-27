import { CreateFileInput, fileDataSchema } from "../core/entities/file";
import { getDatabaseService } from "../services/database-service";
import { getFileRepository } from "../repositories/file-repository";
import { ZodError } from "zod";

export async function handleCreateFile(
  payload: CreateFileInput
): Promise<string> {
  try {
    const validatedData = fileDataSchema.parse(payload);

    const databaseService = getDatabaseService();
    const fileRepository = getFileRepository(databaseService);

    const fileId = await fileRepository.create({ data: validatedData });

    if (!fileId) {
      throw new Error("Failed to create file: No ID returned");
    }

    return fileId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `File validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}

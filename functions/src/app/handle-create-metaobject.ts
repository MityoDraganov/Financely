import { CreateMetaobjectInput, metaobjectDataSchema } from "../core/entities/metaobject";
import { getDatabaseService } from "../services/database-service";
import { getMetaobjectRepository } from "../repositories/metaobject-repository";
import { ZodError } from "zod";

export async function handleCreateMetaobject(
  payload: CreateMetaobjectInput
): Promise<string> {
  try {
    const validatedData = metaobjectDataSchema.parse(payload);

    const databaseService = getDatabaseService();
    const metaobjectRepository = getMetaobjectRepository(databaseService);

    const metaobjectId = await metaobjectRepository.create({ data: validatedData });

    if (!metaobjectId) {
      throw new Error("Failed to create metaobject: No ID returned");
    }

    return metaobjectId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `Metaobject validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}

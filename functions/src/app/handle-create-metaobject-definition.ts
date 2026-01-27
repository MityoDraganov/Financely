import { CreateMetaobjectDefinitionInput, metaobjectDefinitionDataSchema } from "../core/entities/metaobject";
import { getDatabaseService } from "../services/database-service";
import { getMetaobjectDefinitionRepository } from "../repositories/metaobject-repository";
import { ZodError } from "zod";

export async function handleCreateMetaobjectDefinition(
  payload: CreateMetaobjectDefinitionInput
): Promise<string> {
  try {
    const validatedData = metaobjectDefinitionDataSchema.parse(payload);

    const databaseService = getDatabaseService();
    const metaobjectDefinitionRepository = getMetaobjectDefinitionRepository(databaseService);

    const definitionId = await metaobjectDefinitionRepository.create({ data: validatedData });

    if (!definitionId) {
      throw new Error("Failed to create metaobject definition: No ID returned");
    }

    return definitionId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `Metaobject definition validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}

import { ZodError, type ZodSchema } from "zod";
import type { GenericRepository } from "../core/ports/repositories/generic-repository";

type DefinitionRepository<TDefinition, TDefinitionData> = GenericRepository<TDefinition, TDefinitionData>;

type HandleCreateEntityMetafieldDefinitionParams<TCreateInput, TDefinition, TDefinitionData> = {
  payload: TCreateInput;
  entityLabel: string;
  schema: ZodSchema<TDefinitionData>;
  getRepository: () => DefinitionRepository<TDefinition, TDefinitionData>;
};

export async function handleCreateEntityMetafieldDefinition<TCreateInput, TDefinition, TDefinitionData>({
  payload,
  entityLabel,
  schema,
  getRepository,
}: HandleCreateEntityMetafieldDefinitionParams<TCreateInput, TDefinition, TDefinitionData>): Promise<string> {
  try {
    const validatedData = schema.parse(payload);
    const repository = getRepository();
    const definitionId = await repository.create({ data: validatedData });

    if (!definitionId) {
      throw new Error(`Failed to create ${entityLabel} metafield definition: No ID returned`);
    }

    return definitionId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `${entityLabel} metafield definition validation failed: ${JSON.stringify(issues, null, 2)}`,
      );
    }

    throw error;
  }
}

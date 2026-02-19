import { z } from "zod";
import { contactDataSchema } from "@/core/entities/contact";
import { productDataSchema } from "@/core/entities/product";

export type DynamicSourceEntity = "product" | "contact";

export type DynamicSourceValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "object"
  | "unknown";

export interface DynamicSourceField {
  id: string;
  entity: DynamicSourceEntity;
  entityLabel: string;
  path: string;
  placeholderKey: string;
  label: string;
  description: string;
  valueType: DynamicSourceValueType;
  required: boolean;
}

type EntitySchemaConfig = {
  entity: DynamicSourceEntity;
  entityLabel: string;
  schema: z.ZodObject<z.ZodRawShape>;
};

const ENTITY_SCHEMAS: EntitySchemaConfig[] = [
  {
    entity: "product",
    entityLabel: "Product",
    schema: productDataSchema,
  },
  {
    entity: "contact",
    entityLabel: "Contact",
    schema: contactDataSchema,
  },
];

const getBaseSchema = (
  schema: z.ZodTypeAny,
): { schema: z.ZodTypeAny; optional: boolean } => {
  let current = schema;
  let optional = false;

  while (true) {
    if (current instanceof z.ZodOptional) {
      optional = true;
      current = current.unwrap();
      continue;
    }
    if (current instanceof z.ZodNullable) {
      optional = true;
      current = current.unwrap();
      continue;
    }
    if (current instanceof z.ZodDefault) {
      optional = true;
      current = current.removeDefault();
      continue;
    }
    if (current instanceof z.ZodCatch) {
      optional = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)._def.innerType;
      continue;
    }
    if (current instanceof z.ZodEffects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)._def.schema;
      continue;
    }
    if (current instanceof z.ZodBranded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)._def.type;
      continue;
    }
    if (current instanceof z.ZodReadonly) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)._def.innerType;
      continue;
    }
    if (current instanceof z.ZodPipeline) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current = (current as any)._def.out;
      continue;
    }
    break;
  }

  return { schema: current, optional };
};

const toValueType = (schema: z.ZodTypeAny): DynamicSourceValueType => {
  const { schema: base } = getBaseSchema(schema);

  if (base instanceof z.ZodString || base instanceof z.ZodEnum || base instanceof z.ZodNativeEnum) {
    return "string";
  }

  if (base instanceof z.ZodNumber || base instanceof z.ZodBigInt) {
    return "number";
  }

  if (base instanceof z.ZodBoolean) {
    return "boolean";
  }

  if (base instanceof z.ZodDate) {
    return "date";
  }

  if (base instanceof z.ZodArray) {
    return "array";
  }

  if (base instanceof z.ZodObject) {
    return "object";
  }

  if (base instanceof z.ZodLiteral) {
    const literalValue = base._def.value;
    if (typeof literalValue === "string") {
      return "string";
    }
    if (typeof literalValue === "number") {
      return "number";
    }
    if (typeof literalValue === "boolean") {
      return "boolean";
    }
  }

  if (base instanceof z.ZodUnion) {
    return "unknown";
  }

  return "unknown";
};

const humanizeSegment = (segment: string): string =>
  segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());

const getPathLabel = (path: string): string =>
  path
    .split(".")
    .map(humanizeSegment)
    .join(" > ");

const toPlaceholderKey = (entity: DynamicSourceEntity, path: string): string =>
  `${entity}_${path}`
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const collectFieldsForSchema = ({
  entity,
  entityLabel,
  schema,
}: EntitySchemaConfig): DynamicSourceField[] => {
  const collected: DynamicSourceField[] = [];

  const walkSchema = (
    targetSchema: z.ZodTypeAny,
    path: string[],
    parentRequired: boolean,
  ) => {
    const { schema: baseSchema, optional } = getBaseSchema(targetSchema);
    const isRequired = parentRequired && !optional;

    if (baseSchema instanceof z.ZodObject) {
      const shape = baseSchema.shape;
      Object.entries(shape).forEach(([key, childSchema]) => {
        walkSchema(childSchema as z.ZodTypeAny, [...path, key], isRequired);
      });
      return;
    }

    if (path.length === 0) {
      return;
    }

    const pathValue = path.join(".");
    const pathLabel = getPathLabel(pathValue);

    collected.push({
      id: `${entity}:${pathValue}`,
      entity,
      entityLabel,
      path: pathValue,
      placeholderKey: toPlaceholderKey(entity, pathValue),
      label: pathLabel,
      description: `${entityLabel} ${pathLabel}`,
      valueType: toValueType(baseSchema),
      required: isRequired,
    });
  };

  walkSchema(schema, [], true);
  return collected;
};

const dynamicSourceFieldsCache: DynamicSourceField[] = ENTITY_SCHEMAS.flatMap((config) =>
  collectFieldsForSchema(config),
);

export const getEntityDynamicSourceFields = (): DynamicSourceField[] =>
  dynamicSourceFieldsCache;

export const getEntityDynamicSourceMapByPlaceholderKey = (): Record<string, DynamicSourceField> =>
  dynamicSourceFieldsCache.reduce<Record<string, DynamicSourceField>>((acc, source) => {
    acc[source.placeholderKey.toLowerCase()] = source;
    return acc;
  }, {});

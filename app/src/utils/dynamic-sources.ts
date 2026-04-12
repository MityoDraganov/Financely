import { z } from "zod";
import type { ContactMetafieldDefinition, ProductMetafieldDefinition } from "@/core";
import { contactDataSchema } from "@/core/entities/contact";
import { invoiceDataSchema } from "@/core/entities/invoice";
import { productDataSchema } from "@/core/entities/product";
import { proposalDataSchema } from "@/core/entities/proposal";

export type DynamicSourceEntity = "product" | "contact" | "invoice" | "proposal";

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
  sourceKind?: "field" | "metafield";
  metafieldDefinitionId?: string;
}

type RuntimeMetafieldDefinition = Pick<
  ProductMetafieldDefinition | ContactMetafieldDefinition,
  "id" | "name" | "type" | "description"
>;

export type DynamicSourceRuntimeOptions = {
  productMetafieldDefinitions?: RuntimeMetafieldDefinition[];
  contactMetafieldDefinitions?: RuntimeMetafieldDefinition[];
};

type AdditionalDynamicField = {
  path: string;
  valueType?: DynamicSourceValueType;
  required?: boolean;
  label?: string;
  description?: string;
};

type EntitySchemaConfig = {
  entity: DynamicSourceEntity;
  entityLabel: string;
  schema: z.ZodObject<z.ZodRawShape>;
  additionalFields?: AdditionalDynamicField[];
  includeSchemaFields?: boolean;
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
  {
    entity: "invoice",
    entityLabel: "Invoice",
    schema: invoiceDataSchema,
    includeSchemaFields: false,
    additionalFields: [
      { path: "invoiceNumber", valueType: "string" },
      { path: "number", valueType: "string" },
      { path: "issueDate", valueType: "string" },
      { path: "invoiceDate", valueType: "string" },
      { path: "dueDate", valueType: "string" },
      { path: "status", valueType: "string" },
      { path: "reference", valueType: "string" },
      { path: "currency", valueType: "string" },
      { path: "seller.name", valueType: "string" },
      { path: "seller.email", valueType: "string" },
      { path: "seller.phone", valueType: "string" },
      { path: "seller.taxIdVat", valueType: "string" },
      { path: "seller.address", valueType: "string" },
      { path: "buyer.name", valueType: "string" },
      { path: "buyer.email", valueType: "string" },
      { path: "buyer.phone", valueType: "string" },
      { path: "buyer.taxIdVat", valueType: "string" },
      { path: "buyer.address", valueType: "string" },
      { path: "items", valueType: "array" },
      { path: "subtotal", valueType: "number" },
      { path: "taxTotal", valueType: "number" },
      { path: "vatTotal", valueType: "number" },
      { path: "netAmount", valueType: "number" },
      { path: "discount", valueType: "number" },
      { path: "total", valueType: "number" },
      { path: "grossTotal", valueType: "number" },
      { path: "paid", valueType: "number" },
      { path: "paidAmount", valueType: "number" },
      { path: "due", valueType: "number" },
      { path: "amountDue", valueType: "number" },
      {
        path: "payUrl",
        valueType: "string",
        label: "Payment URL",
        description: "Stripe payment link for this invoice",
      },
      {
        path: "viewUrl",
        valueType: "string",
        label: "Invoice URL",
        description: "Primary invoice link (payment page when available)",
      },
      {
        path: "pdfUrl",
        valueType: "string",
        label: "PDF URL",
        description: "Direct link to the generated invoice PDF",
      },
      {
        path: "payment.hostedInvoiceUrl",
        valueType: "string",
        label: "Stripe Hosted Invoice URL",
        description: "Hosted Stripe invoice payment page URL",
      },
      {
        path: "links.payUrl",
        valueType: "string",
        label: "Links > Payment URL",
        description: "Invoice links object payment URL",
      },
      {
        path: "links.viewUrl",
        valueType: "string",
        label: "Links > Invoice URL",
        description: "Invoice links object invoice URL",
      },
      {
        path: "links.pdfUrl",
        valueType: "string",
        label: "Links > PDF URL",
        description: "Invoice links object PDF URL",
      },
      {
        path: "paymentDelivery.status",
        valueType: "string",
        label: "Payment Delivery > Status",
        description: "Resolved payment delivery status for this invoice",
      },
      {
        path: "paymentDelivery.hasOnlineLink",
        valueType: "boolean",
        label: "Payment Delivery > Has online link",
        description: "Whether online payment is currently available",
      },
      {
        path: "paymentDelivery.reference",
        valueType: "string",
        label: "Payment Delivery > Reference",
        description: "Resolved payment reference for bank transfer or memo fields",
      },
      {
        path: "paymentDelivery.payUrl",
        valueType: "string",
        label: "Payment Delivery > Pay URL",
        description: "Online payment URL when available",
      },
      {
        path: "paymentDelivery.viewUrl",
        valueType: "string",
        label: "Payment Delivery > View URL",
        description: "Best available invoice link for recipients",
      },
      {
        path: "paymentDelivery.warningText",
        valueType: "string",
        label: "Payment Delivery > Warning text",
        description: "Warn-only explanation for fallback payment mode",
      },
      {
        path: "paymentDelivery.fallbackInstructions",
        valueType: "string",
        label: "Payment Delivery > Fallback instructions",
        description: "Bank transfer fallback text from organization settings",
      },
    ],
  },
  {
    entity: "proposal",
    entityLabel: "Proposal",
    schema: proposalDataSchema,
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

const toMetafieldPlaceholderKey = (
  entity: Extract<DynamicSourceEntity, "product" | "contact">,
  definitionId: string,
): string =>
  `${entity}_metafield_${definitionId}`
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const toMetafieldValueType = (metafieldType: string): DynamicSourceValueType => {
  if (metafieldType.startsWith("list.")) return "array";

  if (metafieldType === "boolean") return "boolean";
  if (metafieldType === "date" || metafieldType === "date_time") return "date";
  if (
    metafieldType === "number_integer" ||
    metafieldType === "number_decimal" ||
    metafieldType === "money" ||
    metafieldType === "rating" ||
    metafieldType === "weight" ||
    metafieldType === "volume" ||
    metafieldType === "dimension"
  ) {
    return "number";
  }
  if (metafieldType === "json") return "object";

  return "string";
};

const collectFieldsForSchema = ({
  entity,
  entityLabel,
  schema,
  additionalFields,
  includeSchemaFields = true,
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
      sourceKind: "field",
    });
  };

  if (includeSchemaFields) {
    walkSchema(schema, [], true);
  }

  const existingPaths = new Set(collected.map((field) => field.path.toLowerCase()));
  (additionalFields ?? []).forEach((field) => {
    if (existingPaths.has(field.path.toLowerCase())) {
      return;
    }
    const pathLabel = field.label ?? getPathLabel(field.path);
    collected.push({
      id: `${entity}:${field.path}`,
      entity,
      entityLabel,
      path: field.path,
      placeholderKey: toPlaceholderKey(entity, field.path),
      label: pathLabel,
      description: field.description ?? `${entityLabel} ${pathLabel}`,
      valueType: field.valueType ?? "unknown",
      required: field.required ?? false,
      sourceKind: "field",
    });
  });

  return collected;
};

const baseDynamicSourceFieldsCache: DynamicSourceField[] = ENTITY_SCHEMAS.flatMap((config) =>
  collectFieldsForSchema(config),
);

const buildMetafieldSourceFields = (
  entity: Extract<DynamicSourceEntity, "product" | "contact">,
  entityLabel: "Product" | "Contact",
  definitions: RuntimeMetafieldDefinition[] | undefined,
): DynamicSourceField[] => {
  if (!definitions || definitions.length === 0) {
    return [];
  }

  const seenDefinitionIds = new Set<string>();
  return definitions
    .filter((definition) => {
      if (!definition?.id || seenDefinitionIds.has(definition.id)) return false;
      seenDefinitionIds.add(definition.id);
      return true;
    })
    .map((definition) => ({
      id: `${entity}:metafields.${definition.id}`,
      entity,
      entityLabel,
      path: `metafields.${definition.id}`,
      placeholderKey: toMetafieldPlaceholderKey(entity, definition.id),
      label: `${definition.name} (Metafield)`,
      description:
        definition.description?.trim() || `${entityLabel} metafield ${definition.name}`,
      valueType: toMetafieldValueType(definition.type),
      required: false,
      sourceKind: "metafield",
      metafieldDefinitionId: definition.id,
    }));
};

const buildDynamicSourceFields = (
  options?: DynamicSourceRuntimeOptions,
): DynamicSourceField[] => [
  ...baseDynamicSourceFieldsCache,
  ...buildMetafieldSourceFields(
    "product",
    "Product",
    options?.productMetafieldDefinitions,
  ),
  ...buildMetafieldSourceFields(
    "contact",
    "Contact",
    options?.contactMetafieldDefinitions,
  ),
];

export const getEntityDynamicSourceFields = (
  options?: DynamicSourceRuntimeOptions,
): DynamicSourceField[] => buildDynamicSourceFields(options);

export const getEntityDynamicSourceMapByPlaceholderKey = (
  options?: DynamicSourceRuntimeOptions,
): Record<string, DynamicSourceField> =>
  buildDynamicSourceFields(options).reduce<Record<string, DynamicSourceField>>((acc, source) => {
    acc[source.placeholderKey.toLowerCase()] = source;
    return acc;
  }, {});

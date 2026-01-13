import z from "zod";

export const dataContextValueSchema: z.ZodType<DataContextValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), dataContextValueSchema),
    z.array(dataContextValueSchema),
  ])
);

export type DataContextValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: DataContextValue }
  | DataContextValue[];

export const invoiceContextSchema = z.object({
  id: z.string(),
  number: z.string().optional(),
  status: z.string(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  data: z.record(z.string(), dataContextValueSchema),
  orgId: z.string(),
  templateId: z.string(),
  templateVersionId: z.string().optional(),
});

export type InvoiceContext = z.infer<typeof invoiceContextSchema>;

export const customerContextSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.union([z.string(), z.array(z.string())]).optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  status: z.string().optional(),
});

export type CustomerContext = z.infer<typeof customerContextSchema>;

export const organizationContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  settings: z
    .object({
      defaultCurrency: z.string().optional(),
      defaultLanguage: z.string().optional(),
      defaultTimezone: z.string().optional(),
      country: z.string().optional(),
      region: z.enum(["US", "EU", "CA", "AU", "UK"]).optional(),
      address: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipCode: z.string().optional(),
          country: z.string().optional(),
        })
        .optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      brandColors: z
        .object({
          primary: z.string().optional(),
          secondary: z.string().optional(),
          accent: z.string().optional(),
        })
        .optional(),
      branding: z
        .object({
          customLogo: z.string().url().optional(),
          companyName: z.string().optional(),
          emailFromName: z.string().optional(),
          emailFromAddress: z.string().email().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type OrganizationContext = z.infer<typeof organizationContextSchema>;

export const paymentContextSchema = z.object({
  id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  method: z.string().optional(),
  transactionId: z.string().optional(),
  paidAt: z.string().optional(),
  invoiceId: z.string().optional(),
});

export type PaymentContext = z.infer<typeof paymentContextSchema>;

export const usageContextSchema = z.object({
  invoiceCount: z.number().optional(),
  emailCount: z.number().optional(),
  storageUsed: z.number().optional(),
  lastActivity: z.string().optional(),
});

export type UsageContext = z.infer<typeof usageContextSchema>;

export const dataContextMetaSchema = z.object({
  locale: z.string().default("en"),
  currency: z.string().default("USD"),
  timezone: z.string().default("UTC"),
});

export type DataContextMeta = z.infer<typeof dataContextMetaSchema>;

export const dataContextSchema = z.object({
  invoice: invoiceContextSchema.optional(),
  customer: customerContextSchema.optional(),
  organization: organizationContextSchema.optional(),
  payment: paymentContextSchema.optional(),
  usage: usageContextSchema.optional(),
  external: z.record(z.string(), z.record(z.string(), dataContextValueSchema)).optional(),
  computed: z.record(z.string(), dataContextValueSchema).optional(),
  meta: dataContextMetaSchema.optional(),
});

export type DataContext = z.infer<typeof dataContextSchema>;

export function createDataContext(
  data: Partial<DataContext>
): Readonly<DataContext> {
  const frozenExternal = data.external
    ? Object.fromEntries(
        Object.entries(data.external).map(([key, value]) => [
          key,
          Object.freeze(value),
        ])
      )
    : undefined;

  return Object.freeze({
    invoice: data.invoice ? Object.freeze(data.invoice) : undefined,
    customer: data.customer ? Object.freeze(data.customer) : undefined,
    organization: data.organization ? Object.freeze(data.organization) : undefined,
    payment: data.payment ? Object.freeze(data.payment) : undefined,
    usage: data.usage ? Object.freeze(data.usage) : undefined,
    external: frozenExternal ? Object.freeze(frozenExternal) : undefined,
    computed: data.computed ? Object.freeze(data.computed) : undefined,
    meta: data.meta
      ? Object.freeze(data.meta)
      : {
          locale: "en",
          currency: "USD",
          timezone: "UTC",
        },
  }) as Readonly<DataContext>;
}


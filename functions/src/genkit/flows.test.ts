import { test } from "node:test";
import assert from "node:assert";
import type { OfficialTemplateGenkit } from "./runtime";
import { buildOfficialTemplateFlows } from "./flows";
import {
  emailGenerationSchema,
  invoiceGenerationSchema,
  officialTemplateBlueprintSchema,
} from "./schemas";

type GenerateQueueItem =
  | { output: unknown }
  | { error: Error };

class FakeGenkitRuntime implements OfficialTemplateGenkit {
  private readonly queue: GenerateQueueItem[];
  public generateCalls = 0;

  constructor(queue: GenerateQueueItem[]) {
    this.queue = [...queue];
  }

  async generate(): Promise<{ output: unknown }> {
    this.generateCalls += 1;
    const next = this.queue.shift();
    if (!next) {
      throw new Error("Fake generate queue exhausted");
    }
    if ("error" in next) {
      throw next.error;
    }
    return { output: next.output };
  }

  defineFlow<TInput, TOutput>(
    options: {
      name: string;
      inputSchema: unknown;
      outputSchema: unknown;
    },
    handler: (input: TInput) => Promise<TOutput> | TOutput,
  ): (input: TInput) => Promise<TOutput> {
    return async (input: TInput) => {
      const parsedInput =
        typeof (options.inputSchema as { parse?: (value: unknown) => TInput }).parse === "function"
          ? (options.inputSchema as { parse: (value: unknown) => TInput }).parse(input)
          : input;
      const result = await handler(parsedInput);
      return typeof (options.outputSchema as { parse?: (value: unknown) => TOutput }).parse === "function"
        ? (options.outputSchema as { parse: (value: unknown) => TOutput }).parse(result)
        : result;
    };
  }
}

const invoiceBlueprint = officialTemplateBlueprintSchema.parse({
  id: "test-invoice-en",
  type: "invoice",
  language: "en",
  region: "EU",
  archetype: "service",
  title: "Test Invoice",
  shortDescription: "Test invoice short description",
  description: "Test invoice description",
  category: "Invoicing",
  tags: ["official", "invoice"],
  country: "EU",
  style: "professional",
});

const emailBlueprint = officialTemplateBlueprintSchema.parse({
  id: "test-email-bg",
  type: "email",
  language: "bg",
  region: "EU",
  archetype: "invoice_sent",
  title: "Test Email",
  shortDescription: "Test email short description",
  description: "Test email description",
  category: "Email",
  tags: ["official", "email"],
  country: "EU",
  style: "transactional",
});

function makeValidInvoiceOutput() {
  return invoiceGenerationSchema.parse({
    name: "Generated Invoice Template",
    pageSize: "A4",
    brand: {
      fonts: ["Inter"],
      colors: {
        primary: "#111827",
        secondary: "#6b7280",
        accent: "#2563eb",
      },
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
    elements: [
      {
        id: "invoice-number",
        type: "input",
        x: 40,
        y: 40,
        width: 220,
        height: 24,
        binding: "invoiceNumber",
      },
    ],
    compliance: {
      region: "EU",
      requiredFields: [],
      autoFooter: true,
      complianceValidated: false,
    },
  });
}

function makeValidEmailOutput() {
  return emailGenerationSchema.parse({
    name: "Изпратена фактура",
    subject: "Фактура {{invoice.number}}",
    htmlContent: "<p>Здравейте {{contact.name}}</p>",
    allowedContexts: ["invoice_send"],
    blocks: [],
    designTokens: {},
    placeholders: [
      {
        key: "invoice.number",
        source: {
          type: "entity_field",
          entity: "invoice",
          path: "invoice.number",
        },
      },
      {
        key: "contact.name",
        source: {
          type: "entity_field",
          entity: "contact",
          path: "contact.name",
        },
      },
    ],
  });
}

test("invoice flow retries invalid model output and succeeds", async () => {
  const runtime = new FakeGenkitRuntime([
    {
      output: JSON.stringify({
        name: "Generated Invoice Template",
        pageSize: "A4",
        brand: JSON.stringify({
          fonts: ["Inter"],
          colors: {
            primary: "#111827",
            secondary: "#6b7280",
            accent: "#2563eb",
          },
          margins: { top: 40, right: 40, bottom: 40, left: 40 },
        }),
        elements: "[]",
      }),
    },
    { output: makeValidInvoiceOutput() },
  ]);
  const flows = buildOfficialTemplateFlows(runtime);

  const output = await flows.generateOfficialInvoiceTemplateFlow({
    blueprint: invoiceBlueprint,
  });

  assert.strictEqual(output.name, "Generated Invoice Template");
  assert.strictEqual(runtime.generateCalls, 1);
});

test("pack flow returns failed result after retry exhaustion", async () => {
  const runtime = new FakeGenkitRuntime([
    { output: "not-json-output" },
    { output: "not-json-output" },
    { output: "not-json-output" },
  ]);
  const flows = buildOfficialTemplateFlows(runtime);

  const output = await flows.generateOfficialTemplatePackFlow({
    blueprints: [invoiceBlueprint],
  });

  assert.strictEqual(output.results.length, 1);
  assert.strictEqual(output.results[0].status, "failed");
  assert.ok(output.results[0].errors[0]?.includes("after 3 attempts"));
});

test("pack flow generates invoice and email templates with schema-shaped output", async () => {
  const runtime = new FakeGenkitRuntime([
    { output: makeValidInvoiceOutput() },
    { output: makeValidEmailOutput() },
  ]);
  const flows = buildOfficialTemplateFlows(runtime);

  const output = await flows.generateOfficialTemplatePackFlow({
    blueprints: [invoiceBlueprint, emailBlueprint],
  });

  assert.strictEqual(output.results.length, 2);
  assert.strictEqual(output.results[0].status, "ok");
  assert.strictEqual(output.results[1].status, "ok");
  assert.ok(output.results[0].templateContent);
  assert.ok(output.results[1].templateContent);
});

test("email flow normalizes block object output", async () => {
  const runtime = new FakeGenkitRuntime([
    {
      output: {
        name: "Invoice Sent Email",
        subject: "Invoice {{invoice.number}}",
        htmlContent: "<p>Hello {{contact.name}}</p>",
        allowedContexts: ["invoice_send"],
        blocks: {
          header: [{ id: "h1", type: "text", text: "Header" }],
          body: [{ id: "b1", type: "text", text: "Body" }],
          footer: [{ id: "f1", type: "text", text: "Footer" }],
        },
        placeholders: [
          {
            key: "invoice.number",
            source: {
              type: "entity_field",
              entity: "invoice",
              path: "invoice.number",
            },
          },
          {
            key: "contact.name",
            source: {
              type: "entity_field",
              entity: "contact",
              path: "contact.name",
            },
          },
        ],
      },
    },
  ]);
  const flows = buildOfficialTemplateFlows(runtime);

  const output = await flows.generateOfficialEmailTemplateFlow({
    blueprint: emailBlueprint,
  });

  assert.ok(Array.isArray(output.blocks));
  assert.ok(output.blocks.length >= 3);
});

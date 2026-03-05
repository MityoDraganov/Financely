type UnknownRecord = Record<string, unknown>;

export type EmailTemplateCompatMode = "legacy_v1" | "canonical_v1";

export type EmailTemplateRequirementLoop = {
  path: string;
  alias: string;
  rowFields: string[];
  emptyBehavior?: "hide" | "row";
};

export type EmailTemplateRequirements = {
  version: "v1";
  compatMode: EmailTemplateCompatMode;
  entityTypes: string[];
  scalarPaths: string[];
  loops: EmailTemplateRequirementLoop[];
  strict: boolean;
  extractedAt?: string;
};

export type EmailTemplateDiagnosticIssue =
  | {
      type: "missing_path";
      path: string;
      severity: "error";
      nearest?: string[];
    }
  | {
      type: "invalid_loop_path";
      path: string;
      expected: "array";
      actual: string;
      severity: "error";
    }
  | {
      type: "unresolved_token";
      token: string;
      severity: "error";
      nearest?: string[];
    };

export type EmailTemplateDiagnosticPayload = {
  code: "EMAIL_TEMPLATE_RENDER_FAILED";
  templateId?: string;
  compatMode: EmailTemplateCompatMode;
  entityType: string;
  message: string;
  issues: EmailTemplateDiagnosticIssue[];
  context?: UnknownRecord;
};

const SCALAR_TOKEN_REGEX = /{{\s*([^{}#/@][^{}]*)\s*}}/g;
const LOOP_REGEX = /{{#each\s+([^\s}]+)\s+as\s+([^\s}]+)\s*}}([\s\S]*?){{\/each}}/g;

const toRecord = (value: unknown): UnknownRecord | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as UnknownRecord;
};

const getValueAtPath = (source: unknown, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as UnknownRecord)[part];
  }, source);
};

const flattenPaths = (value: unknown, base = "", output = new Set<string>()): Set<string> => {
  if (value === null || value === undefined) {
    if (base) output.add(base);
    return output;
  }

  if (Array.isArray(value)) {
    if (base) output.add(base);
    if (value.length > 0) {
      flattenPaths(value[0], `${base}[0]`, output);
    }
    return output;
  }

  if (typeof value !== "object") {
    if (base) output.add(base);
    return output;
  }

  if (base) output.add(base);
  for (const [key, nested] of Object.entries(value as UnknownRecord)) {
    const path = base ? `${base}.${key}` : key;
    flattenPaths(nested, path, output);
  }
  return output;
};

const findNearestPaths = (path: string, availablePaths: string[], limit = 3): string[] => {
  if (availablePaths.length === 0) return [];
  const normalizedPath = path.toLowerCase();
  return [...availablePaths]
    .sort((a, b) => {
      const aScore = a.toLowerCase().includes(normalizedPath) ? 0 : 1;
      const bScore = b.toLowerCase().includes(normalizedPath) ? 0 : 1;
      if (aScore !== bScore) return aScore - bScore;
      return Math.abs(a.length - path.length) - Math.abs(b.length - path.length);
    })
    .slice(0, limit);
};

const normalizePath = (value: string): string => value.trim();

const extractScalarPaths = (content: string): string[] => {
  const paths = new Set<string>();
  for (const match of content.matchAll(SCALAR_TOKEN_REGEX)) {
    const token = normalizePath(match[1] ?? "");
    if (!token) continue;
    if (token.startsWith("@")) continue;
    paths.add(token);
  }
  return Array.from(paths);
};

const extractLoops = (content: string): EmailTemplateRequirementLoop[] => {
  const loops: EmailTemplateRequirementLoop[] = [];

  for (const match of content.matchAll(LOOP_REGEX)) {
    const loopPath = normalizePath(match[1] ?? "");
    const alias = normalizePath(match[2] ?? "");
    const body = match[3] ?? "";
    if (!loopPath || !alias) continue;

    const rowFields = new Set<string>();
    const rowFieldRegex = new RegExp(`{{\\s*${alias}\\.([^\\s}]+)\\s*}}`, "g");
    for (const rowMatch of body.matchAll(rowFieldRegex)) {
      const field = normalizePath(rowMatch[1] ?? "");
      if (field) rowFields.add(field);
    }

    loops.push({
      path: loopPath,
      alias,
      rowFields: Array.from(rowFields),
      emptyBehavior: "hide",
    });
  }

  return loops;
};

export const extractEmailTemplateRequirements = (template: {
  allowedContexts?: string[];
  subject?: string;
  preheader?: string;
  htmlContent?: string;
  compatMode?: string;
}): EmailTemplateRequirements => {
  const content = [template.subject ?? "", template.preheader ?? "", template.htmlContent ?? ""].join("\n");
  const loops = extractLoops(content);
  const scalarCandidates = extractScalarPaths(content);
  const loopAliases = new Set(loops.map((loop) => `${loop.alias}.`));

  const scalarPaths = scalarCandidates.filter((path) => !Array.from(loopAliases).some((alias) => path.startsWith(alias)));
  const entityTypes = (template.allowedContexts ?? [])
    .map((context) => context.trim())
    .filter((context) => context.length > 0);

  return {
    version: "v1",
    compatMode: template.compatMode === "canonical_v1" ? "canonical_v1" : "legacy_v1",
    entityTypes,
    scalarPaths: Array.from(new Set(scalarPaths)),
    loops,
    strict: true,
    extractedAt: new Date().toISOString(),
  };
};

const getValueType = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

export const evaluateTemplateRequirements = (input: {
  requirements: EmailTemplateRequirements;
  data: UnknownRecord;
  templateId?: string;
  entityType: string;
  context?: UnknownRecord;
}): EmailTemplateDiagnosticPayload | null => {
  const { requirements, data, templateId, entityType, context } = input;
  const availablePaths = Array.from(flattenPaths(data));
  const issues: EmailTemplateDiagnosticIssue[] = [];

  for (const path of requirements.scalarPaths) {
    const value = getValueAtPath(data, path);
    if (value === undefined || value === null) {
      issues.push({
        type: "missing_path",
        path,
        severity: "error",
        nearest: findNearestPaths(path, availablePaths),
      });
    }
  }

  for (const loop of requirements.loops) {
    const value = getValueAtPath(data, loop.path);
    if (!Array.isArray(value)) {
      issues.push({
        type: "invalid_loop_path",
        path: loop.path,
        expected: "array",
        actual: getValueType(value),
        severity: "error",
      });
      continue;
    }

    if (value.length === 0) continue;
    const firstRow = toRecord(value[0]);
    for (const rowField of loop.rowFields) {
      const rowValue = getValueAtPath(firstRow, rowField);
      if (rowValue === undefined || rowValue === null) {
        issues.push({
          type: "missing_path",
          path: `${loop.path}.${rowField}`,
          severity: "error",
          nearest: findNearestPaths(`${loop.path}.${rowField}`, availablePaths),
        });
      }
    }
  }

  if (issues.length === 0) return null;

  return {
    code: "EMAIL_TEMPLATE_RENDER_FAILED",
    templateId,
    compatMode: requirements.compatMode,
    entityType,
    message: "Missing required template paths",
    issues,
    context,
  };
};

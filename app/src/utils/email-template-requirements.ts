import type {
  EmailTemplateCompatMode,
  EmailTemplateRequirementLoop,
  EmailTemplateRequirements,
} from "@/core";

const SCALAR_TOKEN_REGEX = /{{\s*([^{}#/@][^{}]*)\s*}}/g;
const LOOP_REGEX = /{{#each\s+([^\s}]+)\s+as\s+([^\s}]+)\s*}}([\s\S]*?){{\/each}}/g;

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

export const extractEmailTemplateRequirements = (input: {
  subject?: string;
  preheader?: string;
  htmlContent?: string;
  allowedContexts?: string[];
  compatMode: EmailTemplateCompatMode;
}): EmailTemplateRequirements => {
  const content = [input.subject ?? "", input.preheader ?? "", input.htmlContent ?? ""].join("\n");
  const loops = extractLoops(content);
  const scalarCandidates = extractScalarPaths(content);
  const loopAliases = new Set(loops.map((loop) => `${loop.alias}.`));
  const scalarPaths = scalarCandidates.filter(
    (path) => !Array.from(loopAliases).some((alias) => path.startsWith(alias)),
  );

  return {
    version: "v1",
    compatMode: input.compatMode,
    entityTypes: (input.allowedContexts ?? []).filter((value) => value.trim().length > 0),
    scalarPaths: Array.from(new Set(scalarPaths)),
    loops,
    strict: true,
    extractedAt: new Date().toISOString(),
  };
};

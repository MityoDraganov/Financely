type UnknownRecord = Record<string, unknown>;

export type EmailAvailabilityStatus = "guaranteed" | "maybe" | "missing";

export type EmailAvailabilityIndex = Record<string, EmailAvailabilityStatus>;

export type EmailVmBuildResult = {
  emailVm: { email: UnknownRecord };
  availabilityIndex: EmailAvailabilityIndex;
  normalizationDiagnostics: string[];
};

type BuildInvoiceEmailVmInput = {
  orgId: string;
  invoiceId: string;
  invoiceStatus?: string;
  invoiceData: UnknownRecord;
  invoiceTemplateSnapshot?: unknown;
  organization?: UnknownRecord;
  recipient?: {
    name?: string;
    email?: string;
    company?: string;
  };
  links?: {
    viewUrl?: string;
    payUrl?: string;
    pdfUrl?: string;
  };
  locale?: string;
  timezone?: string;
  sentAt?: string;
};

type BuildProposalEmailVmInput = {
  orgId: string;
  proposalId: string;
  proposal: UnknownRecord;
  organization?: UnknownRecord;
  recipient?: {
    name?: string;
    email?: string;
    company?: string;
  };
  workflow?: UnknownRecord;
  links?: {
    viewUrl?: string;
    approveUrl?: string;
    pdfUrl?: string;
  };
  locale?: string;
  timezone?: string;
  sentAt?: string;
};

const toRecord = (value: unknown): UnknownRecord | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as UnknownRecord;
};

const toArray = (value: unknown): unknown[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getByPath = (source: unknown, path: string): unknown => {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as UnknownRecord)[part];
  }, source);
};

const pickFirstPath = (source: unknown, paths: string[]): { value: unknown; path: string | null } => {
  for (const path of paths) {
    const value = getByPath(source, path);
    if (value !== undefined && value !== null) {
      return { value, path };
    }
  }
  return { value: undefined, path: null };
};

const normalizeAddress = (value: unknown): UnknownRecord => {
  const address = toRecord(value);
  if (!address) {
    return {
      line1: null,
      line2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
    };
  }

  return {
    line1: toString(address.line1 ?? address.addressLine1 ?? address.street) ?? null,
    line2: toString(address.line2 ?? address.addressLine2) ?? null,
    city: toString(address.city) ?? null,
    state: toString(address.state ?? address.region) ?? null,
    postalCode: toString(address.postalCode ?? address.zip ?? address.zipCode) ?? null,
    country: toString(address.country) ?? null,
  };
};

const normalizeParty = (value: unknown): UnknownRecord => {
  const party = toRecord(value);
  if (!party) {
    return {
      name: null,
      email: null,
      phone: null,
      taxId: null,
      address: normalizeAddress(undefined),
    };
  }

  return {
    name: toString(party.name ?? party.companyName) ?? null,
    email: toString(party.email) ?? null,
    phone: toString(party.phone ?? party.phoneNumber) ?? null,
    taxId: toString(party.taxId ?? party.taxNumber ?? party.vatNumber ?? party.taxIdVat) ?? null,
    address: normalizeAddress(party.address ?? party.billingAddress ?? party.location),
  };
};

const normalizeInvoiceItems = (value: unknown): UnknownRecord[] => {
  const rows = toArray(value);
  if (!rows) return [];

  return rows
    .map((row) => toRecord(row))
    .filter((row): row is UnknownRecord => !!row)
    .map((row, index) => ({
      id: toString(row.id) ?? String(index + 1),
      sku: toString(row.sku ?? row.code) ?? null,
      name: toString(row.name ?? row.title) ?? null,
      description: toString(row.description ?? row.name ?? row.title) ?? null,
      quantity: toNumber(row.quantity ?? row.qty ?? row.count) ?? null,
      unit: toString(row.unit) ?? null,
      unitPrice: toNumber(row.unitPrice ?? row.price ?? row.rate) ?? null,
      taxRate: toNumber(row.taxRate ?? row.taxPct ?? row.vatRate) ?? null,
      taxAmount: toNumber(row.taxAmount ?? row.tax) ?? null,
      discount: toNumber(row.discount ?? row.discountAmount) ?? null,
      total: toNumber(row.total ?? row.lineTotal ?? row.amount) ?? null,
    }));
};

const getTemplateItemsBindings = (templateSnapshot: unknown): string[] => {
  const snapshot = toRecord(templateSnapshot);
  const elements = toArray(snapshot?.elements);
  if (!elements) return [];

  return elements
    .map((element) => toRecord(element))
    .filter((element): element is UnknownRecord => !!element)
    .filter((element) => element.type === "table")
    .map((element) => toString(element.itemsBinding))
    .filter((value): value is string => !!value);
};

const buildAvailabilityIndex = (emailRoot: UnknownRecord): EmailAvailabilityIndex => {
  const availability: EmailAvailabilityIndex = {};

  const visit = (value: unknown, path: string) => {
    if (value === undefined || value === null) {
      availability[path] = "missing";
      return;
    }
    if (Array.isArray(value)) {
      availability[path] = "guaranteed";
      return;
    }
    if (typeof value === "object") {
      availability[path] = "guaranteed";
      for (const [key, nestedValue] of Object.entries(value as UnknownRecord)) {
        visit(nestedValue, `${path}.${key}`);
      }
      return;
    }
    availability[path] = "guaranteed";
  };

  visit(emailRoot, "email");
  return availability;
};

export const buildInvoiceEmailVm = (input: BuildInvoiceEmailVmInput): EmailVmBuildResult => {
  const diagnostics: string[] = [];
  const invoiceData = input.invoiceData ?? {};
  const templateItemsBindings = getTemplateItemsBindings(input.invoiceTemplateSnapshot);
  const itemCandidates = [...templateItemsBindings, "items", "lineItems", "products", "rows"];
  const { value: rawItems, path: itemsPath } = pickFirstPath(invoiceData, itemCandidates);
  const items = normalizeInvoiceItems(rawItems);

  if (!itemsPath) {
    diagnostics.push("Invoice items path not found; normalized to empty array");
  }

  const { value: sellerValue } = pickFirstPath(invoiceData, ["seller", "from", "company"]);
  const { value: buyerValue } = pickFirstPath(invoiceData, ["buyer", "customer", "to"]);

  const currency =
    toString(
      getByPath(invoiceData, "currency") ??
        getByPath(invoiceData, "money.currency") ??
        getByPath(invoiceData, "totals.currency"),
    ) ?? "USD";

  const emailRoot: UnknownRecord = {
    meta: {
      entityType: "invoice",
      orgId: input.orgId,
      locale: input.locale ?? "en",
      timezone: input.timezone ?? "UTC",
      currency,
      sentAt: input.sentAt ?? new Date().toISOString(),
    },
    recipient: {
      name: input.recipient?.name ?? null,
      email: input.recipient?.email ?? null,
      company: input.recipient?.company ?? null,
    },
    invoice: {
      id: input.invoiceId,
      number:
        toString(invoiceData.invoiceNumber ?? invoiceData.number ?? invoiceData.invoiceNo) ?? input.invoiceId,
      status: toString(input.invoiceStatus ?? invoiceData.status) ?? null,
      issueDate: toString(invoiceData.issueDate ?? invoiceData.invoiceDate ?? invoiceData.date) ?? null,
      dueDate: toString(invoiceData.dueDate) ?? null,
      reference: toString(invoiceData.reference ?? invoiceData.poNumber) ?? null,
      seller: normalizeParty(sellerValue),
      buyer: normalizeParty(buyerValue),
      money: {
        subtotal: toNumber(invoiceData.subtotal) ?? null,
        tax: toNumber(invoiceData.taxTotal ?? invoiceData.vatTotal ?? invoiceData.tax) ?? null,
        discount: toNumber(invoiceData.discount ?? invoiceData.discountTotal) ?? null,
        total: toNumber(invoiceData.total ?? invoiceData.amount) ?? null,
        paid: toNumber(invoiceData.paid ?? invoiceData.amountPaid) ?? null,
        due: toNumber(invoiceData.due ?? invoiceData.amountDue) ?? null,
        currency,
      },
      items,
      links: {
        viewUrl: input.links?.viewUrl ?? null,
        payUrl: input.links?.payUrl ?? null,
        pdfUrl: input.links?.pdfUrl ?? null,
      },
    },
    proposal: null,
    workflow: null,
    organization: input.organization ?? null,
  };

  return {
    emailVm: { email: emailRoot },
    availabilityIndex: buildAvailabilityIndex(emailRoot),
    normalizationDiagnostics: diagnostics,
  };
};

export const buildProposalEmailVm = (input: BuildProposalEmailVmInput): EmailVmBuildResult => {
  const diagnostics: string[] = [];
  const proposal = input.proposal ?? {};
  const currency = toString(proposal.currency ?? getByPath(proposal, "money.currency")) ?? "USD";

  const emailRoot: UnknownRecord = {
    meta: {
      entityType: "proposal",
      orgId: input.orgId,
      locale: input.locale ?? "en",
      timezone: input.timezone ?? "UTC",
      currency,
      sentAt: input.sentAt ?? new Date().toISOString(),
    },
    recipient: {
      name: input.recipient?.name ?? null,
      email: input.recipient?.email ?? null,
      company: input.recipient?.company ?? null,
    },
    invoice: null,
    proposal: {
      id: input.proposalId,
      number: toString(proposal.number ?? proposal.proposalNumber) ?? input.proposalId,
      title: toString(proposal.title) ?? null,
      status: toString(proposal.status) ?? null,
      validUntil: toString(proposal.validUntil ?? proposal.expiresAt) ?? null,
      money: {
        total: toNumber(proposal.total) ?? null,
        currency,
      },
      links: {
        viewUrl: input.links?.viewUrl ?? toString(proposal.publicUrl) ?? null,
        approveUrl:
          input.links?.approveUrl ??
          toString(getByPath(proposal, "approval.url")) ??
          toString(proposal.approvalUrl) ??
          null,
        pdfUrl: input.links?.pdfUrl ?? toString(proposal.pdfUrl) ?? null,
      },
    },
    workflow: input.workflow ?? null,
    organization: input.organization ?? null,
  };

  if (!toString(proposal.title)) {
    diagnostics.push("Proposal title missing; normalized to null");
  }

  return {
    emailVm: { email: emailRoot },
    availabilityIndex: buildAvailabilityIndex(emailRoot),
    normalizationDiagnostics: diagnostics,
  };
};

export const buildWorkflowEmailVm = (input: {
  context: UnknownRecord;
  workflow?: UnknownRecord;
}): EmailVmBuildResult => {
  const context = input.context;
  const dataContext = toRecord(context._dataContext);
  const organization = toRecord(dataContext?.organization) ?? toRecord(context.organization);
  const orgId =
    toString(context.orgId) ?? toString(context.tenantId) ?? toString(organization?.id) ?? "unknown_org";

  const invoiceData =
    toRecord(toRecord(dataContext?.invoice)?.data) ??
    toRecord(context.invoice) ??
    toRecord(context.data);
  const proposalData = toRecord(context.proposal);
  const customer =
    toRecord(dataContext?.customer) ??
    toRecord(context.contact) ??
    toRecord(context.customer);

  const workflow: UnknownRecord = {
    id: toString(context.workflowId) ?? toString(input.workflow?.id) ?? null,
    name: toString(context.workflowName) ?? toString(input.workflow?.name) ?? null,
    runId: toString(context.runId) ?? null,
    stepId: toString(context.stepId) ?? null,
    eventType: toString(context.triggerType) ?? null,
    triggeredAt: toString(context.triggeredAt) ?? new Date().toISOString(),
    triggeredBy: toString(context.triggeredBy) ?? null,
  };

  if (invoiceData) {
    const invoiceVm = buildInvoiceEmailVm({
      orgId,
      invoiceId: toString(context.invoiceId) ?? toString(invoiceData.id) ?? "workflow_invoice",
      invoiceData,
      organization,
      recipient: {
        name: toString(customer?.name) ?? undefined,
        email: toString(customer?.email) ?? undefined,
      },
      sentAt: workflow.triggeredAt as string,
      locale: toString(context.locale) ?? undefined,
      timezone: toString(context.timezone) ?? undefined,
    });

    const mergedEmail = {
      ...invoiceVm.emailVm.email,
      workflow,
    };

    return {
      emailVm: { email: mergedEmail },
      availabilityIndex: buildAvailabilityIndex(mergedEmail),
      normalizationDiagnostics: invoiceVm.normalizationDiagnostics,
    };
  }

  if (proposalData) {
    const proposalVm = buildProposalEmailVm({
      orgId,
      proposalId: toString(context.proposalId) ?? toString(proposalData.id) ?? "workflow_proposal",
      proposal: proposalData,
      organization,
      recipient: {
        name: toString(customer?.name) ?? undefined,
        email: toString(customer?.email) ?? undefined,
      },
      workflow,
      sentAt: workflow.triggeredAt as string,
      locale: toString(context.locale) ?? undefined,
      timezone: toString(context.timezone) ?? undefined,
    });

    const mergedEmail = {
      ...proposalVm.emailVm.email,
      workflow,
    };

    return {
      emailVm: { email: mergedEmail },
      availabilityIndex: buildAvailabilityIndex(mergedEmail),
      normalizationDiagnostics: proposalVm.normalizationDiagnostics,
    };
  }

  const emailRoot: UnknownRecord = {
    meta: {
      entityType: "workflow",
      orgId,
      locale: toString(context.locale) ?? "en",
      timezone: toString(context.timezone) ?? "UTC",
      currency: "USD",
      sentAt: workflow.triggeredAt as string,
    },
    recipient: {
      name: toString(customer?.name) ?? null,
      email: toString(customer?.email) ?? null,
      company: toString(customer?.company) ?? null,
    },
    invoice: null,
    proposal: null,
    workflow,
    organization: organization ?? null,
  };

  return {
    emailVm: { email: emailRoot },
    availabilityIndex: buildAvailabilityIndex(emailRoot),
    normalizationDiagnostics: [],
  };
};

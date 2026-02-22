import { firebase } from "@/infrastructure";
import { AuditLogActionType, CreateAuditLogInput } from "@/core";
import { databaseService } from "@/services/database/database-service";
import { auditLogService } from "./audit-log-service";
import { getRuntimeAuditUserContext } from "./audit-log-runtime-context";

type AuditUserContext = CreateAuditLogInput["user"];
type ClientAuditMetadata = Omit<
  NonNullable<CreateAuditLogInput["metadata"]>,
  "source"
> & {
  source?: NonNullable<CreateAuditLogInput["metadata"]>["source"];
};

interface BaseClientAuditOptions {
  organizationId?: string;
  action: AuditLogActionType;
  resource?: CreateAuditLogInput["resource"];
  metadata?: ClientAuditMetadata;
}

interface SuccessClientAuditOptions extends BaseClientAuditOptions {
  durationMs?: number;
}

interface FailureClientAuditOptions extends BaseClientAuditOptions {
  error: unknown;
  errorCode?: string;
  durationMs?: number;
}

let cachedAuditUser: AuditUserContext | null = null;
let cachedAuditUid: string | null = null;

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedDeep(entryValue)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function getNavigatorUserAgent(): string | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  return navigator.userAgent;
}

function getGlobalClerkUser(): {
  id?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  emailAddresses?: Array<{ emailAddress?: string }>;
  primaryEmailAddress?: { emailAddress?: string };
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  const clerk = (window as unknown as { Clerk?: { user?: unknown } }).Clerk;
  if (!clerk || !clerk.user || typeof clerk.user !== "object") {
    return null;
  }

  return clerk.user as {
    id?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    emailAddresses?: Array<{ emailAddress?: string }>;
    primaryEmailAddress?: { emailAddress?: string };
  };
}

function resolveEmailFromClerkUser(
  clerkUser: ReturnType<typeof getGlobalClerkUser>,
): string {
  if (!clerkUser) {
    return "";
  }

  return (
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses?.find((item) => Boolean(item?.emailAddress))
      ?.emailAddress ||
    ""
  );
}

function resolveNameFromClerkUser(
  clerkUser: ReturnType<typeof getGlobalClerkUser>,
): string {
  if (!clerkUser) {
    return "";
  }

  if (clerkUser.fullName && clerkUser.fullName.trim()) {
    return clerkUser.fullName.trim();
  }

  const first = clerkUser.firstName || "";
  const last = clerkUser.lastName || "";
  const full = `${first} ${last}`.trim();
  return full;
}

async function resolveAuditUserContext(): Promise<AuditUserContext | null> {
  const authUser = firebase.auth.currentUser;
  const clerkUser = getGlobalClerkUser();
  const runtimeAuditUser = getRuntimeAuditUserContext();

  if (!authUser) {
    const fallbackId = runtimeAuditUser?.clerkId || clerkUser?.id || "unknown-user";

    const clerkEmail =
      runtimeAuditUser?.email || resolveEmailFromClerkUser(clerkUser);
    const fallbackEmail =
      clerkEmail || `${fallbackId}@unknown.local`;
    const fallbackName =
      runtimeAuditUser?.name ||
      resolveNameFromClerkUser(clerkUser) ||
      fallbackEmail.split("@")[0] ||
      "Unknown User";

    return {
      userId: fallbackId,
      clerkId: fallbackId,
      email: fallbackEmail,
      name: fallbackName,
      userAgent: getNavigatorUserAgent(),
    };
  }

  if (cachedAuditUid === authUser.uid && cachedAuditUser) {
    return cachedAuditUser;
  }

  const uid = authUser.uid;
  const tokenResult = await authUser.getIdTokenResult().catch(() => null);
  const claims = (tokenResult?.claims || {}) as Record<string, unknown>;
  const providerEmail = authUser.providerData.find((item) => item.email)?.email || "";

  let email =
    authUser.email ||
    providerEmail ||
    runtimeAuditUser?.email ||
    resolveEmailFromClerkUser(clerkUser) ||
    (typeof claims.email === "string" ? claims.email : "") ||
    "";
  let name =
    authUser.displayName ||
    runtimeAuditUser?.name ||
    resolveNameFromClerkUser(clerkUser) ||
    (typeof claims.name === "string" ? claims.name : "") ||
    "";
  let clerkId = runtimeAuditUser?.clerkId || uid;
  let role: string | undefined;

  try {
    const dbUserById = await databaseService.get<{
      email?: string;
      name?: string;
      clerkId?: string;
      role?: string;
      organizationRoles?: Record<string, string>;
    }>("users", uid);

    const claimClerkId =
      runtimeAuditUser?.clerkId ||
      clerkUser?.id ||
      (typeof claims.clerkId === "string"
        ? claims.clerkId
        : typeof claims.clerk_id === "string"
          ? claims.clerk_id
          : uid);

    const dbUserByClerkId =
      dbUserById?.clerkId === claimClerkId
        ? dbUserById
        : await databaseService.getByField<{
            email?: string;
            name?: string;
            clerkId?: string;
            role?: string;
            organizationRoles?: Record<string, string>;
          }>("users", [{ field: "clerkId", operator: "==", value: claimClerkId }]);

    const dbUser = dbUserById || dbUserByClerkId;

    email = email || dbUser?.email || "";
    name = name || dbUser?.name || "";
    clerkId = dbUser?.clerkId || claimClerkId || clerkId;
    role = dbUser?.role;
  } catch {
    // Do not fail audit path on user profile lookup issues.
  }

  if (!email) {
    email = `${uid}@unknown.local`;
  }

  if (!name) {
    name = email.split("@")[0] || "Unknown User";
  }

  const resolved: AuditUserContext = {
    userId: uid,
    clerkId,
    email,
    name,
    role,
    userAgent: getNavigatorUserAgent(),
  };

  cachedAuditUid = uid;
  cachedAuditUser = resolved;
  return resolved;
}

async function createClientAuditLog(
  options: BaseClientAuditOptions & {
    outcome: CreateAuditLogInput["outcome"];
  },
): Promise<void> {
  if (!options.organizationId) {
    if (import.meta.env.DEV) {
      console.warn("[AUDIT] Skipping audit log due to missing organizationId", {
        action: options.action,
      });
    }
    return;
  }

  try {
    const userContext = await resolveAuditUserContext();
    if (!userContext) {
      if (import.meta.env.DEV) {
        console.warn("[AUDIT] Skipping audit log due to missing user context", {
          action: options.action,
          organizationId: options.organizationId,
        });
      }
      return;
    }

    const payload = stripUndefinedDeep<CreateAuditLogInput>({
      organizationId: options.organizationId,
      action: options.action,
      user: userContext,
      resource: options.resource,
      metadata: {
        source: "web",
        ...options.metadata,
      },
      outcome: options.outcome,
    });

    await auditLogService.createAuditLog(payload);
  } catch (error) {
    if (import.meta.env.DEV) {
      const maybeFunctionError = error as {
        code?: string;
        message?: string;
        details?: unknown;
      };
      console.warn("[AUDIT] Failed to create audit log", {
        action: options.action,
        organizationId: options.organizationId,
        error: error instanceof Error ? error.message : String(error),
        code: maybeFunctionError?.code,
        details: maybeFunctionError?.details,
      });
    }
    // Audit logging must not break end-user flows.
  }
}

export async function logClientAuditSuccess(
  options: SuccessClientAuditOptions,
): Promise<void> {
  await createClientAuditLog({
    ...options,
    outcome: {
      status: "success",
      durationMs: options.durationMs,
    },
  });
}

export async function logClientAuditFailure(
  options: FailureClientAuditOptions,
): Promise<void> {
  const error =
    options.error instanceof Error
      ? options.error
      : new Error(String(options.error));

  await createClientAuditLog({
    ...options,
    outcome: {
      status: "failure",
      durationMs: options.durationMs,
      errorCode: options.errorCode,
      errorMessage: error.message,
    },
  });
}

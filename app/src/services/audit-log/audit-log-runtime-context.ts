export interface RuntimeAuditUserContext {
  clerkId: string;
  email?: string;
  name?: string;
}

let runtimeAuditUserContext: RuntimeAuditUserContext | null = null;

export function setRuntimeAuditUserContext(
  value: RuntimeAuditUserContext | null,
): void {
  runtimeAuditUserContext = value;
}

export function getRuntimeAuditUserContext(): RuntimeAuditUserContext | null {
  return runtimeAuditUserContext;
}

export type DomainErrorKind =
  | "not-found"
  | "invalid-input"
  | "unauthorized"
  | "forbidden"
  | "illegal-state"
  | "conflict"
  | "internal";

interface DomainErrorDetails {
  kind: DomainErrorKind;
  [key: string]: unknown;
}

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly details: DomainErrorDetails;

  constructor(details: DomainErrorDetails) {
    super((details.reason as string) ?? details.kind);
    this.name = "DomainError";
    this.kind = details.kind;
    this.details = details;
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

export function domainErrorToHttpsCode(
  err: DomainError,
): "not-found" | "invalid-argument" | "unauthenticated" | "permission-denied" | "failed-precondition" | "already-exists" | "internal" {
  const map = {
    "not-found": "not-found",
    "invalid-input": "invalid-argument",
    "unauthorized": "unauthenticated",
    "forbidden": "permission-denied",
    "illegal-state": "failed-precondition",
    "conflict": "already-exists",
    "internal": "internal",
  } as const;
  return map[err.kind];
}

export type SecretariaErrorCode =
  | "UOR_AUTH_REQUIRED"
  | "SECRETARIA_INTEGRATION_DISABLED"
  | "SECRETARIA_SESSION_REQUIRED"
  | "SECRETARIA_AUTH_FAILED"
  | "SECRETARIA_REAUTH_REQUIRED"
  | "SECRETARIA_IDENTITY_MISMATCH"
  | "SECRETARIA_STUDENT_NOT_ELIGIBLE"
  | "SECRETARIA_UPSTREAM_CHANGED"
  | "SECRETARIA_UNAVAILABLE"
  | "SECRETARIA_CIRCUIT_OPEN"
  | "SECRETARIA_REQUEST_INVALID"
  | "SECRETARIA_CAPABILITY_DISABLED"
  | "SECRETARIA_RESOURCE_NOT_FOUND"
  | "SECRETARIA_RESPONSE_TOO_LARGE"
  | "SECRETARIA_UNSAFE_REDIRECT"
  | "SECRETARIA_ENVELOPE_INVALID"
  | "SECRETARIA_KEY_UNAVAILABLE"
  | "SECRETARIA_CONFIGURATION_INVALID"
  | "SECRETARIA_IDEMPOTENCY_CONFLICT"
  | "SECRETARIA_COMMAND_STATE_INVALID"
  | "SECRETARIA_COMMAND_EXPIRED"
  | "SECRETARIA_COMMAND_OUTCOME_UNKNOWN"
  | "SECRETARIA_STEP_UP_REQUIRED"
  | "SECRETARIA_VALIDATION_FAILED"
  | "SECRETARIA_PRECONDITION_FAILED"
  | "SECRETARIA_COMMAND_RECONCILIATION_UNSUPPORTED";

export class SecretariaError extends Error {
  readonly name = "SecretariaError";

  constructor(
    readonly code: SecretariaErrorCode,
    message: string,
    readonly statusCode: number,
    readonly retryable = false,
    readonly actionRequired: "none" | "connect" | "reauthenticate" | "contact_support" = "none",
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function isSecretariaError(error: unknown): error is SecretariaError {
  return error instanceof SecretariaError;
}

export type MoodleErrorCode =
  | "UOR_AUTH_REQUIRED"
  | "UOR_CSRF_INVALID"
  | "MOODLE_INTEGRATION_DISABLED"
  | "MOODLE_UNAVAILABLE"
  | "MOODLE_UPSTREAM_CHANGED"
  | "MOODLE_CONNECTION_REQUIRED"
  | "MOODLE_CONNECTION_IN_PROGRESS"
  | "MOODLE_CONNECTION_CANCELLED"
  | "MOODLE_REAUTH_REQUIRED"
  | "MOODLE_CREDENTIALS_INVALID"
  | "MOODLE_IDENTITY_MISMATCH"
  | "MOODLE_STUDENT_NOT_ELIGIBLE"
  | "MOODLE_REQUEST_INVALID"
  | "MOODLE_MEDIA_TYPE_UNSUPPORTED"
  | "MOODLE_RESOURCE_NOT_FOUND"
  | "MOODLE_SNAPSHOT_CHANGED"
  | "MOODLE_CURSOR_INVALID"
  | "MOODLE_SYNC_CONFLICT"
  | "MOODLE_RATE_LIMITED"
  | "MOODLE_MATERIAL_TYPE_UNSUPPORTED"
  | "MOODLE_MISCONFIGURED";

export type MoodleActionRequired = "none" | "connect" | "reauthenticate" | "contact_support";

export class MoodleError extends Error {
  readonly name = "MoodleError";

  constructor(
    readonly code: MoodleErrorCode,
    message: string,
    readonly statusCode: number,
    readonly retryable = false,
    readonly actionRequired: MoodleActionRequired = "none",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function isMoodleError(error: unknown): error is MoodleError {
  return error instanceof MoodleError;
}

export function moodleConnectionRequired(): MoodleError {
  return new MoodleError(
    "MOODLE_CONNECTION_REQUIRED",
    "Liga a tua conta Moodle para continuar.",
    409,
    false,
    "connect",
  );
}

export function moodleUnavailable(cause?: unknown): MoodleError {
  return new MoodleError(
    "MOODLE_UNAVAILABLE",
    "O Moodle está temporariamente indisponível. Tenta novamente.",
    503,
    true,
    "none",
    cause instanceof Error ? { cause } : undefined,
  );
}

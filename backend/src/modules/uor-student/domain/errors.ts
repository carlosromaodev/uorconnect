export class UorStudentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly retryable = false,
    readonly actionRequired: "none" | "provide_credentials" | "contact_support" = "none",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "UorStudentError";
  }
}

export function isUorStudentError(error: unknown): error is UorStudentError {
  return error instanceof UorStudentError;
}

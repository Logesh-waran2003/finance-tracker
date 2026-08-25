/**
 * Shared service-layer error type.
 * Services throw ServiceError for expected business-rule failures.
 * Routes catch it and map to the appropriate HTTP status.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export type ReviewPilotErrorCode = 'configuration' | 'api' | 'response';

export class ReviewPilotError extends Error {
  public readonly name: string = 'ReviewPilotError';

  public constructor(
    message: string,
    public readonly code: ReviewPilotErrorCode,
  ) {
    super(message);
  }
}

export class ConfigurationError extends ReviewPilotError {
  public readonly name = 'ConfigurationError';

  public constructor(message: string) {
    super(message, 'configuration');
  }
}

export class ApiError extends ReviewPilotError {
  public readonly name = 'ApiError';

  public constructor(message: string, public readonly status?: number, public readonly cause?: unknown) {
    super(message, 'api');
  }
}

export class ResponseError extends ReviewPilotError {
  public readonly name = 'ResponseError';

  public constructor(message: string) {
    super(message, 'response');
  }
}

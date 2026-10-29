
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_SERVER_ERROR",
    public readonly diagnostic?: {
      provider: "smtp";
      name?: string;
      code?: string;
      command?: string;
      responseCode?: number;
      stage?: string;
    },
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

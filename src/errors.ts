/** Thrown for any non-2xx API response (and network failures, with status 0). */
export class TempMailerError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TempMailerError";
    this.status = status;
    this.code = code;
  }
}

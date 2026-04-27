export interface DbErrorShape {
  code: string;
  message: string;
}

export class DbError extends Error implements DbErrorShape {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
  }

  static cancelled(): DbError {
    return new DbError("QUERY_CANCELLED", "Query cancelled");
  }

  static timeout(): DbError {
    return new DbError(
      "QUERY_TIMEOUT",
      "Query exceeded the configured timeout"
    );
  }

  static unsupported(message: string): DbError {
    return new DbError("UNSUPPORTED", message);
  }

  static fromUnknown(err: unknown, fallbackCode = "UNKNOWN_ERROR"): DbError {
    if (err instanceof DbError) {
      return err;
    }
    if (err instanceof Error) {
      return new DbError(fallbackCode, err.message);
    }
    return new DbError(fallbackCode, String(err));
  }

  toJSON(): DbErrorShape {
    return { code: this.code, message: this.message };
  }
}

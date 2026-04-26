export type AIErrorType =
  | "auth"
  | "rate_limit"
  | "network"
  | "model_not_found"
  | "context_length"
  | "provider_error"
  | "unknown";

export interface AIError {
  type: AIErrorType;
  message: string;
  suggestion: string;
  retryable: boolean;
}

const ERROR_MAP: Record<AIErrorType, Omit<AIError, "type">> = {
  auth: {
    message: "Invalid API key or unauthorized access.",
    retryable: false,
    suggestion: "Check your API key in AI settings.",
  },
  context_length: {
    message: "The query is too large for this model.",
    retryable: false,
    suggestion: "Try a shorter query or switch to a model with more context.",
  },
  model_not_found: {
    message: "The configured model was not found.",
    retryable: false,
    suggestion: "Check the model name in AI settings.",
  },
  network: {
    message: "Cannot reach the AI provider.",
    retryable: true,
    suggestion: "Check your internet connection and try again.",
  },
  provider_error: {
    message: "The AI provider returned an error.",
    retryable: true,
    suggestion: "This is usually temporary. Try again in a moment.",
  },
  rate_limit: {
    message: "Rate limit reached.",
    retryable: true,
    suggestion: "Wait a moment and try again.",
  },
  unknown: {
    message: "An unexpected error occurred.",
    retryable: true,
    suggestion: "Try again or check your AI settings.",
  },
};

const getStatusCode = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const err = error as Record<string, unknown>;

  if (typeof err.status === "number") {
    return err.status;
  }
  if (typeof err.statusCode === "number") {
    return err.statusCode;
  }

  if (typeof err.data === "object" && err.data !== null) {
    const data = err.data as Record<string, unknown>;
    if (typeof data.status === "number") {
      return data.status;
    }
  }

  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const classifyByStatus = (status: number): AIErrorType | null => {
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status === 404) {
    return "model_not_found";
  }
  if (status >= 500) {
    return "provider_error";
  }
  return null;
};

const classifyByMessage = (message: string): AIErrorType | null => {
  const lower = message.toLowerCase();

  if (
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("authentication")
  ) {
    return "auth";
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "rate_limit";
  }

  if (
    lower.includes("model not found") ||
    lower.includes("does not exist") ||
    lower.includes("model_not_found")
  ) {
    return "model_not_found";
  }

  if (
    lower.includes("context length") ||
    lower.includes("token limit") ||
    lower.includes("maximum context") ||
    lower.includes("too many tokens")
  ) {
    return "context_length";
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("failed to fetch")
  ) {
    return "network";
  }

  return null;
};

export const classifyAIError = (error: unknown): AIError => {
  const status = getStatusCode(error);
  const message = getErrorMessage(error);

  const type =
    (status !== null ? classifyByStatus(status) : null) ??
    classifyByMessage(message) ??
    "unknown";

  return { type, ...ERROR_MAP[type] };
};

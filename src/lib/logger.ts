type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

type LogMeta = Record<string, unknown>;

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const sensitiveKeyPattern = /(password|token|secret|api[_-]?key|authorization|cookie|session|service[_-]?role)/i;

function configuredLevel(): LogLevel {
  const level = process.env.LOG_LEVEL;
  if (level === "debug" || level === "info" || level === "warn" || level === "error" || level === "fatal") {
    return level;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function maskEmail(value: string) {
  return value.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[REDACTED]" : sanitizeValue(nestedValue),
      ]),
    );
  }

  if (typeof value === "string" && value.includes("@")) {
    return maskEmail(value);
  }

  return value;
}

function shouldLog(level: LogLevel) {
  return levelWeight[level] >= levelWeight[configuredLevel()];
}

function write(level: LogLevel, message: string, meta: LogMeta = {}) {
  if (!shouldLog(level)) return;

  const sanitizedMeta = sanitizeValue(meta) as LogMeta;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "roomza-web",
    message,
    ...sanitizedMeta,
  };

  const line = JSON.stringify(entry);
  if (level === "error" || level === "fatal") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => write("debug", message, meta),
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta),
  fatal: (message: string, meta?: LogMeta) => write("fatal", message, meta),
};

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, prefix: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    prefix,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

export const logger = {
  info(prefix: string, message: string, meta?: Record<string, unknown>) {
    log("info", prefix, message, meta);
  },
  warn(prefix: string, message: string, meta?: Record<string, unknown>) {
    log("warn", prefix, message, meta);
  },
  error(prefix: string, message: string, meta?: Record<string, unknown>) {
    log("error", prefix, message, meta);
  },
};

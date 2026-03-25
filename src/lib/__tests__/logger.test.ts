import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  let mockLog: ReturnType<typeof vi.fn>;
  let mockWarn: ReturnType<typeof vi.fn>;
  let mockError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLog = vi.fn();
    mockWarn = vi.fn();
    mockError = vi.fn();
    console.log = mockLog;
    console.warn = mockWarn;
    console.error = mockError;
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("logger.info calls console.log with JSON", () => {
    logger.info("TEST", "hello world");
    expect(mockLog).toHaveBeenCalledOnce();
    const parsed = JSON.parse(mockLog.mock.calls[0][0]);
    expect(parsed.level).toBe("info");
    expect(parsed.prefix).toBe("TEST");
    expect(parsed.message).toBe("hello world");
    expect(parsed.timestamp).toBeTruthy();
  });

  it("logger.warn calls console.warn with JSON", () => {
    logger.warn("STRIPE", "price missing");
    expect(mockWarn).toHaveBeenCalledOnce();
    const parsed = JSON.parse(mockWarn.mock.calls[0][0]);
    expect(parsed.level).toBe("warn");
    expect(parsed.prefix).toBe("STRIPE");
  });

  it("logger.error calls console.error with JSON", () => {
    logger.error("DB", "connection failed");
    expect(mockError).toHaveBeenCalledOnce();
    const parsed = JSON.parse(mockError.mock.calls[0][0]);
    expect(parsed.level).toBe("error");
    expect(parsed.prefix).toBe("DB");
    expect(parsed.message).toBe("connection failed");
  });

  it("includes meta fields in the JSON output", () => {
    logger.info("CRON", "job done", { orgId: "org-1", count: 5 });
    const parsed = JSON.parse(mockLog.mock.calls[0][0]);
    expect(parsed.orgId).toBe("org-1");
    expect(parsed.count).toBe(5);
  });

  it("outputs valid JSON", () => {
    logger.info("TEST", "special chars: \"quotes\" & <angle>");
    expect(() => JSON.parse(mockLog.mock.calls[0][0])).not.toThrow();
  });

  it("includes ISO timestamp", () => {
    logger.info("TEST", "time check");
    const parsed = JSON.parse(mockLog.mock.calls[0][0]);
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

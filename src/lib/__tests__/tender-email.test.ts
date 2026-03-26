import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock resend before importing the module under test
vi.mock("resend", () => ({
  Resend: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { sendTenderNotification } from "@/lib/notifications/tender-email";

// mockSend is what the fake Resend instance's emails.send points to
const mockSend = vi.fn();

// The vi.mock factory already ran with `Resend: vi.fn()`.
// We need Resend to behave as a constructable class, so we import it and
// configure its mock implementation via mockImplementation with a real function.
import { Resend } from "resend";
const MockResend = vi.mocked(Resend);

describe("sendTenderNotification", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: configure a key so most tests work
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    // Use a real constructor function so `new Resend(...)` works
    MockResend.mockImplementation(function () {
      return { emails: { send: mockSend } };
    } as unknown as new (...args: unknown[]) => InstanceType<typeof Resend>);
  });

  afterEach(() => {
    // Restore original env values
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  it("returns error when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendTenderNotification(
      "carrier@example.com",
      "ACME Freight",
      "LOAD-001",
      "token-abc"
    );

    expect(result).toEqual({ success: false, error: "Resend not configured" });
    expect(MockResend).not.toHaveBeenCalled();
  });

  it("sends email successfully when configured", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-id-1" }, error: null });

    const result = await sendTenderNotification(
      "carrier@example.com",
      "ACME Freight",
      "LOAD-001",
      "token-abc"
    );

    expect(result).toEqual({ success: true });
    expect(MockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["carrier@example.com"],
        subject: "Load Tender - LOAD-001",
      })
    );
  });

  it("returns error when Resend API returns an error object", async () => {
    const apiError = { name: "validation_error", message: "Invalid email address" };
    mockSend.mockResolvedValue({ data: null, error: apiError });

    const result = await sendTenderNotification(
      "bad-email",
      "ACME Freight",
      "LOAD-002",
      "token-xyz"
    );

    expect(result).toEqual({ success: false, error: "Invalid email address" });
  });

  it("catches thrown exceptions and returns generic error", async () => {
    mockSend.mockRejectedValue(new Error("Network timeout"));

    const result = await sendTenderNotification(
      "carrier@example.com",
      "ACME Freight",
      "LOAD-003",
      "token-def"
    );

    expect(result).toEqual({ success: false, error: "Failed to send tender email" });
  });

  it("email contains the tender link with the correct token", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-id-2" }, error: null });

    await sendTenderNotification(
      "carrier@example.com",
      "ACME Freight",
      "LOAD-004",
      "my-unique-token-999"
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = mockSend.mock.calls[0][0] as { html: string };
    const expectedLink = "https://app.example.com/tender/my-unique-token-999";
    expect(callArg.html).toContain(expectedLink);
  });
});

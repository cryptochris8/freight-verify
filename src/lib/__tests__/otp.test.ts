import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, verifyOtp } from "@/lib/verification/otp";

describe("generateOtp", () => {
  it("returns a 6-digit string", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("returns a number between 100000 and 999999", () => {
    for (let i = 0; i < 50; i++) {
      const num = parseInt(generateOtp(), 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThan(1000000);
    }
  });

  it("generates different values on successive calls", () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOtp()));
    // With 20 random 6-digit numbers, duplicates are extremely unlikely
    expect(otps.size).toBeGreaterThan(1);
  });
});

describe("hashOtp", () => {
  it("returns a string in salt:hash format", () => {
    const hash = hashOtp("123456");
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("salt is 32 hex chars (16 bytes)", () => {
    const hash = hashOtp("123456");
    const [salt] = hash.split(":");
    expect(salt).toHaveLength(32);
  });

  it("hash is 64 hex chars (SHA-256)", () => {
    const hash = hashOtp("123456");
    const [, hashPart] = hash.split(":");
    expect(hashPart).toHaveLength(64);
  });

  it("produces different hashes for the same OTP (random salt)", () => {
    const h1 = hashOtp("123456");
    const h2 = hashOtp("123456");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyOtp", () => {
  it("returns true for a correct OTP", () => {
    const otp = "654321";
    const stored = hashOtp(otp);
    expect(verifyOtp(otp, stored)).toBe(true);
  });

  it("returns false for an incorrect OTP", () => {
    const stored = hashOtp("654321");
    expect(verifyOtp("000000", stored)).toBe(false);
  });

  it("returns false for a malformed stored hash (no colon)", () => {
    expect(verifyOtp("123456", "invalidhash")).toBe(false);
  });

  it("returns false for empty stored hash", () => {
    expect(verifyOtp("123456", "")).toBe(false);
  });

  it("works with the full generate -> hash -> verify flow", () => {
    const otp = generateOtp();
    const stored = hashOtp(otp);
    expect(verifyOtp(otp, stored)).toBe(true);
    expect(verifyOtp("000000", stored)).toBe(false);
  });
});

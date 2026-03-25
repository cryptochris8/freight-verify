import { describe, it, expect } from "vitest";
import { calculateDistance, isWithinRange } from "@/lib/verification/geo";

describe("calculateDistance (Haversine)", () => {
  it("returns 0 for the same point", () => {
    expect(calculateDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates distance between NYC and LA correctly (~2451 mi)", () => {
    // NYC: 40.7128, -74.0060
    // LA:  34.0522, -118.2437
    const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(2440);
    expect(distance).toBeLessThan(2460);
  });

  it("calculates short distance correctly (~0.86 mi between two nearby points)", () => {
    // Times Square: 40.7580, -73.9855
    // Grand Central: 40.7527, -73.9772
    const distance = calculateDistance(40.758, -73.9855, 40.7527, -73.9772);
    expect(distance).toBeGreaterThan(0.3);
    expect(distance).toBeLessThan(1.5);
  });

  it("handles cross-equator calculation", () => {
    // NYC to Buenos Aires
    const distance = calculateDistance(40.7128, -74.006, -34.6037, -58.3816);
    expect(distance).toBeGreaterThan(5200);
    expect(distance).toBeLessThan(5400);
  });

  it("handles cross-meridian calculation", () => {
    // London to Tokyo
    const distance = calculateDistance(51.5074, -0.1278, 35.6762, 139.6503);
    expect(distance).toBeGreaterThan(5900);
    expect(distance).toBeLessThan(6000);
  });

  it("is symmetric (A→B equals B→A)", () => {
    const d1 = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    const d2 = calculateDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it("handles coordinates at the poles", () => {
    // North pole to south pole = ~12,436 miles (half circumference)
    const distance = calculateDistance(90, 0, -90, 0);
    expect(distance).toBeGreaterThan(12400);
    expect(distance).toBeLessThan(12500);
  });
});

describe("isWithinRange", () => {
  it("returns true when within default 5-mile range", () => {
    // Two points ~0.5 miles apart
    expect(isWithinRange(
      { lat: 40.758, lng: -73.9855 },
      { lat: 40.7527, lng: -73.9772 }
    )).toBe(true);
  });

  it("returns false when outside default 5-mile range", () => {
    // NYC to LA
    expect(isWithinRange(
      { lat: 40.7128, lng: -74.006 },
      { lat: 34.0522, lng: -118.2437 }
    )).toBe(false);
  });

  it("respects custom maxMiles parameter", () => {
    // Two points ~0.5 miles apart, with 0.1 mile max
    expect(isWithinRange(
      { lat: 40.758, lng: -73.9855 },
      { lat: 40.7527, lng: -73.9772 },
      0.1
    )).toBe(false);
  });

  it("returns true for the exact same point", () => {
    expect(isWithinRange(
      { lat: 40.7128, lng: -74.006 },
      { lat: 40.7128, lng: -74.006 }
    )).toBe(true);
  });
});

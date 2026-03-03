import { calculateDistance } from "./geo";

export interface GeoData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeoComparisonResult {
  distance: number;
  isWithinRange: boolean;
  warning?: string;
}

/**
 * Browser-side geolocation capture wrapper.
 * This function is meant to be called from client components.
 * Returns geolocation data including lat, lng, accuracy, and timestamp.
 */
export function captureGeolocation(): Promise<GeoData> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Compares captured geolocation with a load's origin coordinates.
 * Uses the existing calculateDistance() function.
 * Default range threshold is 5 miles.
 */
export function compareToOrigin(
  geoData: { lat: number; lng: number },
  loadOrigin: { lat: number; lng: number },
  maxMiles: number = 5
): GeoComparisonResult {
  const distance = calculateDistance(
    geoData.lat,
    geoData.lng,
    loadOrigin.lat,
    loadOrigin.lng
  );

  const isWithinRange = distance <= maxMiles;

  const result: GeoComparisonResult = {
    distance: Math.round(distance * 10) / 10,
    isWithinRange,
  };

  if (!isWithinRange) {
    result.warning = `You appear to be ${result.distance} miles from the pickup location`;
  }

  return result;
}

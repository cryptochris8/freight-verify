/**
 * Calculates the distance between two geographic coordinates
 * using the Haversine formula. Returns distance in miles.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Checks whether a verification location is within a specified distance
 * of a load origin.
 */
export function isWithinRange(
  verificationGeo: { lat: number; lng: number },
  loadOriginGeo: { lat: number; lng: number },
  maxMiles: number = 5
): boolean {
  const distance = calculateDistance(
    verificationGeo.lat,
    verificationGeo.lng,
    loadOriginGeo.lat,
    loadOriginGeo.lng
  );
  return distance <= maxMiles;
}

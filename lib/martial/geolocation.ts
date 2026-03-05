import type { GeoPoint } from "./types";

const R = 6371000; // Earth radius in metres

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two geographic points (metres).
 */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(chord)));
}

/**
 * Returns true if `current` is within `radiusM` metres of `centre`.
 */
export function isInRange(centre: GeoPoint, radiusM: number, current: GeoPoint): boolean {
  return haversineM(centre, current) <= radiusM;
}

/**
 * Browser wrapper: resolves current position using the Geolocation API.
 * Returns null if permission denied or unavailable.
 */
export async function getCurrentPosition(
  options?: PositionOptions
): Promise<GeolocationCoordinates | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30000, ...options }
    );
  });
}

/**
 * Check whether the browser's current position is within a Place's geofence.
 * Returns `{ inRange, distanceM, coords }`.
 */
export async function checkPlaceRange(centre: GeoPoint, radiusM: number): Promise<{
  inRange: boolean;
  distanceM: number | null;
  coords: GeolocationCoordinates | null;
}> {
  const coords = await getCurrentPosition();
  if (!coords) return { inRange: false, distanceM: null, coords: null };

  const current: GeoPoint = { lat: coords.latitude, lng: coords.longitude };
  const distanceM = haversineM(centre, current);
  return { inRange: distanceM <= radiusM, distanceM, coords };
}

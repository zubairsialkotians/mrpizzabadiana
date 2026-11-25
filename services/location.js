/*
  The phone's location (while the app is open only). expo-location is a native module: an app build made
  before it was added doesn't have it, so everything here reports 'unavailable' instead of crashing.
*/
let Location = null;
try {
  Location = require('expo-location'); // eslint-disable-line global-require
} catch (e) {
  Location = null;
}

export const locationAvailable = () => !!Location;

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

// { status: 'ok', lat, lng, accuracy } | { status: 'denied' | 'off' | 'unavailable' | 'error', message }
// ask: show the permission prompt when not decided yet
export async function currentLocation({ ask = true, timeout = 15000 } = {}) {
  if (!Location) return { status: 'unavailable', message: 'Location needs the latest version of the app.' };
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && ask && perm.canAskAgain !== false) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied', message: 'Location permission is off for this app.' };
    if (!(await Location.hasServicesEnabledAsync())) return { status: 'off', message: 'Turn on location (GPS) on your phone.' };
    let pos;
    try {
      pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout);
    } catch (e) {
      // No fresh fix in time (indoors…): a recent one is still useful
      pos = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
    }
    if (!pos) return { status: 'error', message: 'Could not find your location. Try again.' };
    return {
      status: 'ok',
      lat: Math.round(pos.coords.latitude * 1e7) / 1e7,
      lng: Math.round(pos.coords.longitude * 1e7) / 1e7,
      accuracy: Math.round(pos.coords.accuracy || 0),
    };
  } catch (e) {
    return { status: 'error', message: e.message || 'Could not find your location.' };
  }
}

export function openLocationSettings() {
  try {
    const { Linking } = require('react-native'); // eslint-disable-line global-require
    Linking.openSettings();
  } catch (e) { /* ignore */ }
}

// Straight-line distance in km (same as the server)
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const kmLabel = (km) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km < 10 ? km.toFixed(1).replace(/\.0$/, '') : Math.round(km)} km`);

// "32.4945, 74.5229", a Google Maps link with @lat,lng or ?q=lat,lng → { lat, lng } (null when not found / invalid)
export function parseLatLng(text) {
  const m = String(text || '').match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

// Where the shop is, from the /shop answer (null when not set)
export function shopPoint(shop) {
  return shop && shop.shop_lat != null && shop.shop_lng != null ? { lat: Number(shop.shop_lat), lng: Number(shop.shop_lng) } : null;
}

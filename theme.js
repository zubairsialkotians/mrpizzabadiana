// Brand colour comes from .env (EXPO_PUBLIC_PRIMARY_COLOR) so each shop's copy of the app has its own look.
// brand = fills (buttons, chips, cart bar); primary = text/icons/borders on white.
// For a light brand (e.g. yellow) text on fills turns dark and primary uses EXPO_PUBLIC_ACCENT_COLOR or a darker shade.
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v || '');
const brand = isHex(process.env.EXPO_PUBLIC_PRIMARY_COLOR) ? process.env.EXPO_PUBLIC_PRIMARY_COLOR : '#e9dd12';

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
const lightBrand = luminance(brand) > 0.4;

// Mix the brand colour with white (amount 0–1) for soft backgrounds
function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c * (1 - amount));
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const primary = isHex(process.env.EXPO_PUBLIC_ACCENT_COLOR)
  ? process.env.EXPO_PUBLIC_ACCENT_COLOR
  : lightBrand ? shade(brand, 0.5) : brand;

export const colors = {
  brand,
  onBrand: lightBrand ? '#1a1a1a' : '#ffffff',
  primary,
  primaryDark: shade(primary, 0.35),
  primarySoft: tint(brand, lightBrand ? 0.8 : 0.88),
  black: '#0b1020',
  surface: '#ffffff',
  background: '#faf7f2',
  border: '#ede7dc',
  text: '#111827',
  muted: '#64748b',
  faint: '#94a3b8',
  success: '#15803d',
  successSoft: '#e7f6ec',
  danger: '#c0392b',
  dangerSoft: '#fbe9e7',
  warning: '#b45309',
  warningSoft: '#fdf1e2',
  sale: '#e11d48',
};

export const statusColors = {
  pending:          { fg: '#b45309', bg: '#fdf1e2' },
  confirmed:        { fg: '#1d4ed8', bg: '#e8eefc' },
  ready_for_delivery: { fg: '#0f766e', bg: '#e0f4f1' },
  out_for_delivery: { fg: '#7c3aed', bg: '#f1eafe' },
  ready:            { fg: '#7c3aed', bg: '#f1eafe' },
  delivered:        { fg: '#15803d', bg: '#e7f6ec' },
  completed:        { fg: '#ffffff', bg: '#15803d' },
  cancelled:        { fg: '#c0392b', bg: '#fbe9e7' },
  active:           { fg: '#15803d', bg: '#e7f6ec' },
  inactive:         { fg: '#64748b', bg: '#eef1f5' },
};

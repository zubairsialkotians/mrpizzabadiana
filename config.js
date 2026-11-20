// EXPO_PUBLIC_* values are inlined at build time from .env (one .env per shop's app)
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Mr Pizza Badiana';
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://sialkotians.com';
// From WP admin → Users → the shop owner's profile → "Shop key"
export const SHOP_KEY = process.env.EXPO_PUBLIC_SHOP_KEY || '';

// Developer promo under the login form (same in every shop's copy of the app)
export const DEVELOPER_PHONE = '03460364457';

// Play Store: public privacy policy page, shown in My account (set EXPO_PUBLIC_PRIVACY_URL; hidden while empty).
// Account deletion is done in the app, from My account.
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || '';

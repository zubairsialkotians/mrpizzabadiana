// EXPO_PUBLIC_* values are inlined at build time from .env (one .env per shop's app)
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Mr Pizza Badiana';
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://sialkotians.com';
// From WP admin → Users → the shop owner's profile → "Shop key"
export const SHOP_KEY = process.env.EXPO_PUBLIC_SHOP_KEY || '';

// Developer promo under the login form (same in every shop's copy of the app)
export const DEVELOPER_PHONE = '03460364457';

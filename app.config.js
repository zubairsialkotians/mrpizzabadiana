// Shop app: one codebase, one copy per shop. Name, colours, bundle ID and shop key come from .env.
const fs = require('fs');

// eas-cli evaluates this file with dotenv loading disabled — read .env here so
// EAS commands also see APP_* and EAS_PROJECT_ID. Variables already set win.
const envFile = require('path').join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const name     = process.env.APP_NAME      || 'Mr Pizza Badiana';
const slug     = process.env.APP_SLUG      || 'mrpizzabadiana';
const bundleId = process.env.APP_BUNDLE_ID || 'mr.pizza.badiana';
const primary  = process.env.EXPO_PUBLIC_PRIMARY_COLOR || '#e9dd12';

const projectId          = process.env.EAS_PROJECT_ID || undefined;
const googleServicesFile = process.env.GOOGLE_SERVICES_FILE || './google-services.json';

module.exports = {
  expo: {
    name,
    slug,
    owner: process.env.EXPO_OWNER || 'zbhaientheo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#1c1714',
    },
    plugins: [
      ['expo-notifications', { color: primary }],
      'expo-system-ui',
      // Product photos and shop logo (staff)
      ['expo-image-picker', { photosPermission: 'Choose a payment screenshot, or photos for your products and shop logo.', cameraPermission: 'Take photos of your products.', microphonePermission: false }],
      // Location while the app is open only: customer's spot sent with the order, shop location in settings
      ['expo-location', { locationWhenInUsePermission: "Share your location with your order so the shop can find you and tell how far you are.", isAndroidBackgroundLocationEnabled: false, isIosBackgroundLocationEnabled: false }],
      // Embedded icon font so icons never depend on runtime font loading
      ['expo-font', { fonts: ['./assets/fonts/ionicons.ttf'] }],
      './plugins/withNoForceDark',
      // Portrait lock must not hide the app from devices without a portrait screen
      './plugins/withOptionalPortrait',
      // Google Play requires target API level 36 (Android 16)
      ['expo-build-properties', { android: { compileSdkVersion: 36, targetSdkVersion: 36, buildToolsVersion: '36.0.0' } }],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1c1714',
      },
      edgeToEdgeEnabled: true,
      // No ads or ad tracking: keep libraries from adding the advertising ID permission.
      // Gallery picks go through the system photo picker, so broad media/storage access isn't needed
      // (avoids Play's Photo & Video permissions declaration). No microphone use.
      blockedPermissions: [
        'com.google.android.gms.permission.AD_ID',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
      ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
    web: { favicon: './assets/favicon.png' },
    extra: {
      ...(projectId ? { eas: { projectId } } : {}),
    },
  },
};

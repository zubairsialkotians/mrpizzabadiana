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
const bundleId = process.env.APP_BUNDLE_ID || 'com.sialkotians.mrpizzabadiana';
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
      backgroundColor: '#ffffff',
    },
    plugins: [
      ['expo-notifications', { color: primary }],
      'expo-system-ui',
      // Product photos and shop logo (staff)
      ['expo-image-picker', { photosPermission: 'Choose photos for your products and shop logo.', cameraPermission: 'Take photos of your products.', microphonePermission: false }],
      // Embedded icon font so icons never depend on runtime font loading
      ['expo-font', { fonts: ['./assets/fonts/ionicons.ttf'] }],
      './plugins/withNoForceDark',
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
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
    web: { favicon: './assets/favicon.png' },
    extra: {
      ...(projectId ? { eas: { projectId } } : {}),
    },
  },
};

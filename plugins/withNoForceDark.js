// Keeps the app light even when the phone is in dark mode: some Android skins
// (MIUI, One UI) "force dark" apps unless the theme opts out.
const { withAndroidStyles } = require('expo/config-plugins');

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (cfg) => {
    const appTheme = cfg.modResults.resources.style?.find(s => s.$.name === 'AppTheme');
    if (appTheme) {
      appTheme.item = (appTheme.item || []).filter(i => i.$.name !== 'android:forceDarkAllowed');
      appTheme.item.push({ $: { name: 'android:forceDarkAllowed', 'tools:targetApi': '29' }, _: 'false' });
    }
    return cfg;
  });
};

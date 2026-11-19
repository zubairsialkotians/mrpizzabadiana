import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Expo push token sent to our server, which delivers through Expo's push service
async function getExpoPushToken() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  // Android 13+ only shows the permission prompt once a channel exists, and the
  // server sends with channelId 'default'
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Orders & news',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log('Push: EAS_PROJECT_ID is not set in .env');
    return null;
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

// Every phone (guest or logged in) registers once per launch so it gets the shop's news
export async function registerDevice() {
  try {
    const pushToken = await getExpoPushToken();
    if (pushToken) await api.registerDevice(pushToken, Platform.OS);
    return pushToken;
  } catch (e) {
    console.log('Device registration error:', e?.message || e);
    return null;
  }
}

// Returns the token it registered (kept so logout can unregister it), or null
export async function registerPush() {
  try {
    const pushToken = await getExpoPushToken();
    if (!pushToken) return null;
    await api.savePushToken(pushToken);
    return pushToken;
  } catch (e) {
    console.log('Push registration error:', e?.message || e);
    return null;
  }
}

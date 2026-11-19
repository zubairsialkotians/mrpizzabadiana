import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHOP_KEY } from '../config';

// Newest news id this phone has opened the News list for (drives the dot on the home icon)
const KEY = `news_seen_${SHOP_KEY}`;

export async function getNewsSeen() {
  try { return Number(await AsyncStorage.getItem(KEY)) || 0; } catch (_) { return 0; }
}

export async function markNewsSeen(id) {
  if (!id) return;
  try {
    if (id > (await getNewsSeen())) await AsyncStorage.setItem(KEY, String(id));
  } catch (_) {}
}

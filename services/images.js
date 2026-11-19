import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from './api';

/*
  Pick (gallery) or take (camera) a photo, shrink it, upload it to the shop's media.
  Returns { id, thumb, url } or null if cancelled.
  square: crop square in the picker (category icons, logo)
*/
export async function pickAndUpload({ camera = false, square = false, maxWidth = 1200, title = '' } = {}) {
  const out = await pickImage({ camera, square, maxWidth });
  if (!out) return null;
  const res = await api.uploadImage(out.base64, title);
  return res.image;
}

// Pick + shrink only (nothing uploaded): { uri, base64 } or null if cancelled. Used for payment screenshots.
export async function pickImage({ camera = false, square = false, maxWidth = 1200 } = {}) {
  if (camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Allow camera access in Settings to take photos.');
  }
  const opts = { mediaTypes: ['images'], quality: 1, allowsEditing: square, ...(square ? { aspect: [1, 1] } : {}) };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const out = await ImageManipulator.manipulateAsync(
    a.uri,
    a.width > maxWidth ? [{ resize: { width: maxWidth } }] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { uri: out.uri, base64: out.base64 };
}

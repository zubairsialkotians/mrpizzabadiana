import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { docHtml } from './documents';

/*
  Share a document as PDF or image through the phone's share sheet (pick WhatsApp,
  then the contact). Files get readable names like "Bill-ORD-00012.pdf".
*/

const safeName = (n) => String(n).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'document';

// The PDF embeds the logo so printing never waits on (or misses) the download
const logoCache = {};
export async function logoDataUri(url) {
  if (!url || Platform.OS === 'web') return url || '';
  if (logoCache[url]) return logoCache[url];
  try {
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';
    const dest = `${FileSystem.cacheDirectory}logo-${safeName(url.split('/').pop())}`;
    await FileSystem.downloadAsync(url, dest);
    const b64 = await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64 });
    logoCache[url] = `data:${mime};base64,${b64}`;
    return logoCache[url];
  } catch (_) {
    return url;
  }
}

async function shareFile(uri, mimeType, UTI, title) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: title });
}

export async function sharePdf(model, name) {
  if (Platform.OS === 'web') {
    // Browser: open the document and its print dialog ("Save as PDF")
    const w = window.open('', '_blank');
    if (!w) throw new Error('Allow pop-ups to open the PDF');
    w.document.write(docHtml(model, model.company.logo_url));
    w.document.close();
    // Print once the logo has loaded (or give up waiting after 3 s)
    let done = false;
    const go = () => { if (!done) { done = true; w.focus(); w.print(); } };
    const imgs = Array.from(w.document.images);
    if (imgs.every((i) => i.complete)) setTimeout(go, 200);
    else { imgs.forEach((i) => { i.onload = i.onerror = () => imgs.every((x) => x.complete) && go(); }); setTimeout(go, 3000); }
    return;
  }
  const html = docHtml(model, await logoDataUri(model.company.logo_url));
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 }); // A4
  const dest = `${FileSystem.cacheDirectory}${safeName(name)}.pdf`;
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: dest });
  await shareFile(dest, 'application/pdf', 'com.adobe.pdf', name);
}

// viewRef: the DocView on screen
export async function shareImage(viewRef, name) {
  if (Platform.OS === 'web') throw new Error('Image sharing works in the mobile app. Use PDF in the browser.');
  const uri = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile', fileName: safeName(name) });
  await shareFile(uri, 'image/png', 'public.png', name);
}

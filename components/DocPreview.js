import React, { useRef, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Footer, Button, Loading, ErrorBox } from './ui';
import DocView from './DocView';
import { sharePdf, shareImage } from '../services/share';
import { colors } from '../theme';

// Preview of a bill / order sheet with "Share PDF" and "Share image" (→ WhatsApp)
export default function DocPreview({ title, subtitle, model, fileName, loading, error, onRetry, children, extraFooter }) {
  const { width } = useWindowDimensions();
  const docWidth = Math.min(width - 28, 520);
  const ref = useRef(null);
  const [busy, setBusy] = useState('');

  const run = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'pdf') await sharePdf(model, fileName);
      else await shareImage(ref, fileName);
    } catch (e) {
      Toast.show({ type: 'error', text1: kind === 'pdf' ? 'Could not create the PDF' : 'Could not create the image', text2: e.message, visibilityTime: 5000 });
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      footer={model ? (
        <Footer>
          {extraFooter}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button testID="share-pdf" title="Share PDF" icon="document-outline" loading={busy === 'pdf'} disabled={!!busy && busy !== 'pdf'}
              onPress={() => run('pdf')} style={{ flex: 1 }} />
            <Button testID="share-image" title="Share image" icon="image-outline" variant="success" loading={busy === 'image'} disabled={!!busy && busy !== 'image'}
              onPress={() => run('image')} style={{ flex: 1 }} />
          </View>
          <Text style={{ color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 6 }}>Choose WhatsApp in the share menu, then the contact</Text>
        </Footer>
      ) : null}
    >
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={onRetry} /> : model ? (
        <>
          {children}
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignSelf: 'center' }}>
            <DocView ref={ref} model={model} width={docWidth} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

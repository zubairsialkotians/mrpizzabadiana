import React from 'react';
import { View, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button } from './ui';
import { DEVELOPER_PHONE } from '../config';
import { colors } from '../theme';

// Marketing: shop owners who want their own app contact the developer
export default function DeveloperPromo({ style }) {
  const phone = DEVELOPER_PHONE;
  const shown = phone.replace(/^(\d{4})(\d+)$/, '$1 $2');
  const wa = phone.replace(/\D/g, '').replace(/^0/, '92');
  const open = (url) => Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: 'Could not open', text2: shown }));
  return (
    <View style={[{ marginTop: 28, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', gap: 8 }, style]}>
      <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} />
      <Text style={{ fontWeight: '800', color: colors.text, textAlign: 'center' }}>Want your own shop app like this?</Text>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>
        Contact the developer by call or WhatsApp: <Text style={{ fontWeight: '700', color: colors.text }}>{shown}</Text>
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Button small variant="ghost" icon="call-outline" title="Call" onPress={() => open(`tel:${phone}`)} testID="dev-call" />
        <Button small variant="ghost" icon="logo-whatsapp" title="WhatsApp" testID="dev-whatsapp"
          onPress={() => open(`https://wa.me/${wa}?text=${encodeURIComponent('Hi, I want my own shop app like this one.')}`)} />
      </View>
    </View>
  );
}

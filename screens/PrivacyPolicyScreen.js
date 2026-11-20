import React from 'react';
import { View, Text, Linking, StyleSheet } from 'react-native';
import { Screen, Button } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { APP_NAME, PRIVACY_URL } from '../config';
import { colors } from '../theme';

// Play Store: the privacy policy, readable in the app (same text as store/privacy-policy.html).
// Shop name, address and phone come from the shop's settings, so every shop's copy stays correct.
export const PRIVACY_EFFECTIVE = '20 November 2026';

function sections(shopName, contact) {
  return [
    ['Information we collect', [
      'Name, phone number, email address and delivery address: when you create an account, check out as a guest or edit your profile. We use them to take, prepare and deliver your order, contact you about it, and let you log in and reset your password.',
      'Password: when you create an account or set a password. It is used only to log you in.',
      'Order details (items, sizes, quantities, prices, delivery or pickup, notes to the shop, order status): when you place an order, to fulfil it, show your order history and keep sales records.',
      'Payment screenshot (optional): only if you pay by Easypaisa or bank transfer and choose to upload one, to confirm your payment. We never receive your PIN, card or bank login.',
      'Order ratings and reviews (optional): when you rate an order. Seen only by shop staff.',
      'Push notification token and device type: when you allow notifications, to send order updates and shop news.',
      'The app does not collect your location, contacts, call logs, SMS, microphone audio or advertising ID. Photos are only read when you pick one yourself or take one with the camera.',
    ]],
    ['How we use it', [
      'Process, deliver and support your orders, including calling or messaging you about them.',
      'Run your account: login, password reset codes by email, order history.',
      'Send notifications about your orders and, if you allow them, shop news and offers. You can turn these off in your phone\'s settings.',
      'Keep the shop\'s sales, stock and accounting records, and keep the service secure.',
    ]],
    ['Who we share it with', [
      `${shopName} staff see your order and contact details to prepare and deliver it.`,
      'Sialkotians (sialkotians.com), who host and maintain the app\'s server, process the data only to run the service for us.',
      'Expo and Google push services receive your push token and the notification text to deliver notifications.',
      'Authorities, if required by law.',
      'We do not sell or rent your personal information, and we do not share it for advertising.',
    ]],
    ['Security', [
      'All data is sent between the app and our server over encrypted HTTPS connections. Access to customer data is limited to shop staff and the server administrator.',
    ]],
    ['How long we keep it', [
      'Account details: while your account is active.',
      'Order records: up to 5 years for the shop\'s accounting and tax records, even after the account is deleted. After deletion they are no longer linked to a login.',
      'Push tokens: until you uninstall the app, turn off notifications, or the token expires.',
    ]],
    ['Deleting your account and data', [
      'In the app: My account → Delete my account. This removes your account and personal data and logs you out on every device.',
      `Or ask us to delete your data${contact ? ` by calling or messaging ${contact}` : ''} with the phone number or email on your account. We act on requests within 30 days.`,
    ]],
    ['Your choices', [
      'See and edit your details in My account → Edit profile & address.',
      'Turn notifications on or off in your phone\'s settings.',
      'Ask us for a copy of your data, a correction, or deletion.',
    ]],
    ['Children', [
      'The app is not directed at children under 13, and we do not knowingly collect their information. If you believe a child has given us personal information, contact us and we will delete it.',
    ]],
    ['Changes', [
      'If we change this policy we will update it here and change the effective date. Significant changes will also be announced in the app.',
    ]],
  ];
}

export default function PrivacyPolicyScreen() {
  const { shop } = useAuth();
  const shopName = shop?.name || APP_NAME;
  const contact = shop?.whatsapp || shop?.phone || '';

  return (
    <Screen title="Privacy policy" subtitle={`Effective ${PRIVACY_EFFECTIVE}`}>
      <View style={{ maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <Text style={st.p}>
          This policy explains what information the {APP_NAME} app collects, why, and what you can do about it.
          The app is run by {shopName}{shop?.address ? `, ${shop.address}` : ''}.
        </Text>
        <View style={st.note}>
          <Text style={st.noteText}>
            Short version: we only collect what we need to take and deliver your orders. We do not sell your data, show ads, or track you across other apps.
          </Text>
        </View>

        {sections(shopName, contact).map(([heading, items], i) => (
          <View key={heading} style={st.section}>
            <Text style={st.h}>{i + 1}. {heading}</Text>
            {items.map((t) => (
              <View key={t} style={st.li}>
                <Text style={st.bullet}>•</Text>
                <Text style={[st.p, { flex: 1 }]}>{t}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={st.section}>
          <Text style={st.h}>Contact</Text>
          <Text style={st.p}>{shopName}{shop?.address ? `\n${shop.address}` : ''}{contact ? `\nPhone / WhatsApp: ${contact}` : ''}</Text>
        </View>

        {!!PRIVACY_URL && (
          <Button title="Open on the web" icon="open-outline" variant="ghost" small onPress={() => Linking.openURL(PRIVACY_URL)} style={{ marginTop: 20, alignSelf: 'center' }} />
        )}
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  p: { fontSize: 15, color: colors.text, lineHeight: 22 },
  note: { backgroundColor: '#fffbd6', borderColor: '#efe39a', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  noteText: { fontSize: 14, color: colors.text, lineHeight: 21, fontWeight: '600' },
  section: { marginTop: 22 },
  h: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 },
  li: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bullet: { fontSize: 15, color: colors.muted, lineHeight: 22 },
});

import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Screen, Card, SectionTitle, Empty } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import DeveloperPromo from '../components/DeveloperPromo';
import { money } from '../services/format';
import { colors } from '../theme';

const waNumber = (p) => (p || '').replace(/\D/g, '').replace(/^0/, '92');

const open = (url) => Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: 'Could not open the link' }));

// Customers: about the shop + how to reach it (all set by the owner in Shop settings)
export default function ContactScreen() {
  const { shop, reloadShop } = useAuth();
  const wa = shop.whatsapp || shop.phone;
  const mapUrl = shop.map_url || (shop.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}` : '');

  const rows = [
    shop.phone && { icon: 'call-outline', label: 'Call', value: shop.phone, onPress: () => open(`tel:${shop.phone}`) },
    wa && { icon: 'logo-whatsapp', label: 'WhatsApp', value: wa, onPress: () => open(`https://wa.me/${waNumber(wa)}`) },
    shop.email && { icon: 'mail-outline', label: 'Email', value: shop.email, onPress: () => open(`mailto:${shop.email}`) },
    shop.address && { icon: 'location-outline', label: 'Address', value: shop.address, onPress: mapUrl ? () => open(mapUrl) : null, action: 'Map' },
    !shop.address && shop.map_url && { icon: 'map-outline', label: 'Location', value: 'Open in maps', onPress: () => open(shop.map_url) },
  ].filter(Boolean);

  const links = [
    shop.website && { icon: 'globe-outline', label: 'Website', url: shop.website },
    shop.facebook && { icon: 'logo-facebook', label: 'Facebook', url: shop.facebook },
    shop.instagram && { icon: 'logo-instagram', label: 'Instagram', url: shop.instagram },
  ].filter(Boolean);

  const nothing = !shop.about && !rows.length && !links.length && !shop.hours;

  return (
    <Screen title="About & contact" onRefresh={reloadShop}>
      <View style={st.hero}>
        {shop.logo_url
          ? <Image source={{ uri: shop.logo_url }} style={st.logo} resizeMode="contain" />
          : <View style={[st.logo, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }]}><Ionicons name="storefront" size={36} color={colors.primary} /></View>}
        <Text style={st.name}>{shop.name}</Text>
        <View style={[st.status, { backgroundColor: shop.is_open ? colors.successSoft : colors.dangerSoft }]}>
          <View style={[st.statusDot, { backgroundColor: shop.is_open ? colors.success : colors.danger }]} />
          <Text style={{ color: shop.is_open ? colors.success : colors.danger, fontWeight: '700', fontSize: 12 }}>
            {shop.is_open ? 'Open for orders' : 'Closed right now'}
          </Text>
        </View>
      </View>

      {nothing && <Empty icon="information-circle-outline" text="The shop hasn't added its details yet." />}

      {!!shop.about && (
        <>
          <SectionTitle>About us</SectionTitle>
          <Card><Text style={st.body}>{shop.about}</Text></Card>
        </>
      )}

      {rows.length > 0 && (
        <>
          <SectionTitle>Contact</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {rows.map((r, i) => (
              <TouchableOpacity key={r.label} style={[st.row, i > 0 && st.rowBorder]} onPress={r.onPress || undefined} disabled={!r.onPress} testID={`contact-${r.label.toLowerCase()}`}>
                <View style={st.rowIcon}><Ionicons name={r.icon} size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.rowLabel}>{r.label}</Text>
                  <Text style={st.rowValue}>{r.value}</Text>
                </View>
                {!!r.onPress && <Ionicons name={r.label === 'Address' ? 'navigate-outline' : 'chevron-forward'} size={18} color={colors.faint} />}
              </TouchableOpacity>
            ))}
          </Card>
        </>
      )}

      {!!shop.hours && (
        <>
          <SectionTitle>Opening hours</SectionTitle>
          <Card style={{ flexDirection: 'row', gap: 12 }}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[st.body, { flex: 1 }]}>{shop.hours}</Text>
          </Card>
        </>
      )}

      {links.length > 0 && (
        <>
          <SectionTitle>Follow us</SectionTitle>
          <View style={st.links}>
            {links.map((l) => (
              <TouchableOpacity key={l.label} style={st.link} onPress={() => open(l.url)} testID={`link-${l.label.toLowerCase()}`}>
                <Ionicons name={l.icon} size={22} color={colors.primary} />
                <Text style={st.linkText}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {(shop.delivery_fee > 0 || shop.free_delivery_over > 0 || shop.min_order > 0 || shop.pickup) && (
        <>
          <SectionTitle>Ordering</SectionTitle>
          <Card style={{ gap: 6 }}>
            <Text style={st.body}>• Cash on delivery{shop.pickup ? ' or pickup from the shop' : ''}</Text>
            {shop.delivery_fee > 0 && <Text style={st.body}>• Delivery charge {money(shop.delivery_fee)}</Text>}
            {shop.free_delivery_over > 0 && <Text style={st.body}>• Free delivery on orders over {money(shop.free_delivery_over)}</Text>}
            {shop.min_order > 0 && <Text style={st.body}>• Minimum order {money(shop.min_order)}</Text>}
          </Card>
        </>
      )}

      <DeveloperPromo />
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  logo: { width: 88, height: 88, borderRadius: 20, backgroundColor: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  rowValue: { fontSize: 15, color: colors.text, fontWeight: '700' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  linkText: { fontWeight: '700', color: colors.text },
});

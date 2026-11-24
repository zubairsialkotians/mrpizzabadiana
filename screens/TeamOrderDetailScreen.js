import React from 'react';
import { View, Text, Linking } from 'react-native';
import { Screen, Card, Loading, ErrorBox, SectionTitle, Button, Footer, s } from '../components/ui';
import { OrderItems, OrderTotals, StatusBadge } from '../components/orders';
import { useTeamActions } from '../components/team';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { niceDate } from '../services/format';
import { colors } from '../theme';
import { mapsUrl } from './TeamHomeScreen';

const waNumber = (p) => (p || '').replace(/\D/g, '').replace(/^0/, '92');

// One order for the kitchen or a rider (opened from the panel or a notification)
export default function TeamOrderDetailScreen({ route }) {
  const { isRider } = useAuth();
  const { data: o, loading, error, reload, refresh, refreshing, setData } = useLoad(
    () => api.teamOrder(route.params.id).then((r) => r.order), [route.params.id],
  );
  const actions = useTeamActions((order) => (order ? setData(order) : reload()));

  if (loading) return <Screen title="Order"><Loading /></Screen>;
  if (error) return <Screen title="Order"><ErrorBox message={error} onRetry={reload} /></Screen>;

  const pickup = o.fulfilment === 'pickup';
  const buttons = actions.buttons(o);
  const ev = o.events || [];

  return (
    <Screen
      title={o.order_no}
      subtitle={`${niceDate(o.created_at)}${o.branch_name ? ` · ${o.branch_name}` : ''}`}
      right={<StatusBadge status={o.status} />}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={buttons ? <Footer>{buttons}</Footer> : null}
    >
      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.black }}>{o.name}</Text>
        <Text style={s.itemSub}>{o.phone}</Text>
        <Text style={[s.itemSub, { color: colors.text, marginTop: 6 }]}>
          {pickup ? `Customer picks up from ${o.branch_name}` : `Deliver to: ${o.address}`}
        </Text>
        {!!o.note && <Text style={[s.itemSub, { color: colors.warning, marginTop: 4 }]}>Note: {o.note}</Text>}
        {!!o.rider_name && <Text style={[s.itemMeta, { marginTop: 4 }]}>Rider: {o.rider_name}{o.rider_phone ? ` · ${o.rider_phone}` : ''}</Text>}
        {(isRider || !pickup) && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button small variant="ghost" icon="call-outline" title="Call" onPress={() => Linking.openURL(`tel:${o.phone}`)} style={{ flex: 1 }} />
            <Button small variant="ghost" icon="logo-whatsapp" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${waNumber(o.phone)}`)} style={{ flex: 1 }} />
            {!pickup && <Button small variant="ghost" icon="navigate-outline" title="Map" onPress={() => Linking.openURL(mapsUrl(o.address))} style={{ flex: 1 }} />}
          </View>
        )}
      </Card>

      {isRider && !!o.branch_address && (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text }}>Pick up from {o.branch_name}</Text>
          <Text style={s.itemSub}>{o.branch_address}{o.branch_phone ? ` · ${o.branch_phone}` : ''}</Text>
        </Card>
      )}

      <SectionTitle>Items</SectionTitle>
      <OrderItems order={o} />
      <OrderTotals order={o} />

      {ev.length > 0 && (
        <>
          <SectionTitle>History</SectionTitle>
          <Card>
            {ev.map((e, i) => (
              <View key={i} style={{ paddingVertical: 5 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{e.label}{e.note && e.note !== 'Order placed' ? ` — ${e.note}` : ''}</Text>
                <Text style={s.itemMeta}>{niceDate(e.at)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
      {actions.picker}
    </Screen>
  );
}

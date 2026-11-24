import React, { useEffect, useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { Screen, HeaderButton, ChipRow, Chip, Card, Loading, ErrorBox, Empty, LoadMore, s } from '../components/ui';
import { StatusBadge } from '../components/orders';
import { useTeamActions } from '../components/team';
import { usePaged } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, niceDate, qtyLabel, paymentLabel } from '../services/format';
import { colors } from '../theme';

/*
  Kitchen: orders to prepare → mark ready (delivery orders then go to riders), give orders to a rider.
  Rider: ready orders nobody has taken → accept (on the way) → delivered.
  Owner / branch admin open the kitchen board from the admin home.
*/
const KITCHEN_TABS = [
  { value: 'prepare', label: 'To prepare' },
  { value: 'ready', label: 'Ready' },
  { value: 'out', label: 'On the way' },
];
const RIDER_TABS = [
  { value: 'available', label: 'Ready to pick up' },
  { value: 'mine', label: 'My deliveries' },
  { value: 'done', label: 'Done' },
];

export const mapsUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;

export default function TeamHomeScreen({ navigation }) {
  const { user, isRider, isTeam } = useAuth();
  const tabs = isRider ? RIDER_TABS : KITCHEN_TABS;
  const [tab, setTab] = useState(tabs[0].value);

  const p = usePaged((page) => api.teamOrders({ tab, page }), 'orders', [tab]);
  const actions = useTeamActions(() => p.silentReload());
  // New work shows up while the screen is open
  useEffect(() => { const t = setInterval(p.silentReload, 20000); return () => clearInterval(t); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = p.meta.counts || {};
  const where = user.branch ? user.branch.name : (isRider ? 'All branches' : '');
  const empty = {
    prepare: 'Nothing to prepare right now', ready: 'No orders waiting for a rider', out: 'No orders on the way',
    available: 'No orders ready for pickup', mine: 'You have no deliveries right now', done: 'No deliveries yet',
  }[tab];

  return (
    <Screen
      title={isRider ? 'Deliveries' : isTeam ? 'Kitchen' : 'Kitchen board'}
      subtitle={[user.name, where].filter(Boolean).join(' · ')}
      back={!isTeam}
      right={isTeam ? <HeaderButton icon="person-circle-outline" onPress={() => navigation.navigate('Account')} /> : null}
      onRefresh={p.refresh}
      refreshing={p.refreshing}
    >
      <ChipRow>
        {tabs.map((t) => (
          <Chip key={t.value} label={counts[t.value] != null ? `${t.label} ${counts[t.value]}` : t.label} active={tab === t.value} onPress={() => setTab(t.value)} />
        ))}
      </ChipRow>

      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon={isRider ? 'bicycle-outline' : 'restaurant-outline'} text={empty} />
      ) : p.items.map((o) => (
        <TeamOrderCard key={o.id} order={o} rider={isRider} actions={actions}
          onPress={() => navigation.navigate('TeamOrderDetail', { id: o.id })} />
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
      {actions.picker}
    </Screen>
  );
}

function TeamOrderCard({ order: o, rider, actions, onPress }) {
  const pickup = o.fulfilment === 'pickup';
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.black }}>{o.order_no}</Text>
        <StatusBadge status={o.status} />
      </View>
      <Text style={s.itemMeta}>
        {[niceDate(o.confirmed_at || o.created_at), pickup ? 'Pickup' : 'Delivery', o.branch_name].filter(Boolean).join(' · ')}
      </Text>

      {rider ? (
        <>
          <Text style={{ fontWeight: '700', color: colors.text, marginTop: 8 }}>{o.name} · {o.phone}</Text>
          <Text style={[s.itemSub, { color: colors.text }]}>{o.address}</Text>
          <Text style={[s.itemSub, { marginTop: 2 }]}>
            {money(o.total)} · {paymentLabel(o)}{o.payment_method !== 'cod' && o.payment_status === 'verified' ? ' (paid)' : ''}
          </Text>
          {o.status === 'out_for_delivery' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Chip icon="call-outline" label="Call" onPress={() => Linking.openURL(`tel:${o.phone}`)} />
              <Chip icon="navigate-outline" label="Map" onPress={() => Linking.openURL(mapsUrl(o.address))} />
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ marginTop: 8 }}>
            {o.items.map((it) => (
              <Text key={it.id} style={{ color: colors.text, fontSize: 15, paddingVertical: 1 }}>
                <Text style={{ fontWeight: '800' }}>{qtyLabel(it.qty, it.unit)}</Text>  {it.name}{it.size ? ` (${it.size})` : ''}
              </Text>
            ))}
          </View>
          {!!o.note && <Text style={[s.itemSub, { color: colors.warning, marginTop: 6 }]}>Note: {o.note}</Text>}
          {!!o.rider_name && <Text style={[s.itemMeta, { marginTop: 4 }]}>Rider: {o.rider_name}</Text>}
        </>
      )}

      {(() => {
        const b = actions.buttons(o, { small: true });
        return b ? <View style={{ marginTop: 10 }}>{b}</View> : null;
      })()}
    </Card>
  );
}

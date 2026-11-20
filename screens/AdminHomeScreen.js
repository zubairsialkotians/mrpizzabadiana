import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, HeaderButton, Stat, StatGrid, SectionTitle, DateRangeBar, BranchFilter, Loading, ErrorBox } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { useLoad } from '../components/useData';
import { api } from '../services/api';
import { money, rangeFor, rangeLabel, ROLE_LABELS } from '../services/format';
import { colors } from '../theme';

const TILES = [
  { key: 'AdminOrders', icon: 'receipt-outline', label: 'Orders' },
  { key: 'Items', icon: 'pricetags-outline', label: 'Items' },
  { key: 'Categories', icon: 'grid-outline', label: 'Categories' },
  { key: 'Stock', icon: 'cube-outline', label: 'Stock' },
  { key: 'Customers', icon: 'people-outline', label: 'Customers' },
  { key: 'Returns', icon: 'return-down-back-outline', label: 'Returns' },
  { key: 'Reviews', icon: 'star-outline', label: 'Reviews' },
  { key: 'Expenses', icon: 'trending-down-outline', label: 'Expenses' },
  { key: 'Reports', icon: 'bar-chart-outline', label: 'Reports' },
  { key: 'AdminNews', icon: 'megaphone-outline', label: 'News', owner: true },
  { key: 'AdminBanners', icon: 'images-outline', label: 'Banners', owner: true },
  { key: 'Branches', icon: 'business-outline', label: 'Branches', owner: true },
  { key: 'Settings', icon: 'settings-outline', label: 'Shop settings', owner: true },
  { key: 'Home', icon: 'storefront-outline', label: 'View shop' },
  { key: 'Account', icon: 'person-circle-outline', label: 'My account' },
];

export default function AdminHomeScreen({ navigation }) {
  const { user, shop, isOwner } = useAuth();
  const [range, setRange] = useState(rangeFor('today'));
  const [branchId, setBranchId] = useState(0);
  const { data, loading, error, refresh, refreshing, reload, silentReload } = useLoad(
    () => api.dashboard({ from: range.from, to: range.to, branch_id: branchId }).then((r) => r.dashboard),
    [range.from, range.to, branchId],
  );

  // New orders show up while the screen is open
  useEffect(() => {
    const t = setInterval(silentReload, 30000);
    return () => clearInterval(t);
  }, [range.from, range.to, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (screen, params) => navigation.navigate(screen, params);
  const tiles = TILES.filter((t) => !t.owner || isOwner);

  return (
    <Screen
      title={shop?.name || 'Shop admin'}
      subtitle={`${user.name} · ${ROLE_LABELS[user.role]}${user.branch ? ` · ${user.branch.name}` : ''}`}
      back={false}
      right={<HeaderButton icon="person-circle-outline" onPress={() => go('Account')} />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {data?.pending_all > 0 && (
        <TouchableOpacity style={st.alert} onPress={() => go('AdminOrders', { status: 'pending' })} testID="pending-alert">
          <Ionicons name="notifications" size={20} color={colors.warning} />
          <Text style={st.alertText}>{data.pending_all} new order{data.pending_all > 1 ? 's' : ''} waiting for confirmation</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.warning} />
        </TouchableOpacity>
      )}
      {data?.active_all > 0 && (
        <TouchableOpacity style={[st.alert, { backgroundColor: colors.primarySoft }]} onPress={() => go('AdminOrders', { status: 'active' })}>
          <Ionicons name="bicycle" size={20} color={colors.primary} />
          <Text style={[st.alertText, { color: colors.primary }]}>{data.active_all} order{data.active_all > 1 ? 's' : ''} to deliver / hand over</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}

      <View style={st.tiles}>
        {tiles.map((t) => (
          <TouchableOpacity key={t.key} style={st.tile} onPress={() => go(t.key)} testID={`tile-${t.key}`}>
            <View style={st.tileIcon}><Ionicons name={t.icon} size={22} color={colors.primary} /></View>
            <Text style={st.tileText} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle right={<BranchFilter value={branchId} onChange={setBranchId} />}>{rangeLabel(range)}</SectionTitle>
      <DateRangeBar value={range} onChange={setRange} />

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : data && (
        <StatGrid>
          <Stat label="Sales" value={money(data.net_sales)} sub={`${data.orders} orders${data.refunds ? ` · ${money(data.refunds)} refunded` : ''}`} tone="primary" icon="trending-up" onPress={() => go('Reports')} />
          <Stat label="Net profit" value={money(data.net_profit)} sub={`Gross ${money(data.gross_profit)}`} tone={data.net_profit >= 0 ? 'good' : 'bad'} icon="analytics" onPress={() => go('Reports', { tab: 'pl' })} />
          <Stat label="New orders" value={String(data.status.pending.count)} sub={`${data.status.cancelled.count} cancelled`} icon="receipt" onPress={() => go('AdminOrders', { status: 'pending' })} />
          <Stat label="Delivered" value={String(data.status.delivered.count)} sub={money(data.status.delivered.total)} tone="good" icon="checkmark-done" onPress={() => go('AdminOrders', { status: 'delivered' })} />
          <Stat label="Delivery charges" value={money(data.delivery)} icon="bicycle" />
          <Stat label="Expenses" value={money(data.expenses)} tone="bad" icon="trending-down" onPress={() => go('Expenses')} />
          <Stat label="Low stock items" value={String(data.low_stock)} tone={data.low_stock ? 'warn' : 'default'} icon="alert-circle" onPress={() => go('Stock', { low: true })} />
          <Stat label="New customers" value={String(data.new_customers)} icon="person-add" onPress={() => go('Customers')} />
        </StatGrid>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.warningSoft, borderRadius: 12, padding: 12, marginBottom: 10 },
  alertText: { flex: 1, color: colors.warning, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 6 },
  tile: { width: '25%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 5 },
  tileIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  tileText: { fontSize: 12, fontWeight: '600', color: colors.text },
});

import React, { useEffect, useState } from 'react';
import { Screen, ChipRow, Chip, SearchBar, ListItem, Loading, ErrorBox, Empty, LoadMore, BranchFilter, DateRangeBar } from '../components/ui';
import { StatusBadge } from '../components/orders';
import { usePaged } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, niceDate, rangeFor } from '../services/format';

const TABS = [
  { value: 'pending', label: 'New' },
  { value: 'active', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

export default function AdminOrdersScreen({ navigation, route }) {
  const { isOwner } = useAuth();
  const [status, setStatus] = useState(route.params?.status ?? 'pending');
  const [branchId, setBranchId] = useState(0);
  const [range, setRange] = useState(rangeFor('all'));
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const customerId = route.params?.customerId || 0;
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (route.params?.status !== undefined) setStatus(route.params.status); }, [route.params?.status]);

  const p = usePaged(
    (page) => api.adminOrders({ page, status, branch_id: branchId, search: q, from: range.from, to: range.to, customer_id: customerId }),
    'orders', [status, branchId, q, range.from, range.to, customerId],
  );
  useEffect(() => { const t = setInterval(p.silentReload, 30000); return () => clearInterval(t); }, [status, branchId, q, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = p.meta.counts || {};
  const count = (v) => (v === 'active' ? (counts.confirmed || 0) + (counts.out_for_delivery || 0) + (counts.ready || 0)
    : v === '' ? Object.values(counts).reduce((a, n) => a + n, 0) : counts[v] || 0);

  return (
    <Screen title={route.params?.customerName ? `Orders · ${route.params.customerName}` : 'Orders'} right={<BranchFilter value={branchId} onChange={setBranchId} />}
      onRefresh={p.refresh} refreshing={p.refreshing}>
      <ChipRow>
        {TABS.map((t) => <Chip key={t.value} label={`${t.label} ${count(t.value)}`} active={status === t.value} onPress={() => setStatus(t.value)} />)}
      </ChipRow>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Order no, name or phone" />
      <DateRangeBar value={range} onChange={setRange} presets={['all', 'today', 'yesterday', 'week', 'month']} />

      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon="receipt-outline" text="No orders here" />
      ) : p.items.map((o) => (
        <ListItem
          key={o.id}
          title={`${o.order_no} · ${o.name}`}
          badge={<StatusBadge status={o.status} />}
          subtitle={`${niceDate(o.created_at)} · ${o.item_count} item${o.item_count === 1 ? '' : 's'} · ${o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}`}
          meta={[o.phone, isOwner ? o.branch_name : null, o.payment_method && o.payment_method !== 'cod'
            ? `${o.payment_name}: ${{ awaiting: 'no screenshot yet', submitted: 'screenshot to check', verified: 'paid', rejected: 'not accepted' }[o.payment_status] || ''}`
            : null].filter(Boolean).join(' · ')}
          right={money(o.total)}
          onPress={() => navigation.navigate('AdminOrderDetail', { id: o.id })}
        />
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
    </Screen>
  );
}

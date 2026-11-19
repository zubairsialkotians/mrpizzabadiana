import React, { useEffect, useState } from 'react';
import { Screen, SearchBar, ListItem, Loading, ErrorBox, Empty, LoadMore, Badge } from '../components/ui';
import { usePaged } from '../components/useData';
import { api } from '../services/api';
import { money, niceDate } from '../services/format';

export default function CustomersScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  const p = usePaged((page) => api.customers({ page, search: q }), 'customers', [q]);

  return (
    <Screen title="Customers" subtitle={p.meta.total != null ? `${p.meta.total} registered` : undefined} onRefresh={p.refresh} refreshing={p.refreshing}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Name, phone or email" />
      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon="people-outline" text="No customers yet" />
      ) : p.items.map((c) => (
        <ListItem
          key={c.id}
          title={c.name || c.email}
          badge={c.source === 'checkout' ? <Badge status="inactive" label="Guest checkout" /> : null}
          subtitle={`${c.phone} · ${c.email}`}
          meta={`${c.orders} order${c.orders === 1 ? '' : 's'}${c.last_order ? ` · last ${niceDate(c.last_order, false)}` : ''}`}
          right={money(c.spent)}
          onPress={() => navigation.navigate('AdminOrders', { customerId: c.id, customerName: c.name, status: '' })}
        />
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
    </Screen>
  );
}

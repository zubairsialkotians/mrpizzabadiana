import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, ListItem, Loading, ErrorBox, Empty, LoadMore, Button } from '../components/ui';
import { StatusBadge } from '../components/orders';
import { usePaged, useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, niceDate } from '../services/format';
import { GUEST_ORDERS_KEY } from './CheckoutScreen';

export default function MyOrdersScreen({ navigation }) {
  const { isCustomer } = useAuth();
  return isCustomer ? <AccountOrders navigation={navigation} /> : <GuestOrders navigation={navigation} />;
}

function AccountOrders({ navigation }) {
  const p = usePaged((page) => api.myOrders({ page }), 'orders');
  return (
    <Screen title="My orders" onRefresh={p.refresh} refreshing={p.refreshing}>
      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <>
          <Empty icon="receipt-outline" text="No orders yet" />
          <Button title="Start shopping" onPress={() => navigation.navigate('Home')} />
        </>
      ) : p.items.map((o) => (
        <ListItem key={o.id} title={o.order_no} badge={<StatusBadge status={o.status} />}
          subtitle={`${niceDate(o.created_at)} · ${o.item_count} item${o.item_count === 1 ? '' : 's'}`}
          right={money(o.total)} onPress={() => navigation.navigate('MyOrderDetail', { id: o.id })} />
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
    </Screen>
  );
}

// Orders placed on this phone without an account session
function GuestOrders({ navigation }) {
  const { data, loading, error, reload } = useLoad(async () => {
    const list = JSON.parse((await AsyncStorage.getItem(GUEST_ORDERS_KEY)) || '[]');
    const out = await Promise.all(list.map((g) => api.trackOrder(g.id, g.key).then((r) => ({ ...r.order, key: g.key })).catch(() => null)));
    return out.filter(Boolean);
  });
  return (
    <Screen title="Orders on this phone">
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? (
        <>
          <Empty icon="receipt-outline" text="No orders on this phone. Log in to see your account's orders." />
          <Button title="Log in" onPress={() => navigation.navigate('Login')} />
        </>
      ) : data.map((o) => (
        <ListItem key={o.id} title={o.order_no} badge={<StatusBadge status={o.status} />} subtitle={niceDate(o.created_at)}
          right={money(o.total)} onPress={() => navigation.navigate('MyOrderDetail', { id: o.id, key: o.key })} />
      ))}
    </Screen>
  );
}

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, SearchBar, Card, KV, Loading, ErrorBox, Empty, LoadMore, Fab, DateRangeBar, BranchFilter, s } from '../components/ui';
import { usePaged } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { confirmAction } from '../services/confirm';
import { money, qtyLabel, niceDate, rangeFor } from '../services/format';
import { colors } from '../theme';

/*
  Purchases: every time stock is bought (item, qty, cost, date, supplier). Kept apart from the items list,
  for keeping an eye on what was bought when. Adding one adds the stock; deleting one takes it back out.
*/
export default function PurchasesScreen({ navigation, route }) {
  const { isOwner } = useAuth();
  const itemId = route.params?.item_id || 0;
  const [range, setRange] = useState(rangeFor('month'));
  const [branchId, setBranchId] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  const p = usePaged(
    (page) => api.purchases({ page, from: range.from, to: range.to, branch_id: branchId, search: q, item_id: itemId }),
    'purchases', [range.from, range.to, branchId, q, itemId],
  );

  const remove = async (x) => {
    if (!(await confirmAction(`Delete this purchase?`, `${qtyLabel(x.qty, x.unit)} ${x.item_name} will be taken back out of stock. Prices stay as they are.`, 'Delete', true))) return;
    try {
      const r = await api.deletePurchase(x.id);
      Toast.show({ type: 'success', text1: r.message });
      p.reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: e.message });
    }
  };

  return (
    <Screen title="Purchases" subtitle={route.params?.item_name || 'Stock you bought'} onRefresh={p.refresh} refreshing={p.refreshing}>
      <DateRangeBar value={range} onChange={setRange} />
      {isOwner && <BranchFilter value={branchId} onChange={setBranchId} />}
      {!itemId && <SearchBar value={search} onChangeText={setSearch} placeholder="Search item or supplier" />}
      <Card>
        <KV label="Purchases" value={String(p.meta.count ?? 0)} />
        <KV label="Total spent" value={money(p.meta.total || 0)} bold />
      </Card>
      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon="cart-outline" text="No purchases in this period. Tap + when you buy stock." />
      ) : p.items.map((x) => (
        <TouchableOpacity key={x.id} style={s.item} onLongPress={() => remove(x)} onPress={() => remove(x)} testID={`purchase-${x.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle} numberOfLines={1}>{x.item_name}{x.size ? ` (${x.size})` : ''}</Text>
            <Text style={s.itemSub} numberOfLines={1}>
              {qtyLabel(x.qty, x.unit)} × {money(x.unit_cost)}{x.supplier ? ` · ${x.supplier}` : ''}
            </Text>
            <Text style={s.itemMeta} numberOfLines={1}>
              {niceDate(x.purchase_date, false)}{x.branch_name ? ` · ${x.branch_name}` : ''}{x.by ? ` · by ${x.by}` : ''}
              {x.sale_price > 0 ? ` · sale price → ${money(x.sale_price)}` : ''}
            </Text>
            {!!x.note && <Text style={[s.itemMeta, { fontStyle: 'italic' }]} numberOfLines={2}>{x.note}</Text>}
          </View>
          <Text style={{ fontWeight: '800', color: colors.text }}>{money(x.total)}</Text>
        </TouchableOpacity>
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
      {!!p.items.length && <Text style={[s.itemMeta, { textAlign: 'center', marginTop: 8 }]}>Tap a purchase to delete it.</Text>}
      <View style={{ height: 70 }} />
      <Fab onPress={() => navigation.navigate('PurchaseForm', itemId ? { item_id: itemId } : {})} label="Purchase" />
    </Screen>
  );
}

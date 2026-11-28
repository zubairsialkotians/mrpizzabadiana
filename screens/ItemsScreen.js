import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Screen, SearchBar, ChipRow, Chip, Loading, ErrorBox, Empty, LoadMore, Fab, Badge, Button, Segmented, s } from '../components/ui';
import { confirmAction } from '../services/confirm';
import { ProductImage } from '../components/shop';
import { usePaged, useLoad } from '../components/useData';
import { api } from '../services/api';
import { CategoryChips } from '../components/CategoryFilter';
import { money, perUnit, qtyLabel } from '../services/format';
import { colors } from '../theme';

export default function ItemsScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(0);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  const cats = useLoad(() => api.adminCategories().then((r) => r.categories));
  // '' all · 'active' on the menu · 'inactive' hidden (not selling for now)
  const [status, setStatus] = useState('');
  const p = usePaged((page) => api.adminItems({ page, search: q, category_id: cat, status }), 'items', [q, cat, status]);
  const [busyId, setBusyId] = useState(null);

  // Hide from the menu (stop selling for now) or put it back
  const toggle = async (it) => {
    const hide = it.status !== 'inactive';
    setBusyId(it.id);
    try {
      const r = await api.setItemStatus({ ids: [it.id], status: hide ? 'inactive' : 'active' });
      Toast.show({ type: 'success', text1: it.name, text2: r.message, visibilityTime: 2000 });
      p.reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not change it', text2: e.message });
    } finally {
      setBusyId(null);
    }
  };
  const showAll = async () => {
    const ids = p.items.filter((x) => x.status === 'inactive').map((x) => x.id);
    if (!ids.length) return;
    if (!(await confirmAction('Put back on the menu?', `${ids.length} item${ids.length > 1 ? 's' : ''} shown here will be sold again.`, 'Show all'))) return;
    try {
      const r = await api.setItemStatus({ ids, status: 'active' });
      Toast.show({ type: 'success', text1: r.message });
      p.reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not change them', text2: e.message });
    }
  };

  return (
    <Screen title="Items" subtitle="Products in your shop" scroll onRefresh={p.refresh} refreshing={p.refreshing}>
      {/* Stock bought: add a purchase (stock, cost and sale price follow) or see past ones */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <Button testID="items-add-purchase" small icon="cart-outline" title="Add purchase" onPress={() => navigation.navigate('PurchaseForm', {})} style={{ flex: 1 }} />
        <Button testID="items-purchases" small variant="outline" icon="list-outline" title="Purchases" onPress={() => navigation.navigate('Purchases')} style={{ flex: 1 }} />
      </View>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search items" />
      <CategoryChips cats={cats.data || []} value={cat} onChange={setCat} />
      <View style={{ marginBottom: 10 }}>
        <Segmented value={status} onChange={setStatus}
          options={[{ value: '', label: 'All items' }, { value: 'active', label: 'On the menu' }, { value: 'inactive', label: 'Hidden' }]} />
      </View>
      {status === 'inactive' && p.items.length > 0 && (
        <View style={st.hiddenBar}>
          <Ionicons name="eye-off-outline" size={18} color={colors.warning} />
          <Text style={st.hiddenText}>Not on the menu: customers and staff can't order these. Tap Show to sell one again.</Text>
          <Button small title="Show all" icon="eye-outline" onPress={showAll} testID="items-show-all" />
        </View>
      )}
      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon="pricetags-outline" text={status === 'inactive' ? 'No hidden items. Everything is on the menu.' : 'No items yet. Tap + to add your first product.'} />
      ) : p.items.map((it) => (
        <TouchableOpacity key={it.id} style={[s.item, { gap: 10 }]} onPress={() => navigation.navigate('ItemForm', { item: it })} testID={`item-${it.id}`}>
          <ProductImage uri={it.image} style={{ width: 52, height: 52, borderRadius: 10 }} iconSize={20} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Text style={s.itemTitle} numberOfLines={1}>{it.name}</Text>
              {it.status === 'inactive' && <Badge status="inactive" label="Hidden" />}
              {it.featured && <Badge status="confirmed" label="Featured" />}
              {!!it.discount_type && <Badge status="delivered" label={it.discount_type === 'percent' ? `${Number(it.discount_value)}% off` : `${money(it.discount_value)} off`} />}
            </View>
            <Text style={s.itemSub} numberOfLines={1}>
              {it.sizes?.length ? it.sizes.map((z) => `${z.name} ${money(z.price)}`).join(' · ') : perUnit(it.price, it.unit)}
              {!!it.discount_type && !it.sizes?.length ? ` → ${money(it.sale_price)}` : ''}
              {it.category_name ? ` · ${it.category_name}` : ''}
            </Text>
            <Text style={[s.itemMeta, it.track_stock && it.stock <= it.low_stock && { color: colors.danger }]}>
              {it.track_stock ? `Stock ${qtyLabel(it.stock || 0, it.unit)}` : 'Stock not tracked'}
            </Text>
          </View>
          {/* Stop / start selling without opening the item */}
          <TouchableOpacity onPress={() => toggle(it)} disabled={busyId === it.id} hitSlop={6}
            style={[st.toggle, it.status === 'inactive' ? st.toggleShow : st.toggleHide, busyId === it.id && { opacity: 0.5 }]} testID={`item-toggle-${it.id}`}>
            <Ionicons name={it.status === 'inactive' ? 'eye-outline' : 'eye-off-outline'} size={16} color={it.status === 'inactive' ? colors.onBrand : colors.text} />
            <Text style={[st.toggleText, { color: it.status === 'inactive' ? colors.onBrand : colors.text }]}>{it.status === 'inactive' ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
      <View style={{ height: 70 }} />
      <Fab onPress={() => navigation.navigate('ItemForm', {})} label="Item" />
    </Screen>
  );
}

const st = StyleSheet.create({
  hiddenBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningSoft, borderRadius: 12, padding: 10, marginBottom: 10 },
  hiddenText: { flex: 1, color: colors.warning, fontWeight: '600', fontSize: 13 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 12, borderRadius: 17, alignSelf: 'center' },
  toggleHide: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border },
  toggleShow: { backgroundColor: colors.brand },
  toggleText: { fontWeight: '800', fontSize: 13 },
});

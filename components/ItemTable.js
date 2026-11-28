import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Loading, ErrorBox, Empty, Chip } from './ui';
import { QtyStepper } from './shop';
import { useCart } from './CartContext';
import { useIsFocused } from '@react-navigation/native';
import { useBarcodeScanner, findByCode } from './scan';
import { usePaged, useLoad } from './useData';
import { useCatalogueStatus } from './MenuSync';
import { catTree, mainOf, SubCategoryChips } from './CategoryFilter';
import { api } from '../services/api';
import { money, perUnit, qtyLabel } from '../services/format';
import { minOf, nextQty } from '../services/qty';
import { colors } from '../theme';

/*
  Table / list view for taking orders (desktop and tablets): the shop's items as rows, made for the keyboard.
  Type to search (name or item code), ↑ ↓ to pick a row, Enter to add it; click a row to add it too.
  A barcode scanner works here as everywhere (components/scan.js).
  Works on useCart(): the cart, or a return's own list (Return mode, no stock limits).
  onSizes(p): items with several sizes open the size picker.
*/
export function ItemTable({ width, onSizes, bottomPadding = 30, header }) {
  const cart = useCart();
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0); // highlighted row
  const input = useRef(null);
  const list = useRef(null);

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 250); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setHi(0); }, [q, category]);

  const menu = useCatalogueStatus();
  const menuVersion = `${menu.saved}|${menu.synced_at}`;
  const cats = useLoad(() => api.categories().then((r) => r.categories), [menuVersion]);
  const p = usePaged((page) => api.products({ page, per_page: 60, category_id: category, search: q }), 'products', [category, q, menuVersion]);
  const mains = catTree(cats.data || []);
  const activeMain = mainOf(cats.data || [], category);

  const add = (item) => {
    if (!item) return;
    if (item.sizes?.length > 1) { onSizes?.(item); return; }
    if (!cart.returning && !item.in_stock) { Toast.show({ type: 'error', text1: `${item.name} is out of stock` }); return; }
    const size = item.sizes?.length === 1 ? item.sizes[0].name : '';
    const have = cart.qtyOf(item.id, size);
    const next = have ? (size ? have + 1 : nextQty(have, item)) : (size ? 1 : (item.qty_options?.length ? item.qty_options[0] : minOf(item)));
    if (!cart.returning && item.max_qty != null && next > item.max_qty + 1e-9) {
      Toast.show({ type: 'error', text1: `Only ${qtyLabel(item.max_qty, item.unit)} of ${item.name} in stock` });
      return;
    }
    if (have) cart.setQty(item.id, next, item, size);
    else cart.add(item, next, size);
  };

  /*
    Barcode / QR scan in the table: the code goes into the search box (focused), and when an item has
    that code it is added at once and the box is cleared for the next scan. No match: the code stays in the
    search so staff see what was scanned.
  */
  const focused = useIsFocused();
  useBarcodeScanner(async (code) => {
    input.current?.focus();
    setSearch(code);
    setQ(code);
    try {
      const found = await findByCode(code);
      if (found) {
        add(found);
        setSearch('');
        setQ('');
        Toast.show({ type: 'success', text1: `${found.name} added`, text2: code, visibilityTime: 1200 });
      } else {
        Toast.show({ type: 'error', text1: 'No item with this code', text2: code, visibilityTime: 3000 });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not look up the code', text2: e.message });
    }
    setTimeout(() => input.current?.focus(), 0);
  }, focused);

  const move = (d) => {
    const n = Math.max(0, Math.min(p.items.length - 1, hi + d));
    setHi(n);
    if (p.items.length) list.current?.scrollToIndex?.({ index: n, viewPosition: 0.5, animated: false });
  };
  const onKey = (e) => {
    const k = e.nativeEvent.key;
    if (k === 'ArrowDown') { e.preventDefault?.(); move(1); }
    else if (k === 'ArrowUp') { e.preventDefault?.(); move(-1); }
    else if (k === 'Escape') setSearch('');
  };
  const submit = () => {
    // The exact item code first, then the highlighted row
    const code = search.trim().toLowerCase();
    const exact = code && p.items.find((x) => x.sku && String(x.sku).toLowerCase() === code);
    add(exact || p.items[hi]);
    if (exact) setSearch('');
    setTimeout(() => input.current?.focus(), 0);
  };

  const wide = width >= 760;
  const top = (
    <View style={{ paddingBottom: 6 }}>
      {header}
      <View style={st.search}>
        <Ionicons name="search" size={18} color={colors.faint} />
        <TextInput
          ref={input}
          value={search}
          onChangeText={setSearch}
          onKeyPress={onKey}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          autoFocus={Platform.OS === 'web'}
          placeholder="Search by name or item code, Enter to add (↑ ↓ to choose)"
          placeholderTextColor={colors.faint}
          style={st.searchInput}
          autoCorrect={false}
          testID="table-search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </TouchableOpacity>
        )}
      </View>
      {mains.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {[{ id: 0, name: 'All' }, ...mains].map((c) => (
            <Chip key={c.id} label={c.name} active={activeMain === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </View>
      )}
      <SubCategoryChips cats={cats.data || []} value={category} onChange={setCategory} />
      <View style={[st.row, st.headRow]}>
        {wide && <Text style={[st.th, st.code]}>Code</Text>}
        <Text style={[st.th, { flex: 1 }]}>Item</Text>
        <Text style={[st.th, st.price]}>Price</Text>
        {!cart.returning && <Text style={[st.th, st.stock]}>Stock</Text>}
        <Text style={[st.th, st.qty]}>{cart.returning ? 'Returning' : 'In order'}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ width, flex: 1 }}>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={p.items}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: bottomPadding }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={top}
        stickyHeaderIndices={Platform.OS === 'web' ? undefined : [0]}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : <Empty icon="basket-outline" text={q ? 'No items match your search' : 'No items yet'} />}
        renderItem={({ item, index }) => {
          const sized = item.sizes?.length > 1;
          const oneSize = item.sizes?.length === 1 ? item.sizes[0].name : '';
          const inCart = cart.qtyOf(item.id);
          const out = !cart.returning && !item.in_stock;
          const lineProduct = cart.returning ? { ...item, max_qty: null } : item;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { setHi(index); add(item); }}
              style={[st.row, st.bodyRow, index === hi && st.hiRow, out && { opacity: 0.5 }]}
              testID={`row-${item.id}`}
            >
              {wide && <Text style={[st.td, st.code, { color: colors.muted }]} numberOfLines={1}>{item.sku || '—'}</Text>}
              <View style={{ flex: 1 }}>
                <Text style={[st.td, { fontWeight: '700' }]} numberOfLines={1}>{item.name}</Text>
                {sized && <Text style={st.sub} numberOfLines={1}>{item.sizes.map((z) => `${z.name} ${money(z.price)}`).join(' · ')}</Text>}
                {!wide && !!item.sku && <Text style={st.sub}>{item.sku}</Text>}
              </View>
              <Text style={[st.td, st.price]}>{sized ? `from ${money(item.price)}` : oneSize ? money(item.sizes[0].price) : perUnit(item.price, item.unit)}</Text>
              {!cart.returning && (
                <Text style={[st.td, st.stock, { color: out ? colors.danger : colors.muted }]}>
                  {out ? 'Out' : item.max_qty == null ? '—' : qtyLabel(item.max_qty, item.unit)}
                </Text>
              )}
              <View style={st.qty}>
                {sized ? (
                  <TouchableOpacity style={st.addBtn} onPress={() => onSizes?.(item)}>
                    <Text style={st.addText}>{inCart > 0 ? `${inCart} · sizes` : 'Sizes'}</Text>
                  </TouchableOpacity>
                ) : inCart > 0 ? (
                  <QtyStepper small editable product={lineProduct} qty={inCart} onChange={(n) => cart.setQty(item.id, n, item, oneSize)} />
                ) : (
                  <TouchableOpacity style={[st.addBtn, out && { backgroundColor: colors.faint }]} onPress={() => add(item)} disabled={out}>
                    <Ionicons name="add" size={16} color={colors.onBrand} />
                    <Text style={st.addText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        onEndReached={p.loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={p.loadingMore ? <Loading /> : null}
      />
    </View>
  );
}

const st = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.primary, paddingHorizontal: 12, height: 46, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, height: '100%', outlineStyle: 'none' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  headRow: { paddingVertical: 8, backgroundColor: colors.black, borderTopLeftRadius: 10, borderTopRightRadius: 10, marginTop: 4 },
  bodyRow: { paddingVertical: 8, minHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border },
  hiRow: { backgroundColor: colors.primarySoft },
  th: { color: '#fff', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { color: colors.text, fontSize: 14 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  code: { width: 110 },
  price: { width: 110, textAlign: 'right' },
  stock: { width: 80, textAlign: 'right' },
  qty: { width: 150, alignItems: 'flex-end' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.brand },
  addText: { color: colors.onBrand, fontWeight: '800', fontSize: 13 },
});

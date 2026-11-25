import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar, Loading, ErrorBox, Empty } from './ui';
import { ProductCard, ProductImage } from './shop';
import { usePaged, useLoad } from './useData';
import { api } from '../services/api';
import { useCatalogueStatus } from './MenuSync';
import { catTree, mainOf, SubCategoryChips } from './CategoryFilter';
import { colors } from '../theme';

/*
  The shop's items: search, categories and the product grid. Used by the shop screen and, on tablets,
  when changing the items of an order already placed.
  header({ showCategory }): extra content above the search (banners, notices)
  onProductPress(p): tap on a card; onSizes(p): "Choose size" on items with sizes
*/
// catStyle: the app's own category look { wrap, img, text, active, activeText } (optional)
export function Catalogue({ width, header, onProductPress, onSizes, onRefresh, bottomPadding = 30, maxWidth = 1000, catStyle = {} }) {
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // Search after typing stops
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  // Menu saved on this device / synced / cleared: show that copy (or the live one) straight away
  const menu = useCatalogueStatus();
  const menuVersion = `${menu.saved}|${menu.synced_at}`;
  const cats = useLoad(() => api.categories().then((r) => r.categories), [menuVersion]);
  const p = usePaged((page) => api.products({ page, category_id: category, search: q }), 'products', [category, q, menuVersion]);

  const gridW = Math.min(width, maxWidth);
  const cols = gridW >= 760 ? 4 : gridW >= 520 ? 3 : 2;
  const pad = 14;
  const gap = 12;
  const cardW = (gridW - pad * 2 - gap * (cols - 1)) / cols;
  const showCategory = (id) => { setSearch(''); setQ(''); setCategory(id); };
  // Main categories in the picture row; the chosen one's sub-categories as chips under it
  const mains = catTree(cats.data || []);
  const activeMain = mainOf(cats.data || [], category);

  const top = (
    <View>
      {header?.({ showCategory, contentWidth: gridW - pad * 2 })}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search products" />
      {mains.length > 0 && (
        <FlatList
          horizontal
          data={[{ id: 0, name: 'All' }, ...mains]}
          keyExtractor={(c) => String(c.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          renderItem={({ item: c }) => {
            const active = activeMain === c.id;
            return (
              <TouchableOpacity style={st.cat} onPress={() => setCategory(c.id)} testID={`cat-${c.id}`}>
                <View style={[st.catImgWrap, catStyle.wrap, active && { borderColor: catStyle.active || colors.primary }]}>
                  {c.id === 0
                    ? <View style={[st.catImg, catStyle.img, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="grid" size={24} color={colors.primary} /></View>
                    : <ProductImage uri={c.image} style={[st.catImg, catStyle.img]} iconSize={22} />}
                </View>
                <Text style={[st.catText, catStyle.text, active && { color: catStyle.active || colors.primary }, active && catStyle.activeText]} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <SubCategoryChips cats={cats.data || []} value={category} onChange={setCategory} />
      {!!q && <Text style={{ color: colors.muted, marginBottom: 8 }}>Results for “{q}”</Text>}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1 }}
      key={cols}
      data={p.items}
      numColumns={cols}
      keyExtractor={(x) => String(x.id)}
      columnWrapperStyle={{ gap }}
      contentContainerStyle={{ padding: pad, paddingBottom: bottomPadding, maxWidth, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={top}
      ListEmptyComponent={p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : <Empty icon="basket-outline" text={q ? 'No products match your search' : 'No products yet'} />}
      renderItem={({ item }) => <ProductCard p={item} width={cardW} onSizes={onSizes} onPress={() => onProductPress?.(item)} />}
      onEndReached={p.loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={p.loadingMore ? <Loading /> : null}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={() => { p.refresh(); cats.reload(); onRefresh?.(); }} tintColor={colors.primary} />}
    />
  );
}

const st = StyleSheet.create({
  cat: { width: 72, alignItems: 'center' },
  catImgWrap: { borderRadius: 20, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  catImg: { width: 60, height: 60, borderRadius: 16 },
  catText: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 4 },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, RefreshControl, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SearchBar, Loading, ErrorBox, Empty } from '../components/ui';
import { ProductCard, IconBadge, ProductImage } from '../components/shop';
import BannerSlider from '../components/BannerSlider';
import { usePaged, useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { useCart } from '../components/CartContext';
import { api } from '../services/api';
import { money } from '../services/format';
import { getNewsSeen } from '../services/newsSeen';
import { colors } from '../theme';

// Storefront: categories + product grid (also what staff see under "View shop")
export default function HomeScreen({ navigation }) {
  const { shop, user, isStaff, reloadShop } = useAuth();
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [newsSeen, setNewsSeen] = useState(null);
  useFocusEffect(useCallback(() => { getNewsSeen().then(setNewsSeen); }, []));
  const hasNews = newsSeen !== null && (shop?.latest_news_id || 0) > newsSeen;

  // Search after typing stops
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const cats = useLoad(() => api.categories().then((r) => r.categories));
  const banners = useLoad(() => api.banners().then((r) => r.banners).catch(() => []));
  const p = usePaged((page) => api.products({ page, category_id: category, search: q }), 'products', [category, q]);

  const cols = width >= 700 ? 3 : 2;
  const pad = 14;
  const gap = 12;
  const cardW = (Math.min(width, 1000) - pad * 2 - gap * (cols - 1)) / cols;

  const header = (
    <View>
      {!shop?.is_open && (
        <View style={[st.banner, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="time-outline" size={18} color={colors.danger} />
          <Text style={[st.bannerText, { color: colors.danger }]}>{shop?.closed_message || 'We are closed right now and not taking orders.'}</Text>
        </View>
      )}
      {!!shop?.notice && (
        <View style={st.banner}>
          <Ionicons name="megaphone-outline" size={18} color={colors.primaryDark} />
          <Text style={st.bannerText}>{shop.notice}</Text>
        </View>
      )}
      {shop?.free_delivery_over > 0 && (
        <View style={[st.banner, { backgroundColor: colors.successSoft }]}>
          <Ionicons name="bicycle-outline" size={18} color={colors.success} />
          <Text style={[st.bannerText, { color: colors.success }]}>Free delivery on orders over {money(shop.free_delivery_over)}</Text>
        </View>
      )}
      <BannerSlider banners={banners.data || []} width={Math.min(width, 1000) - pad * 2}
        onPress={(b) => { if (b.category_id) { setSearch(''); setQ(''); setCategory(b.category_id); } }} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search products" />

      {(cats.data || []).length > 0 && (
        <FlatList
          horizontal
          data={[{ id: 0, name: 'All' }, ...cats.data]}
          keyExtractor={(c) => String(c.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          renderItem={({ item: c }) => {
            const active = category === c.id;
            return (
              <TouchableOpacity style={st.cat} onPress={() => setCategory(c.id)} testID={`cat-${c.id}`}>
                <View style={[st.catImgWrap, active && { borderColor: colors.primary }]}>
                  {c.id === 0
                    ? <View style={[st.catImg, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="grid" size={24} color={colors.primary} /></View>
                    : <ProductImage uri={c.image} style={st.catImg} iconSize={22} />}
                </View>
                <Text style={[st.catText, active && { color: colors.primary }]} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
      {!!q && <Text style={{ color: colors.muted, marginBottom: 8 }}>Results for “{q}”</Text>}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right']}>
      <View style={[st.top, { paddingTop: 10 + insets.top }]}>
        {shop?.logo_url ? <Image source={{ uri: shop.logo_url }} style={st.logo} resizeMode="contain" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={st.shopName} numberOfLines={1}>{shop?.name}</Text>
          <Text style={st.hello} numberOfLines={1}>{user ? `Hi, ${user.name?.split(' ')[0] || ''}` : 'Order online, pay on delivery'}</Text>
        </View>
        {isStaff && <IconBadge icon="speedometer-outline" onPress={() => navigation.navigate('AdminHome')} />}
        <IconBadge icon="information-circle-outline" onPress={() => navigation.navigate('Contact')} testID="open-contact" />
        <IconBadge icon="megaphone-outline" dot={hasNews} onPress={() => navigation.navigate('News')} testID="open-news" />
        <IconBadge icon="cart-outline" count={cart.count} onPress={() => navigation.navigate('Cart')} testID="open-cart" />
        <IconBadge icon="person-circle-outline" onPress={() => navigation.navigate('Account')} testID="open-account" />
      </View>

      <FlatList
        key={cols}
        data={p.items}
        numColumns={cols}
        keyExtractor={(x) => String(x.id)}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: pad, paddingBottom: (cart.count ? 90 : 30) + insets.bottom, maxWidth: 1000, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={header}
        ListEmptyComponent={p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : <Empty icon="basket-outline" text={q ? 'No products match your search' : 'No products yet'} />}
        renderItem={({ item }) => <ProductCard p={item} width={cardW} onPress={() => navigation.navigate('Product', { id: item.id, product: item })} />}
        onEndReached={p.loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={p.loadingMore ? <Loading /> : null}
        refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={() => { p.refresh(); cats.reload(); banners.reload(); reloadShop(); }} tintColor={colors.primary} />}
      />

      {cart.count > 0 && (
        <TouchableOpacity style={[st.cartBar, { bottom: 18 + insets.bottom }]} onPress={() => navigation.navigate('Cart')} testID="cart-bar">
          <View style={st.cartCount}><Text style={{ color: colors.onBrand, fontWeight: '800' }}>{cart.count}</Text></View>
          <Text style={st.cartBarText}>View cart</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[st.cartBarText, { color: colors.brand }]}>{money(cart.subtotal)}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.brand} />
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  top: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 16,
    backgroundColor: colors.brand, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4, zIndex: 1,
  },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff' },
  shopName: { fontSize: 20, fontWeight: '900', color: colors.onBrand },
  hello: { fontSize: 12, color: colors.onBrand, opacity: 0.75, fontWeight: '600' },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 16, padding: 10, marginBottom: 10 },
  bannerText: { flex: 1, color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
  cat: { width: 72, alignItems: 'center' },
  catImgWrap: { borderRadius: 20, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  catImg: { width: 60, height: 60, borderRadius: 16 },
  catText: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 4 },
  cartBar: {
    position: 'absolute', left: 14, right: 14, bottom: 18, height: 58, borderRadius: 29, backgroundColor: colors.black,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  cartCount: { backgroundColor: colors.brand, borderRadius: 14, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartBarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

import React, { useCallback, useState } from 'react';
import { View, Text, Image, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { IconBadge } from '../components/shop';
import { Catalogue } from '../components/Catalogue';
import { MenuStrip, runSync } from '../components/MenuSync';
import BannerSlider from '../components/BannerSlider';
import { CartPanel, SizePicker, isSplit, panelWidth } from '../components/CartPanel';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { useCart } from '../components/CartContext';
import { api } from '../services/api';
import { money } from '../services/format';
import { getNewsSeen } from '../services/newsSeen';
import { colors } from '../theme';

// Storefront: categories + product grid (also what staff see under "View shop")
export default function HomeScreen({ navigation }) {
  const { shop, user, isStaff, isTeam, isCashier, isSeller, reloadShop } = useAuth();
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [newsSeen, setNewsSeen] = useState(null);
  const [sizesOf, setSizesOf] = useState(null);
  useFocusEffect(useCallback(() => { getNewsSeen().then(setNewsSeen); }, []));
  const hasNews = newsSeen !== null && (shop?.latest_news_id || 0) > newsSeen;

  const banners = useLoad(() => api.banners().then((r) => r.banners).catch(() => []));

  // Tablet + taking orders: the order shows on the right while items are added on the left
  const split = isSplit(width, isSeller);
  const sideW = split ? panelWidth(width) : 0;

  const header = ({ showCategory, contentWidth }) => (
    <View>
      {isSeller && <MenuStrip onSetup={runSync} />}
      {isSeller && !split && (
        <TouchableOpacity style={[st.banner, { backgroundColor: colors.primarySoft }]} onPress={() => navigation.navigate('Cart')} testID="pos-banner">
          <Ionicons name="receipt-outline" size={18} color={colors.primaryDark} />
          <Text style={st.bannerText}>
            Taking an order: add items like a customer, then open the cart to enter the customer, discount and place it (confirmed at once).
          </Text>
        </TouchableOpacity>
      )}
      {!shop?.is_open && !isSeller && (
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
      <BannerSlider banners={banners.data || []} width={contentWidth}
        onPress={(b) => { if (b.category_id) showCategory(b.category_id); }} />
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
        {isCashier && <IconBadge icon="receipt-outline" onPress={() => navigation.navigate('AdminOrders')} />}
        {isTeam && <IconBadge icon="clipboard-outline" onPress={() => navigation.navigate('TeamHome')} />}
        <IconBadge icon="information-circle-outline" onPress={() => navigation.navigate('Contact')} testID="open-contact" />
        <IconBadge icon="megaphone-outline" dot={hasNews} onPress={() => navigation.navigate('News')} testID="open-news" />
        {!split && <IconBadge icon="cart-outline" count={cart.count} onPress={() => navigation.navigate('Cart')} testID="open-cart" />}
        <IconBadge icon="person-circle-outline" onPress={() => navigation.navigate('Account')} testID="open-account" />
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Catalogue
          width={width - sideW}
          header={header}
          bottomPadding={(cart.count || split ? 90 : 30) + insets.bottom}
          onSizes={split ? setSizesOf : undefined}
          onProductPress={(item) => navigation.navigate('Product', { id: item.id, product: item })}
          onRefresh={() => { banners.reload(); reloadShop(); }}
        />
      {split && <CartPanel width={sideW} onCheckout={() => navigation.navigate('PosOrder')} />}
      </View>
      {split && <SizePicker product={sizesOf} onClose={() => setSizesOf(null)} />}

      {cart.count > 0 && !split && (
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
  cartBar: {
    position: 'absolute', left: 14, right: 14, bottom: 18, height: 58, borderRadius: 29, backgroundColor: colors.black,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  cartCount: { backgroundColor: colors.brand, borderRadius: 14, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartBarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

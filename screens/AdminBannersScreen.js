import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen, Fab, Loading, Empty, ErrorBox, Badge, Card, s } from '../components/ui';
import { useLoad } from '../components/useData';
import { api } from '../services/api';
import { colors } from '../theme';

// Owner: banners shown in the slider at the top of the shop's home page
export default function AdminBannersScreen({ navigation }) {
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => api.adminBanners().then((r) => r.banners));
  const cats = useLoad(() => api.adminCategories().then((r) => r.categories));
  const catName = (id) => (cats.data || []).find((c) => c.id === id)?.name;

  return (
    <>
      <Screen title="Banners" onRefresh={refresh} refreshing={refreshing}>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
          <>
            <Card>
              <Text style={s.itemMeta}>Banners slide at the top of the shop, above search. Use wide photos (2:1, e.g. 1200 × 600). Lower position numbers show first.</Text>
            </Card>
            {!data?.length ? <Empty icon="images-outline" text="No banners yet. Tap + to add offers or new arrivals to the home page." /> : data.map((b) => (
              <TouchableOpacity key={b.id} style={st.row} onPress={() => navigation.navigate('BannerForm', { banner: b })} testID={`admin-banner-${b.id}`}>
                {b.image
                  ? <Image source={{ uri: b.image.thumb }} style={st.thumb} resizeMode="cover" />
                  : <View style={st.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle} numberOfLines={1}>{b.title || 'Banner'}</Text>
                  <Text style={s.itemMeta} numberOfLines={1}>
                    {[`Position ${b.sort_order}`, b.category_id ? `Opens ${catName(b.category_id) || 'category'}` : 'No link'].join(' · ')}
                  </Text>
                </View>
                {b.status === 'hidden' && <Badge status="inactive" label="Hidden" />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 70 }} />
          </>
        )}
      </Screen>
      <Fab label="Banner" onPress={() => navigation.navigate('BannerForm', { nextPosition: (data || []).reduce((m, b) => Math.max(m, b.sort_order + 1), 0) })} />
    </>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 10,
  },
  thumb: { width: 96, height: 48, borderRadius: 8, backgroundColor: colors.background },
});

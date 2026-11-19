import React, { useEffect } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Screen, Loading, ErrorBox, Empty } from '../components/ui';
import { usePaged } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { niceDate } from '../services/format';
import { markNewsSeen } from '../services/newsSeen';
import { colors } from '../theme';

// Customers: the shop's announcements, newest first
export default function NewsScreen({ navigation }) {
  const { shop } = useAuth();
  const p = usePaged((page) => api.news({ page }), 'news');

  // Opening the list counts as seeing everything in it
  useEffect(() => {
    const newest = Math.max(shop?.latest_news_id || 0, p.items[0]?.id || 0);
    markNewsSeen(newest);
  }, [p.items, shop?.latest_news_id]);

  return (
    <Screen title="News" subtitle={shop?.name} scroll={false} padded={false}>
      <FlatList
        data={p.items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ padding: 14, paddingBottom: 32, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : <Empty icon="megaphone-outline" text="No news yet. Offers and updates from the shop will show here." />}
        renderItem={({ item: n }) => (
          <TouchableOpacity style={st.card} activeOpacity={0.8} onPress={() => navigation.navigate('NewsDetail', { id: n.id, news: n })} testID={`news-${n.id}`}>
            {!!n.image && <Image source={{ uri: n.image.url }} style={st.img} resizeMode="cover" />}
            <View style={{ padding: 14 }}>
              <Text style={st.title}>{n.title}</Text>
              {!!n.body && <Text style={st.body} numberOfLines={3}>{n.body}</Text>}
              <Text style={st.date}>{niceDate(n.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
        onEndReached={p.loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={p.loadingMore ? <Loading /> : null}
        refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.refresh} tintColor={colors.primary} />}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 12 },
  img: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.background },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  body: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20 },
  date: { fontSize: 12, color: colors.muted, marginTop: 8 },
});

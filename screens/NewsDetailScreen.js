import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Screen, Loading, ErrorBox } from '../components/ui';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { niceDate } from '../services/format';
import { markNewsSeen } from '../services/newsSeen';
import { colors } from '../theme';

// One news post (opened from the list or from a push notification)
export default function NewsDetailScreen({ route }) {
  const { shop } = useAuth();
  const id = route.params?.id;
  const { data, loading, error, reload, refresh, refreshing } = useLoad(
    () => api.newsItem(id).then((r) => { markNewsSeen(r.news.id); return r.news; }),
    [id],
  );
  const n = data || route.params?.news;

  return (
    <Screen title="News" subtitle={shop?.name} onRefresh={refresh} refreshing={refreshing}>
      {!n ? (loading ? <Loading /> : <ErrorBox message={error} onRetry={reload} />) : (
        <View style={{ maxWidth: 760, width: '100%', alignSelf: 'center' }}>
          {!!n.image && <Image source={{ uri: n.image.url }} style={st.img} resizeMode="cover" />}
          <Text style={st.title}>{n.title}</Text>
          <Text style={st.date}>{niceDate(n.created_at)}</Text>
          {!!n.body && <Text style={st.body} selectable>{n.body}</Text>}
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  img: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: colors.background, marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  date: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 12 },
  body: { fontSize: 15, color: colors.text, lineHeight: 23 },
});

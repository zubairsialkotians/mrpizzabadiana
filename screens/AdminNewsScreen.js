import React from 'react';
import { View, Text } from 'react-native';
import { Screen, Fab, ListItem, Loading, Empty, ErrorBox, LoadMore, Badge, Card, s } from '../components/ui';
import { usePaged } from '../components/useData';
import { api } from '../services/api';
import { niceDate } from '../services/format';

// Owner: news posts. Posting one can notify every phone with the app.
export default function AdminNewsScreen({ navigation }) {
  const p = usePaged((page) => api.adminNews({ page }), 'news');

  return (
    <>
      <Screen title="News" onRefresh={p.refresh} refreshing={p.refreshing}>
        {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : (
          <>
            <Card>
              <Text style={s.itemMeta}>
                {p.meta.devices
                  ? `${p.meta.devices} phone${p.meta.devices === 1 ? '' : 's'} can get news notifications.`
                  : 'No phones have allowed notifications yet. They are added when customers open the app.'}
              </Text>
            </Card>
            {!p.items.length ? <Empty icon="megaphone-outline" text="No news yet. Tap + to tell customers about offers, new stock or timings." /> : p.items.map((n) => (
              <ListItem key={n.id} title={n.title} subtitle={n.body}
                meta={[niceDate(n.created_at), n.notified_at ? `Sent to ${n.notified_count} phone${n.notified_count === 1 ? '' : 's'}` : 'Not sent'].join(' · ')}
                badge={n.status === 'hidden' ? <Badge status="inactive" label="Hidden" /> : null}
                onPress={() => navigation.navigate('NewsForm', { news: n })} />
            ))}
            <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
            <View style={{ height: 70 }} />
          </>
        )}
      </Screen>
      <Fab label="News" onPress={() => navigation.navigate('NewsForm')} />
    </>
  );
}

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen, Card, Chip, ChipRow, DateRangeBar, BranchFilter, Loading, ErrorBox, Empty, LoadMore } from '../components/ui';
import { Stars, ReviewView, STAR_COLOR } from '../components/reviews';
import { usePaged } from '../components/useData';
import { api } from '../services/api';
import { money, rangeFor, rangeLabel } from '../services/format';
import { colors } from '../theme';

// All customer reviews; tap one to open its order
export default function ReviewsScreen({ navigation }) {
  const [range, setRange] = useState(rangeFor('all'));
  const [branchId, setBranchId] = useState(0);
  const [rating, setRating] = useState(0);
  const p = usePaged(
    (page) => api.reviews({ page, from: range.from, to: range.to, branch_id: branchId, rating }),
    'reviews', [range.from, range.to, branchId, rating],
  );
  const sum = p.meta.summary;

  return (
    <Screen title="Reviews" subtitle={rangeLabel(range)} right={<BranchFilter value={branchId} onChange={setBranchId} />} onRefresh={p.refresh} refreshing={p.refreshing}>
      <DateRangeBar value={range} onChange={setRange} />

      {sum && sum.count > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <View style={{ alignItems: 'center', width: 96 }}>
              <Text style={st.avg}>{sum.average.toFixed(1)}</Text>
              <Stars value={Math.round(sum.average)} size={14} />
              <Text style={st.count}>{sum.count} review{sum.count > 1 ? 's' : ''}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {[5, 4, 3, 2, 1].map((n) => {
                const c = sum.by_rating[String(n)] || 0;
                return (
                  <TouchableOpacity key={n} style={st.barRow} onPress={() => setRating(rating === n ? 0 : n)}>
                    <Text style={[st.barLabel, rating === n && { color: colors.primary }]}>{n}★</Text>
                    <View style={st.barTrack}><View style={[st.barFill, { width: `${(c / sum.count) * 100}%` }]} /></View>
                    <Text style={st.barCount}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Card>
      )}

      <ChipRow>
        <Chip label="All ratings" active={!rating} onPress={() => setRating(0)} />
        {[5, 4, 3, 2, 1].map((n) => <Chip key={n} icon="star" label={String(n)} active={rating === n} onPress={() => setRating(n)} />)}
      </ChipRow>

      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon="star-outline" text={rating ? `No ${rating}-star reviews` : 'No reviews yet. Customers can rate an order once it is delivered.'} />
      ) : p.items.map((r) => (
        <ReviewView key={r.id} review={r} title={`${r.customer_name} · ${r.order_no}`}
          sub={[money(r.total), r.branch_name].filter(Boolean).join(' · ')}
          onPress={() => navigation.navigate('AdminOrderDetail', { id: r.order_id })} />
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
    </Screen>
  );
}

const st = StyleSheet.create({
  avg: { fontSize: 34, fontWeight: '800', color: colors.text },
  count: { fontSize: 12, color: colors.muted, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 1 },
  barLabel: { width: 26, fontSize: 12, fontWeight: '700', color: colors.muted },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: STAR_COLOR },
  barCount: { width: 28, fontSize: 12, color: colors.muted, textAlign: 'right' },
});

import React, { useState } from 'react';
import { Text } from 'react-native';
import { Screen, Card, Stat, StatGrid, DateRangeBar, BranchFilter, Loading, ErrorBox, Empty, LoadMore, Button, s } from '../components/ui';
import { usePaged } from '../components/useData';
import { api } from '../services/api';
import { money, niceDate, qtyLabel, rangeFor, rangeLabel } from '../services/format';
import { colors } from '../theme';

export default function ReturnsScreen({ navigation }) {
  const [range, setRange] = useState(rangeFor('month'));
  const [branchId, setBranchId] = useState(0);
  const p = usePaged((page) => api.returns({ page, from: range.from, to: range.to, branch_id: branchId }), 'returns', [range.from, range.to, branchId]);
  const sum = p.meta.summary;

  return (
    <Screen title="Returns" subtitle={rangeLabel(range)} right={<BranchFilter value={branchId} onChange={setBranchId} />} onRefresh={p.refresh} refreshing={p.refreshing}>
      <Button testID="new-walkin-return" title="New return (pick items)" icon="add" onPress={() => navigation.navigate('PosReturn')} style={{ marginBottom: 12 }} />
      <DateRangeBar value={range} onChange={setRange} />
      {sum && (
        <StatGrid>
          <Stat label="Refunded" value={money(sum.refund)} sub={`${sum.count} returns`} tone="bad" />
          <Stat label="Damaged (cost lost)" value={money(sum.loss)} tone="warn" />
        </StatGrid>
      )}
      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length ? (
        <Empty icon="return-down-back-outline" text="No returns. Press New return, or record one from a delivered order." />
      ) : p.items.map((r) => (
        <Card key={r.id} onPress={r.order_id ? () => navigation.navigate('AdminOrderDetail', { id: r.order_id }) : undefined}>
          <Text style={s.itemTitle}>{r.order_id ? `${r.order_no} · ${r.customer_name}` : 'Walk-in return'}</Text>
          <Text style={s.itemMeta}>{niceDate(r.created_at)} · {r.by}{r.note ? ` · ${r.note}` : ''}</Text>
          {r.items.map((i, k) => (
            <Text key={k} style={{ color: i.restock ? colors.text : colors.danger, marginTop: 4 }}>
              {qtyLabel(i.qty, i.unit)} {i.name} · {money(i.refund)}{i.restock ? '' : ' · damaged'}
            </Text>
          ))}
          <Text style={{ fontWeight: '800', color: colors.danger, marginTop: 6 }}>Refund {money(r.refund)}</Text>
        </Card>
      ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
    </Screen>
  );
}

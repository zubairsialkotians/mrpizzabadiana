import React, { useState } from 'react';
import { Screen, ListItem, Loading, Empty, ErrorBox, LoadMore, BranchFilter } from '../components/ui';
import { usePaged } from '../components/useData';
import { api } from '../services/api';
import { qty, niceDate } from '../services/format';

const TYPE_LABELS = {
  purchase: 'Stock in', out: 'Stock out', adjust: 'Count adjusted', sale: 'Order confirmed',
  cancel: 'Order cancelled', return: 'Customer return', edit: 'Order changed',
};

export default function StockMovesScreen({ route }) {
  const itemId = route.params?.itemId;
  const [branchId, setBranchId] = useState(route.params?.branchId || 0);
  const p = usePaged((page) => api.stockMoves({ page, item_id: itemId, branch_id: branchId }), 'moves', [branchId]);

  return (
    <Screen title="Stock history" subtitle={route.params?.title} right={<BranchFilter value={branchId} onChange={setBranchId} />}
      onRefresh={p.refresh} refreshing={p.refreshing}>
      {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : !p.items.length
        ? <Empty icon="time-outline" text="No stock movements yet" />
        : p.items.map((m) => (
          <ListItem
            key={m.id}
            title={itemId ? (TYPE_LABELS[m.type] || m.type) : m.item_name}
            subtitle={[itemId ? null : TYPE_LABELS[m.type] || m.type, m.note, m.branch_name].filter(Boolean).join(' · ')}
            meta={`${niceDate(m.created_at)}${m.by ? ` · ${m.by}` : ''}`}
            right={`${m.change > 0 ? '+' : ''}${qty(m.change)}`}
            rightTone={m.change > 0 ? 'good' : 'bad'}
            rightSub={`bal ${qty(m.balance)} ${m.unit}`}
          />
        ))}
      <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
    </Screen>
  );
}

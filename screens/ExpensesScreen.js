import React, { useState } from 'react';
import { Screen, Fab, ListItem, Loading, Empty, ErrorBox, BranchFilter, DateRangeBar, LoadMore, Stat, StatGrid, SelectField } from '../components/ui';
import { usePaged, useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, niceDate, rangeFor, rangeLabel } from '../services/format';

export default function ExpensesScreen({ navigation }) {
  const { isOwner } = useAuth();
  const [range, setRange] = useState(rangeFor('month'));
  const [branchId, setBranchId] = useState(0);
  const [category, setCategory] = useState('');
  const cats = useLoad(() => api.expenseCategories().then((r) => r.categories).catch(() => []));
  const p = usePaged((page) => api.expenses({ page, from: range.from, to: range.to, branch_id: branchId, category }), 'expenses',
    [range.from, range.to, branchId, category]);

  return (
    <>
      <Screen title="Expenses" right={<BranchFilter value={branchId} onChange={setBranchId} />} onRefresh={p.refresh} refreshing={p.refreshing}>
        <DateRangeBar value={range} onChange={setRange} />
        {(cats.data?.length > 0 || !!category) && (
          <SelectField compact label="Category" value={category} onChange={setCategory} placeholder="All categories" alwaysSearch
            options={[{ value: '', label: 'All categories' }, ...(cats.data || []).map((c) => ({ value: c, label: c }))]}
            style={{ alignSelf: 'flex-start', marginBottom: 10 }} />
        )}
        {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : (
          <>
            <StatGrid><Stat label={`${category || 'Total'} · ${rangeLabel(range)}`} value={money(p.meta.total)} tone="bad" /></StatGrid>
            {!p.items.length ? <Empty icon="trending-down-outline" text={category ? `No “${category}” expenses in this period` : 'No expenses in this period'} /> : p.items.map((e) => (
              <ListItem key={e.id} title={e.category} subtitle={e.note}
                meta={[niceDate(e.expense_date, false), e.by, isOwner && !branchId ? e.branch_name : null].filter(Boolean).join(' · ')}
                right={money(e.amount)} rightTone="bad" onPress={() => navigation.navigate('ExpenseForm', { expense: e })} />
            ))}
            <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
          </>
        )}
      </Screen>
      <Fab label="Expense" onPress={() => navigation.navigate('ExpenseForm', { branchId })} />
    </>
  );
}

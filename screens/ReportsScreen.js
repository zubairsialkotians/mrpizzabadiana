import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, Segmented, DateRangeBar, BranchFilter, Stat, StatGrid, Card, KV, SectionTitle, Loading, ErrorBox, Empty, ListItem, s } from '../components/ui';
import { useLoad } from '../components/useData';
import { api } from '../services/api';
import { money, qtyLabel, niceDate, rangeFor, rangeLabel } from '../services/format';
import { colors } from '../theme';

export default function ReportsScreen({ route }) {
  const [tab, setTab] = useState(route.params?.tab || 'sales');
  const [range, setRange] = useState(rangeFor('month'));
  const [branchId, setBranchId] = useState(0);
  const params = { from: range.from, to: range.to, branch_id: branchId };
  const { data, loading, error, reload, refresh, refreshing } = useLoad(
    // Tag each result with its tab: right after switching, the old tab's data is still here for one render
    () => (tab === 'sales' ? api.salesReport(params) : api.profitLoss(params)).then((res) => ({ ...res, tab })),
    [tab, range.from, range.to, branchId],
  );
  const r = data?.tab === tab ? data.report : null;
  const waiting = loading || (!!data && data.tab !== tab && !error);

  return (
    <Screen title="Reports" subtitle={rangeLabel(range)} right={<BranchFilter value={branchId} onChange={setBranchId} />} onRefresh={refresh} refreshing={refreshing}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'sales', label: 'Sales' }, { value: 'pl', label: 'Profit & loss' }]} />
      <DateRangeBar value={range} onChange={setRange} />
      {waiting ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !r ? null : tab === 'sales' ? (
        <>
          <StatGrid>
            <Stat label="Item sales" value={money(r.sales)} sub={`${r.orders} orders`} tone="primary" />
            <Stat label="Average order" value={money(r.average)} />
            <Stat label="Delivery charges" value={money(r.delivery)} />
            <Stat label="Collected (total)" value={money(r.total)} tone="good" />
          </StatGrid>
          {!r.orders ? <Empty icon="bar-chart-outline" text="No sales in this period" /> : (
            <>
              <SectionTitle>Top items</SectionTitle>
              {(r.items || []).map((i) => (
                <ListItem key={i.key || `${i.item_id}|${i.size || ''}`} title={i.name} subtitle={`${qtyLabel(i.qty, i.unit)} sold · profit ${money(i.profit)}`} right={money(i.sales)} />
              ))}
              <SectionTitle>By category</SectionTitle>
              <Card>{(r.categories || []).map((c) => <KV key={c.name} label={c.name} value={money(c.sales)} />)}</Card>
              <SectionTitle>By day</SectionTitle>
              <Card>{(r.by_day || []).map((d) => <KV key={d.date} label={`${niceDate(d.date, false)} · ${d.orders} orders`} value={money(d.sales)} />)}</Card>
            </>
          )}
        </>
      ) : (
        <>
          <StatGrid>
            <Stat label="Net profit" value={money(r.net_profit)} tone={r.net_profit >= 0 ? 'good' : 'bad'} />
            <Stat label="Gross margin" value={`${r.margin}%`} sub={`Gross ${money(r.gross_profit)}`} />
          </StatGrid>
          <Card>
            <KV label={`Item sales (${r.orders} orders)`} value={money(r.sales)} />
            {r.refunds > 0 && <KV label="Returns refunded" value={`-${money(r.refunds)}`} tone="bad" />}
            <KV label="Net sales" value={money(r.net_sales)} bold />
            <KV label="Cost of items sold" value={`-${money(r.cost)}`} />
            <KV label="Gross profit" value={money(r.gross_profit)} bold />
            <KV label="Delivery charges" value={`+${money(r.delivery)}`} />
            <KV label="Expenses" value={`-${money(r.expenses)}`} />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
            <KV label="Net profit" value={money(r.net_profit)} bold tone={r.net_profit >= 0 ? 'good' : 'bad'} />
            {r.returns_loss > 0 && <Text style={s.itemMeta}>Includes {money(r.returns_loss)} cost of damaged returns (not restocked).</Text>}
            <Text style={s.itemMeta}>Cost uses each item's cost price when the order was confirmed.</Text>
          </Card>
          {data.branches?.length > 1 && (
            <>
              <SectionTitle>By branch</SectionTitle>
              {data.branches.map((b) => (
                <ListItem key={b.branch_id} icon="business-outline" title={b.branch_name} subtitle={`Sales ${money(b.net_sales)} · ${b.orders} orders`}
                  right={money(b.net_profit)} rightTone={b.net_profit >= 0 ? 'good' : 'bad'} onPress={() => setBranchId(b.branch_id)} />
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

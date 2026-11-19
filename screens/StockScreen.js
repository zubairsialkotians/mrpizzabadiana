import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen, Loading, Empty, ErrorBox, SearchBar, ChipRow, Chip, BranchFilter, BranchField, Stat, StatGrid, Field, Button,
  Segmented, HeaderButton, LoadMore, s,
} from '../components/ui';
import { ProductImage } from '../components/shop';
import { usePaged, useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, qtyLabel } from '../services/format';
import { colors } from '../theme';

export default function StockScreen({ navigation, route }) {
  const { isOwner, branches } = useAuth();
  const [branchId, setBranchId] = useState(0);
  const [cat, setCat] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [low, setLow] = useState(!!route.params?.low);
  const [adjust, setAdjust] = useState(null);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const cats = useLoad(() => api.adminCategories().then((r) => r.categories));
  const p = usePaged((page) => api.stock({ page, branch_id: branchId, category_id: cat, low: low ? 1 : 0, search: q }), 'stock', [branchId, cat, low, q]);

  return (
    <>
      <Screen
        title="Stock"
        subtitle={isOwner && branches.length > 1 ? (branchId ? branches.find((b) => b.id === branchId)?.name : 'All branches') : undefined}
        right={<HeaderButton icon="time-outline" onPress={() => navigation.navigate('StockMoves', { branchId })} />}
        onRefresh={p.refresh} refreshing={p.refreshing}
      >
        <View style={{ marginBottom: 10, alignItems: 'flex-start' }}><BranchFilter value={branchId} onChange={setBranchId} /></View>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search item" />
        <ChipRow>
          <Chip icon="alert-circle-outline" label="Low stock" active={low} onPress={() => setLow(!low)} />
          <Chip label="All categories" active={!cat} onPress={() => setCat(0)} />
          {(cats.data || []).map((c) => <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} />)}
        </ChipRow>

        {p.loading ? <Loading /> : p.error ? <ErrorBox message={p.error} onRetry={p.reload} /> : (
          <>
            <StatGrid><Stat label="Stock value (cost)" value={money(p.meta.stock_value)} tone="primary" icon="cube" /></StatGrid>
            {!p.items.length ? <Empty icon="cube-outline" text={low ? 'No low stock items' : 'No items with stock tracking yet.'} /> : p.items.map((r) => (
              <TouchableOpacity key={r.item_id} style={[s.item, { gap: 10 }]} onPress={() => setAdjust(r)} testID={`stock-${r.item_id}`}>
                <ProductImage uri={r.image} style={{ width: 44, height: 44, borderRadius: 8 }} iconSize={18} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{r.name}</Text>
                  <Text style={s.itemMeta}>{r.category_name}{r.low_stock ? ` · alert at ${qtyLabel(r.low_stock, r.unit)}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.itemRight, r.low && { color: colors.danger }]}>{qtyLabel(r.qty, r.unit)}</Text>
                  <Text style={s.itemMeta}>{money(r.value)}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <LoadMore hasMore={p.hasMore} loading={p.loadingMore} onPress={p.loadMore} />
          </>
        )}
      </Screen>
      {adjust && (
        <AdjustModal
          row={adjust}
          branchId={branchId}
          onClose={() => setAdjust(null)}
          onDone={() => { setAdjust(null); p.reload(); }}
          onHistory={() => { const r = adjust; setAdjust(null); navigation.navigate('StockMoves', { itemId: r.item_id, branchId, title: r.name }); }}
        />
      )}
    </>
  );
}

// Stock in (purchase), out (wastage/use) or set the counted amount
function AdjustModal({ row, branchId, onClose, onDone, onHistory }) {
  const [type, setType] = useState('in');
  const [branch, setBranch] = useState(branchId);
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [updateCost, setUpdateCost] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.adjustStock({
        branch_id: branch, item_id: row.item_id, type, qty: amount, ...(cost ? { unit_cost: cost } : {}), update_cost: updateCost ? 1 : 0, note,
      });
      Toast.show({ type: 'success', text1: r.message, text2: `${row.name}: ${qtyLabel(r.qty, row.unit)}` });
      onDone();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not update stock', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBack}>
        <View style={[s.sheet, { maxHeight: '90%' }]}>
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{row.name}</Text>
              <Text style={s.itemMeta}>In stock: {qtyLabel(row.qty, row.unit)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <BranchField value={branch} onChange={setBranch} label="Branch (main if not chosen)" />
          <Segmented value={type} onChange={setType} options={[
            { value: 'in', label: 'Stock in' }, { value: 'out', label: 'Stock out' }, { value: 'set', label: 'Set count' },
          ]} />
          <Field label={`${type === 'set' ? 'Counted quantity' : 'Quantity'} (${row.unit})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus testID="adj-qty" />
          {type === 'in' && (
            <>
              <Field label={`Buying price per ${row.unit} (optional)`} value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
              <TouchableOpacity onPress={() => setUpdateCost(!updateCost)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name={updateCost ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                <Text style={{ color: colors.text }}>Use this as the item's cost price</Text>
              </TouchableOpacity>
            </>
          )}
          <Field label="Note" value={note} onChangeText={setNote} placeholder={type === 'in' ? 'e.g. Supplier invoice #' : 'Reason (e.g. wastage)'} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="History" variant="outline" icon="time-outline" onPress={onHistory} style={{ flex: 1 }} />
            <Button testID="adj-save" title="Save" onPress={save} loading={saving} disabled={!amount} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

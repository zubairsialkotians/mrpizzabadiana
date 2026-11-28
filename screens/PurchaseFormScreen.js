import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Card, KV, Field, Button, Footer, SectionTitle, SelectField, BranchField, Chip, ChipRow, s } from '../components/ui';
import { useLoad } from '../components/useData';
import { useIsFocused } from '@react-navigation/native';
import { useBarcodeScanner } from '../components/scan';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, qtyLabel, perUnit } from '../services/format';
import { round2 } from '../services/qty';
import { colors } from '../theme';

/*
  New purchase: pick the category and the item (or add a new item right here), then what was bought:
  quantity, cost per unit, date, supplier. Saving adds the stock to the branch, keeps the item's cost price
  up to date, and can change its sale price. The purchase itself is its own record (Purchases list).
*/
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };
const num = (v) => (v === '' || v == null ? '' : String(v));

export default function PurchaseFormScreen({ navigation, route }) {
  const { isOwner, branches } = useAuth();
  const main = branches.find((b) => b.is_main) || branches[0];
  const [branchId, setBranchId] = useState(main?.id || 0);
  const [cat, setCat] = useState(route.params?.category_id || 0);
  const [itemId, setItemId] = useState(route.params?.item_id || 0);
  const [f, setF] = useState({ qty: '', unit_cost: '', purchase_date: today(), supplier: '', note: '', sale_price: '', size: '', update_cost: true });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const cats = useLoad(() => api.adminCategories().then((r) => r.categories || []));
  // Items of the chosen category (or all), with this branch's stock
  const items = useLoad(() => api.adminItems({ category_id: cat, per_page: 200, branch_id: branchId }).then((r) => r.items || []), [cat, branchId]);

  // Came back from "New item": select it
  const newItemId = route.params?.newItemId;
  useEffect(() => {
    if (!newItemId) return;
    if (route.params?.newItemCategory != null) setCat(route.params.newItemCategory);
    setItemId(newItemId);
    items.reload();
  }, [newItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    Barcode / QR scan: chooses the item with that SKU / barcode. None has it: offer a new item with the code filled in.
  */
  const focused = useIsFocused();
  useBarcodeScanner(async (code) => {
    try {
      const r = await api.adminItems({ search: code, per_page: 30, branch_id: branchId });
      const found = (r.items || []).find((x) => x.sku && String(x.sku).trim().toLowerCase() === code.trim().toLowerCase());
      if (found) {
        setCat(found.category_id || 0);
        setItemId(found.id);
        Toast.show({ type: 'success', text1: `${found.name} chosen`, text2: code, visibilityTime: 1500 });
      } else {
        Toast.show({ type: 'info', text1: 'No item with this barcode', text2: 'Tap here to add it as a new item', visibilityTime: 7000,
          onPress: () => { Toast.hide(); navigation.navigate('ItemForm', { forPurchase: true, sku: code, category_id: cat || undefined }); } });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not look up the barcode', text2: e.message });
    }
  }, focused);

  const item = useMemo(() => (items.data || []).find((x) => x.id === itemId) || null, [items.data, itemId]);
  const sized = !!item?.sizes?.length;
  const size = sized ? item.sizes.find((z) => z.name === f.size) || null : null;
  // The item's current prices, to show and pre-fill the cost
  useEffect(() => {
    if (!item) return;
    setF((p) => ({
      ...p,
      size: sized ? (item.sizes.some((z) => z.name === p.size) ? p.size : item.sizes[0].name) : '',
      unit_cost: p.unit_cost || num(sized ? '' : (item.cost_price || '')),
    }));
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const qty = Number(f.qty) || 0;
  const cost = Number(f.unit_cost) || 0;
  const total = round2(qty * cost);
  const currentPrice = sized ? size?.price : item?.price;
  const currentCost = sized ? size?.cost : item?.cost_price;

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.savePurchase({
        item_id: item.id, branch_id: branchId, qty, unit_cost: cost, purchase_date: f.purchase_date.trim(),
        supplier: f.supplier, note: f.note, sale_price: Number(f.sale_price) || 0, size: f.size, update_cost: f.update_cost,
      });
      Toast.show({ type: 'success', text1: 'Purchase saved', text2: r.message, visibilityTime: 5000 });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save the purchase', text2: e.message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const ok = item && qty > 0 && cost >= 0 && f.unit_cost !== '' && /^\d{4}-\d{2}-\d{2}$/.test(f.purchase_date.trim());
  const catOptions = [{ value: 0, label: 'All categories' }, ...(cats.data || []).map((c) => ({ value: c.id, label: c.name }))];
  const itemOptions = (items.data || []).map((x) => ({
    value: x.id, label: x.name,
    sub: `${x.sizes?.length ? x.sizes.map((z) => `${z.name} ${money(z.price)}`).join(' · ') : perUnit(x.price, x.unit)}${x.track_stock ? ` · stock ${qtyLabel(x.stock || 0, x.unit)}` : ''}`,
  }));

  return (
    <Screen title="New purchase" subtitle="Stock you bought"
      footer={<Footer><Button testID="purchase-save" title={`Save purchase${total ? ` · ${money(total)}` : ''}`} icon="checkmark-circle-outline" onPress={save} loading={saving} disabled={!ok} /></Footer>}>
      {isOwner && branches.length > 1 && <BranchField value={branchId} onChange={setBranchId} label="Stock goes to" />}

      <SectionTitle>Item</SectionTitle>
      <SelectField label="Category" value={cat} options={catOptions} onChange={(v) => { setCat(v); setItemId(0); }} />
      <SelectField label="Item" value={itemId || null} options={itemOptions} onChange={setItemId} alwaysSearch
        placeholder={items.loading ? 'Loading items…' : itemOptions.length ? 'Choose the item you bought' : 'No items in this category'}
        searchPlaceholder="Search items" />
      <Button testID="purchase-new-item" small variant="outline" icon="add-circle-outline" title="New item (not in the list)"
        onPress={() => navigation.navigate('ItemForm', { forPurchase: true, category_id: cat || undefined })} style={{ marginBottom: 12 }} />

      {item && (
        <Card>
          <KV label="In stock now" value={item.track_stock ? qtyLabel(item.stock || 0, item.unit) : 'Not tracked'} />
          {sized ? item.sizes.map((z) => <KV key={z.name} label={`${z.name}: sale / cost`} value={`${money(z.price)} / ${money(z.cost || 0)}`} />) : (
            <>
              <KV label="Sale price" value={perUnit(item.price, item.unit)} />
              <KV label="Cost price" value={money(item.cost_price || 0)} />
            </>
          )}
        </Card>
      )}

      {item && (
        <>
          <SectionTitle>What you bought</SectionTitle>
          <Field label={`Quantity bought (${item.unit})`} value={f.qty} onChangeText={set('qty')} keyboardType="decimal-pad" placeholder="0" testID="purchase-qty" />
          <Field label={`Purchase cost per ${item.unit}`} value={f.unit_cost} onChangeText={set('unit_cost')} keyboardType="decimal-pad" placeholder="0" testID="purchase-cost"
            hint={total ? `Total: ${money(total)}` : 'What you paid for one'} />
          <Field label="Purchase date" value={f.purchase_date} onChangeText={set('purchase_date')} placeholder="YYYY-MM-DD" autoCapitalize="none" testID="purchase-date" />
          <ChipRow style={{ marginTop: -4, marginBottom: 8 }}>
            <Chip label="Today" active={f.purchase_date === today()} onPress={() => set('purchase_date')(today())} />
            <Chip label="Yesterday" active={f.purchase_date === yesterday()} onPress={() => set('purchase_date')(yesterday())} />
          </ChipRow>
          <Field label="Supplier (optional)" value={f.supplier} onChangeText={set('supplier')} placeholder="e.g. Metro Cash & Carry" testID="purchase-supplier" />
          <Field label="Note (optional)" value={f.note} onChangeText={set('note')} placeholder="Invoice no, payment…" />

          <SectionTitle>Prices</SectionTitle>
          {sized && (
            <>
              <Text style={[s.itemMeta, { marginBottom: 6 }]}>Sizes share one stock. Pick the size whose cost / sale price this purchase updates.</Text>
              <ChipRow style={{ marginBottom: 8 }}>
                {item.sizes.map((z) => <Chip key={z.name} label={z.name} active={f.size === z.name} onPress={() => set('size')(z.name)} />)}
              </ChipRow>
            </>
          )}
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>Update the item's cost price</Text>
              <Text style={s.itemMeta}>{cost > 0 ? `${money(currentCost || 0)} → ${money(cost)} (used for profit in reports)` : 'Used for profit in reports'}</Text>
            </View>
            <Switch value={f.update_cost} onValueChange={set('update_cost')} trackColor={{ true: colors.primary }} />
          </Card>
          <Field label={`New sale price${sized && f.size ? ` (${f.size})` : ''} (optional)`} value={f.sale_price} onChangeText={set('sale_price')} keyboardType="decimal-pad"
            placeholder={currentPrice != null ? String(currentPrice) : ''} testID="purchase-sale-price"
            hint={`Leave empty to keep ${money(currentPrice || 0)}. Changes the price customers and staff see.`} />
        </>
      )}
    </Screen>
  );
}

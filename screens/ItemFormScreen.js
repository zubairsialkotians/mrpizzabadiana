import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Switch, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, SelectField, SectionTitle, Card, Chip, BranchField, Segmented, s } from '../components/ui';
import { useLoad } from '../components/useData';
import { useIsFocused } from '@react-navigation/native';
import { useBarcodeScanner } from '../components/scan';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { catOptions } from '../components/CategoryFilter';
import { pickAndUpload } from '../services/images';
import { qtyLabel, money } from '../services/format';
import { colors } from '../theme';

// Matches SA_UNITS on the server
const UNITS = [
  { value: 'kg', label: 'Kilogram (kg)', group: 'weight' },
  { value: 'g', label: 'Gram (g)', group: 'count' },
  { value: 'litre', label: 'Litre', group: 'weight' },
  { value: 'ml', label: 'Millilitre (ml)', group: 'count' },
  { value: 'pcs', label: 'Piece (pcs)' }, { value: 'pack', label: 'Pack' }, { value: 'dozen', label: 'Dozen' },
  { value: 'box', label: 'Box' }, { value: 'bottle', label: 'Bottle' }, { value: 'can', label: 'Can' }, { value: 'jar', label: 'Jar' },
  { value: 'bag', label: 'Bag' }, { value: 'bundle', label: 'Bundle' }, { value: 'tray', label: 'Tray' }, { value: 'meter', label: 'Meter' },
  { value: 'pair', label: 'Pair' }, { value: 'set', label: 'Set' }, { value: 'roll', label: 'Roll' },
];

// Ready-made "sell by" choices per unit (customer picks one of the amounts)
const PRESETS = {
  kg: { options: [0.25, 0.5, 1, 2, 5], min: 0.25, step: 0.25 },
  litre: { options: [0.5, 1, 1.5, 2, 5], min: 0.5, step: 0.5 },
  g: { options: [100, 250, 500], min: 100, step: 50 },
  ml: { options: [250, 500], min: 250, step: 250 },
};
const QUICK = { kg: [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 5, 10], litre: [0.25, 0.5, 1, 1.5, 2, 3, 5], g: [50, 100, 200, 250, 500], ml: [100, 200, 250, 500, 750] };

const num = (v) => (v === '' || v == null ? '' : String(v));
const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export default function ItemFormScreen({ navigation, route }) {
  const { isOwner } = useAuth();
  const it = route.params?.item;
  // Opened from New purchase: the purchase adds the stock, and we go back to it with the new item chosen
  const forPurchase = !!route.params?.forPurchase;
  const cats = useLoad(() => api.adminCategories().then((r) => r.categories));
  const [f, setF] = useState({
    name: it?.name || '', description: it?.description || '', sku: it?.sku || route.params?.sku || '', category_id: it?.category_id || route.params?.category_id || 0,
    unit: it?.unit || 'pcs', price: num(it?.price), compare_price: it?.compare_price ? num(it.compare_price) : '',
    cost_price: it?.cost_price ? num(it.cost_price) : '', min_qty: num(it?.min_qty ?? 1), qty_step: num(it?.qty_step ?? 1),
    low_stock: it?.low_stock ? num(it.low_stock) : '', opening_stock: '', track_stock: it ? it.track_stock : true,
    featured: !!it?.featured, status: it?.status || 'active',
    // Discount on every sale: '' | 'percent' | 'fixed'
    discount_type: it?.discount_type || '', discount_value: it?.discount_value ? num(it.discount_value) : '',
  });
  const [options, setOptions] = useState(it?.qty_options ? it.qty_options.split(',').map(Number).filter((n) => n > 0) : []);
  const [images, setImages] = useState(it?.images || []);
  // Fast food: sizes with their own price (and cost); the item is then sold per piece
  const [sized, setSized] = useState(it?.sizes?.length > 0);
  const [sizes, setSizes] = useState((it?.sizes || []).map((z) => ({ name: z.name, price: num(z.price), cost: z.cost ? num(z.cost) : '' })));
  const setSize = (i, patch) => setSizes((cur) => cur.map((z, k) => (k === i ? { ...z, ...patch } : z)));
  const hasSize = (n) => sizes.some((z) => z.name.trim().toLowerCase() === n.toLowerCase());
  const toggleQuickSize = (n) => setSizes((cur) => (hasSize(n)
    ? cur.filter((z) => z.name.trim().toLowerCase() !== n.toLowerCase())
    : [...cur, { name: n, price: '', cost: '' }]));
  const turnSized = (on) => {
    setSized(on);
    if (on && !sizes.length) setSizes([{ name: 'S', price: '', cost: '' }, { name: 'M', price: '', cost: '' }, { name: 'L', price: '', cost: '' }]);
  };
  const sizesOk = sizes.length > 0 && sizes.every((z) => z.name.trim() && Number(z.price) > 0);
  const [branchId, setBranchId] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  // Scanning a barcode / QR anywhere on this form puts it in the SKU / barcode field
  const focused = useIsFocused();
  useBarcodeScanner((code) => {
    setF((x) => ({ ...x, sku: code }));
    Toast.show({ type: 'success', text1: 'Barcode added', text2: code, visibilityTime: 1500 });
  }, focused);

  const chooseUnit = (unit) => {
    const p = PRESETS[unit];
    setF((x) => ({ ...x, unit, min_qty: num(p ? p.min : 1), qty_step: num(p ? p.step : 1) }));
    setOptions(p ? p.options : []);
  };
  const toggleOption = (o) => setOptions((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o].sort((a, b) => a - b)));

  const addImage = async (camera) => {
    setUploading(true);
    try {
      const img = await pickAndUpload({ camera, title: f.name });
      if (img) setImages((cur) => [...cur, img].slice(0, 6));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not add the photo', text2: e.message });
    } finally {
      setUploading(false);
    }
  };
  const makeMain = (i) => setImages((cur) => [cur[i], ...cur.filter((_, k) => k !== i)]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveItem({
        ...f, id: it?.id, qty_options: sized ? '' : options.join(','), image_ids: images.map((im) => im.id),
        branch_id: branchId,
        sizes: sized ? sizes.map((z) => ({ name: z.name.trim(), price: z.price, cost: z.cost || 0 })) : [],
      });
      Toast.show({ type: 'success', text1: r.message });
      if (forPurchase) navigation.popTo('PurchaseForm', { newItemId: r.id, newItemCategory: f.category_id || 0 }, { merge: true });
      else navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message, visibilityTime: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const quick = QUICK[f.unit] || [1, 2, 3, 5, 6, 10, 12, 24];
  const unit = sized ? 'pcs' : f.unit;
  const unitWord = unit === 'pcs' ? 'pc' : unit;
  // The price after the item's discount (same as the server)
  const discounted = (price) => {
    const p = Number(price) || 0;
    const v = Number(f.discount_value) || 0;
    if (!f.discount_type || v <= 0) return p;
    return Math.max(0, Math.round((p - (f.discount_type === 'percent' ? p * Math.min(v, 100) / 100 : v)) * 100) / 100);
  };
  const lowestPrice = sized ? Math.min(...sizes.map((z) => Number(z.price) || Infinity)) : Number(f.price) || 0;
  const discountError = f.discount_type === 'percent' && Number(f.discount_value) > 100 ? 'At most 100%'
    : f.discount_type === 'fixed' && Number(f.discount_value) > 0 && Number(f.discount_value) >= lowestPrice ? 'Must be less than the price' : '';
  const canSave = !!f.name.trim() && (sized ? sizesOk : Number(f.price) > 0) && !discountError;

  return (
    <Screen title={it ? 'Edit item' : 'New item'} footer={<Footer><Button testID="item-save" title="Save item" onPress={save} loading={busy} disabled={!canSave} /></Footer>}>
      <SectionTitle>Photos</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {images.map((im, i) => (
          <View key={im.id}>
            <TouchableOpacity onPress={() => makeMain(i)}>
              <Image source={{ uri: im.thumb }} style={{ width: 92, height: 92, borderRadius: 12, borderWidth: i === 0 ? 2 : 0, borderColor: colors.primary }} />
            </TouchableOpacity>
            <TouchableOpacity style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 3 }}
              onPress={() => setImages((cur) => cur.filter((_, k) => k !== i))}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
            <Text style={[s.itemMeta, { textAlign: 'center' }]}>{i === 0 ? 'Main' : 'Tap: main'}</Text>
          </View>
        ))}
        {images.length < 6 && (
          <View style={{ gap: 6 }}>
            <TouchableOpacity style={photoBtn} onPress={() => addImage(false)} disabled={uploading} testID="add-photo">
              <Ionicons name={uploading ? 'hourglass-outline' : 'images-outline'} size={22} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{uploading ? 'Uploading…' : 'Gallery'}</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={[photoBtn, { height: 40 }]} onPress={() => addImage(true)} disabled={uploading}>
                <Ionicons name="camera-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="e.g. Basmati Rice" testID="item-name" />
      <SelectField label="Category" value={f.category_id} onChange={set('category_id')} placeholder="Choose category"
        options={[{ value: 0, label: 'No category' }, ...catOptions(cats.data || [])]} />
      <Card>
        <Row label="Fast food item (sizes)" value={sized} onChange={turnSized} hint="e.g. pizza, burger, shake: S, M, L… each with its own price" />
      </Card>

      {sized ? (
        <>
          <SectionTitle>Sizes and prices</SectionTitle>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {QUICK_SIZES.map((n) => <Chip key={n} label={n} active={hasSize(n)} onPress={() => toggleQuickSize(n)} />)}
            </View>
            {sizes.map((z, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Field style={{ flex: 1 }} label={i ? undefined : 'Size'} value={z.name} onChangeText={(v) => setSize(i, { name: v })} maxLength={30}
                  placeholder="e.g. Large" testID={`size-name-${i}`} />
                <Field style={{ flex: 1 }} label={i ? undefined : 'Price'} value={z.price} onChangeText={(v) => setSize(i, { price: v })} keyboardType="decimal-pad"
                  testID={`size-price-${i}`} error={z.name.trim() && z.price !== '' && !(Number(z.price) > 0) ? 'Invalid' : ''} />
                <Field style={{ flex: 1 }} label={i ? undefined : 'Cost (optional)'} value={z.cost} onChangeText={(v) => setSize(i, { cost: v })} keyboardType="decimal-pad" />
                <TouchableOpacity onPress={() => setSizes((cur) => cur.filter((_, k) => k !== i))} hitSlop={8}
                  style={{ paddingTop: i ? 12 : 34 }} testID={`size-remove-${i}`}>
                  <Ionicons name="close-circle" size={22} color={colors.faint} />
                </TouchableOpacity>
              </View>
            ))}
            {sizes.length < 12 && (
              <Button small variant="ghost" icon="add-circle-outline" title="Add another size" onPress={() => setSizes((cur) => [...cur, { name: '', price: '', cost: '' }])} />
            )}
            <Text style={[s.itemMeta, { marginTop: 6 }]}>
              Customers choose a size on the product page and see only that size's price. Cost is only for your profit report.
            </Text>
            {!sizesOk && <Text style={[s.itemMeta, { color: colors.danger }]}>Give every size a name and a price.</Text>}
          </Card>
        </>
      ) : (
      <>
      <SelectField label="Sold by (unit)" value={f.unit} onChange={chooseUnit} options={UNITS.map((u) => ({ value: u.value, label: u.label }))} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field style={{ flex: 1 }} label={`Price per ${unitWord}`} value={f.price} onChangeText={set('price')} keyboardType="decimal-pad" testID="item-price" />
        <Field style={{ flex: 1 }} label="Was (optional)" value={f.compare_price} onChangeText={set('compare_price')} keyboardType="decimal-pad" hint="Shows a discount" />
      </View>
      <Field label={`Cost per ${unitWord} (for profit)`} value={f.cost_price} onChangeText={set('cost_price')} keyboardType="decimal-pad" hint="Only staff see this" />

      <SectionTitle>Amounts customers can choose</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {quick.map((o) => <Chip key={o} label={qtyLabel(o, f.unit)} active={options.includes(o)} onPress={() => toggleOption(o)} />)}
        </View>
        <Text style={[s.itemMeta, { marginTop: 8 }]}>Ticked amounts show as quick buttons on the product page. Leave all off to show just − / +.</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Field style={{ flex: 1 }} label={`Minimum (${f.unit})`} value={f.min_qty} onChangeText={set('min_qty')} keyboardType="decimal-pad" />
          <Field style={{ flex: 1 }} label={`− / + step (${f.unit})`} value={f.qty_step} onChangeText={set('qty_step')} keyboardType="decimal-pad" />
        </View>
        <Text style={s.itemMeta}>e.g. Minimum 0.25 and step 0.25 kg → 250 g, 500 g, 750 g, 1 kg…</Text>
      </Card>
      </>
      )}

      {/* Discount every time it is sold (until removed): % or a fixed amount off the price (each size's price too) */}
      <SectionTitle>Discount</SectionTitle>
      <Card>
        <Segmented value={f.discount_type} onChange={(v) => setF((x) => ({ ...x, discount_type: v, discount_value: v ? x.discount_value : '' }))}
          options={[{ value: '', label: 'No discount' }, { value: 'percent', label: '% off' }, { value: 'fixed', label: 'Rs off' }]} />
        {!!f.discount_type && (
          <Field style={{ marginTop: 12, marginBottom: 6 }} label={f.discount_type === 'percent' ? 'Discount (%)' : `Discount (Rs per ${unitWord})`}
            value={f.discount_value} onChangeText={(v) => set('discount_value')(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"
            error={discountError} testID="item-discount" />
        )}
        <Text style={[s.itemMeta, { marginTop: 6 }]}>
          {!f.discount_type || !(Number(f.discount_value) > 0)
            ? 'Give this item a discount on every sale: customers and staff pay the lower price, and it shows as an offer.'
            : sized
              ? `Each size sells for ${sizes.filter((z) => Number(z.price) > 0).map((z) => `${z.name} ${money(discounted(z.price))}`).join(' · ') || '…'}`
              : `Sells at ${money(discounted(f.price))} per ${unitWord} instead of ${money(Number(f.price) || 0)}.`}
        </Text>
      </Card>

      <SectionTitle>Stock</SectionTitle>
      <Card>
        <Row label="Track stock" value={f.track_stock} onChange={set('track_stock')} hint="Off for items you always have" />
        {f.track_stock && (
          <>
            {sized && <Text style={[s.itemMeta, { marginBottom: 8 }]}>Stock counts pieces of any size together. Most shops turn this off for fast food.</Text>}
            <Field label={`Low stock alert at (${unit})`} value={f.low_stock} onChangeText={set('low_stock')} keyboardType="decimal-pad" />
            {!it && !forPurchase && (
              <>
                <BranchField value={branchId} onChange={setBranchId} label="Opening stock goes to" />
                <Field label={`Opening stock (${unit})`} value={f.opening_stock} onChangeText={set('opening_stock')} keyboardType="decimal-pad"
                  hint={isOwner ? 'Main branch unless you choose another' : undefined} testID="item-opening" />
              </>
            )}
          </>
        )}
      </Card>

      <Card>
        <Row label="On the menu (selling)" value={f.status === 'active'} onChange={(v) => set('status')(v ? 'active' : 'inactive')} hint="Off: stop selling for now. Hidden from customers and staff ordering; find it under Items → Hidden" />
        <Row label="Featured" value={f.featured} onChange={set('featured')} hint="Shown first on the home page" />
      </Card>

      <Field label="Description (optional)" value={f.description} onChangeText={set('description')} multiline />
      <Field label="SKU / barcode (optional)" value={f.sku} onChangeText={set('sku')} autoCapitalize="none"
        hint={Platform.OS === 'web' ? 'Scan the barcode / QR with the scanner to fill this in.' : undefined} />
    </Screen>
  );
}

const photoBtn = {
  width: 92, height: 92, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary,
  alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primarySoft,
};

function Row({ label, value, onChange, hint }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>{label}</Text>
        {!!hint && <Text style={s.itemMeta}>{hint}</Text>}
      </View>
      <Switch value={!!value} onValueChange={onChange} />
    </View>
  );
}

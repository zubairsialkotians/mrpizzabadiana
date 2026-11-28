import React, { useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Field, s } from './ui';
import { useCart } from './CartContext';
import { money } from '../services/format';
import { colors } from '../theme';

/*
  "Custom item" (staff): something not in the menu, e.g. an item someone forgot to add.
  Type the name and price (quantity 1 unless changed); it goes into the order like any item, with no stock.
  Works on useCart(): the cart, or the order being changed.
*/
export function CustomItemButton({ style, small = true, title = 'Custom item' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button small={small} variant="outline" icon="create-outline" title={title} onPress={() => setOpen(true)} style={style} testID="custom-item" />
      <CustomItemForm visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CustomItemForm({ visible, onClose }) {
  const cart = useCart();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [err, setErr] = useState('');
  const priceRef = useRef(null);
  const qtyRef = useRef(null);

  const close = () => { setName(''); setPrice(''); setQty('1'); setErr(''); onClose(); };
  const add = () => {
    const n = name.trim();
    const p = Number(String(price).replace(/,/g, ''));
    const q = Number(qty) || 0;
    if (!n) { setErr('Enter the item name'); return; }
    if (!(p >= 0) || String(price).trim() === '') { setErr('Enter the price'); return; }
    if (q <= 0) { setErr('Enter the quantity'); return; }
    cart.addCustom({ name: n, price: p, qty: q });
    Toast.show({ type: 'success', text1: `${n} added`, text2: `${q} × ${money(p)}`, visibilityTime: 1500 });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={st.back}>
        <View style={st.card}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Custom item</Text>
            <TouchableOpacity onPress={close} hitSlop={10}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>
          <Text style={[s.itemMeta, { marginBottom: 12 }]}>For something not in the menu. It is added to this order only; stock is not changed.</Text>
          <Field label="Item name" value={name} onChangeText={(v) => { setName(v); setErr(''); }} placeholder="e.g. Extra raita" autoFocus
            returnKeyType="next" onSubmitEditing={() => priceRef.current?.focus()} blurOnSubmit={false} testID="custom-name" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field ref={priceRef} label="Price" value={price} onChangeText={(v) => { setPrice(v.replace(/[^0-9.]/g, '')); setErr(''); }} placeholder="0"
              keyboardType="decimal-pad" style={{ flex: 2 }} returnKeyType="done" onSubmitEditing={add} testID="custom-price" />
            <Field ref={qtyRef} label="Qty" value={qty} onChangeText={(v) => { setQty(v.replace(/[^0-9.]/g, '')); setErr(''); }}
              keyboardType="decimal-pad" style={{ flex: 1 }} returnKeyType="done" onSubmitEditing={add} testID="custom-qty" />
          </View>
          {!!err && <Text style={{ color: colors.danger, marginBottom: 8, fontWeight: '700' }}>{err}</Text>}
          <Button title={Number(price) > 0 ? `Add · ${money((Number(price) || 0) * (Number(qty) || 0))}` : 'Add to order'} icon="add" onPress={add} testID="custom-add" />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(12,35,22,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 22, padding: 18 },
});

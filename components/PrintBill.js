import React, { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { Card, Button, Segmented, s } from './ui';
import { useAuth } from './AuthContext';
import { getPrinter, savePrinter, printBill, openRawbtStore, PAPERS, paperLabel } from '../services/printer';
import { colors } from '../theme';

// print(order): prints the bill on this device's printer, with a clear message when it can't
export function usePrintBill() {
  const { shop } = useAuth();
  const [busy, setBusy] = useState(false);
  const print = async (order) => {
    if (!order) return;
    setBusy(true);
    try {
      await printBill(order, shop);
    } catch (e) {
      Toast.show({
        type: 'error', text1: 'Could not print the bill', text2: e.message, visibilityTime: 7000,
        onPress: e.store ? openRawbtStore : undefined,
      });
    } finally {
      setBusy(false);
    }
  };
  return { print, busy };
}

export function PrintBillButton({ order, small, style, variant = 'primary', title = 'Print bill' }) {
  const { print, busy } = usePrintBill();
  return <Button testID="print-bill" small={small} variant={variant} icon="print-outline" title={title} loading={busy} onPress={() => print(order)} style={style} />;
}

// A made-up order to check the printer
const SAMPLE = {
  order_no: 'TEST-001', created_at: new Date().toISOString().slice(0, 19).replace('T', ' '), status: 'confirmed', fulfilment: 'pickup',
  name: 'Test print', phone: '', address: '', note: '', payment_method: 'cod', payment_status: '',
  items: [{ name: 'Sample item', size: '', unit: 'piece', qty: 2, price: 250, line_total: 500 }],
  subtotal: 500, delivery_fee: 0, discount: 0, tax: 0, service: 0, total: 500, refunded: 0,
};

// My account: which printer this phone / tablet uses
export function PrinterCard() {
  const { shop } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPrinter().then(setCfg); }, []);
  if (!cfg) return null;
  const update = async (patch) => setCfg(await savePrinter({ ...cfg, ...patch }));
  const test = async () => {
    setBusy(true);
    try {
      await printBill({ ...SAMPLE, branch_name: shop?.name || '' }, shop, cfg);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not print', text2: e.message, visibilityTime: 7000, onPress: e.store ? openRawbtStore : undefined });
    } finally {
      setBusy(false);
    }
  };
  const android = Platform.OS === 'android';
  const rawbt = cfg.method === 'rawbt' && android;
  // Thermal printers print rolls only
  const papers = rawbt ? PAPERS.filter((p) => p !== 'a4') : PAPERS;
  const paper = rawbt && cfg.paper === 'a4' ? 80 : cfg.paper;
  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>Print with</Text>
      <Segmented value={android ? cfg.method : 'system'} onChange={(v) => update({ method: v, ...(v === 'rawbt' && cfg.paper === 'a4' ? { paper: 80 } : {}) })}
        options={[{ value: 'system', label: Platform.OS === 'web' ? 'Browser printing' : 'Phone printing' }, ...(android ? [{ value: 'rawbt', label: 'Bluetooth printer' }] : [])]} />
      <Text style={[s.itemMeta, { marginTop: 8 }]}>
        {cfg.method === 'rawbt' && android
          ? 'For Bluetooth / USB thermal receipt printers. Install the free RawBT app, pair your printer in it once, then bills print straight away without a dialog.'
          : Platform.OS === 'web'
            ? 'Opens the browser\'s print window with the bill. It lists the printers connected to this computer (USB, Wi-Fi, network, Bluetooth). If none shows, connect and add the printer in Windows / macOS settings first; Save as PDF is always there.'
            : 'Opens the phone\'s print screen: choose a Wi-Fi / network printer, a printer app (HP, Epson, Mopria, RawBT…) or Save as PDF.'}
      </Text>
      {cfg.method === 'rawbt' && android && (
        <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 6 }} onPress={openRawbtStore}>Get RawBT on Google Play →</Text>
      )}
      <Text style={{ fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 }}>Paper</Text>
      <Segmented value={paper} onChange={(v) => update({ paper: v })} options={papers.map((p) => ({ value: p, label: paperLabel(p) }))} />
      <Text style={[s.itemMeta, { marginTop: 6 }]}>
        {paper === 'a4' ? 'The full bill with your logo, same as the Bill screen. For normal office printers.' : `A receipt sized for a ${paper} mm thermal roll.`}
      </Text>
      <Text style={{ fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 }}>Copies</Text>
      <Segmented value={cfg.copies} onChange={(v) => update({ copies: v })} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
      <View style={{ marginTop: 14 }}>
        <Button testID="printer-test" title="Print a test bill" icon="print-outline" variant="outline" loading={busy} onPress={test} />
      </View>
      <Text style={[s.itemMeta, { marginTop: 8 }]}>
        {shop?.bill_print === 'manual' ? 'Bills print when you press Print bill on an order (Shop settings).' : 'Bills print by themselves when a staff order is placed, and with Print bill on any order (Shop settings).'}
      </Text>
    </Card>
  );
}

import React, { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { Card, Button, Segmented, s } from './ui';
import { useAuth } from './AuthContext';
import { getPrinter, savePrinter, printBill, openRawbtStore, desktopBridge, PAPERS, paperLabel, PRINT_WIDTHS, printWidth, PRINT_COLS, printCols } from '../services/printer';
import { Chip } from './ui';
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
  // Desktop app: the computer's printers
  const desk = desktopBridge();
  const [printers, setPrinters] = useState(null);
  const loadPrinters = () => desk?.printers().then((l) => setPrinters(l || [])).catch(() => setPrinters([]));
  useEffect(() => { loadPrinters(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
        options={[{ value: 'system', label: Platform.OS === 'web' ? (desk ? 'Computer printer' : 'Browser printing') : 'Phone printing' }, ...(android ? [{ value: 'rawbt', label: 'Bluetooth printer' }] : [])]} />
      <Text style={[s.itemMeta, { marginTop: 8 }]}>
        {cfg.method === 'rawbt' && android
          ? 'For Bluetooth / USB thermal receipt printers. Install the free RawBT app, pair your printer in it once, then bills print straight away without a dialog.'
          : desk
            ? 'Prints on the printers set up on this computer (USB, network, Wi-Fi, receipt printers). Choose the printer below once.'
            : Platform.OS === 'web'
            ? 'Opens the browser\'s print window with the bill. It lists the printers connected to this computer (USB, Wi-Fi, network, Bluetooth). If none shows, connect and add the printer in Windows / macOS settings first; Save as PDF is always there.'
            : 'Opens the phone\'s print screen: choose a Wi-Fi / network printer, a printer app (HP, Epson, Mopria, RawBT…) or Save as PDF.'}
      </Text>
      {cfg.method === 'rawbt' && android && (
        <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 6 }} onPress={openRawbtStore}>Get RawBT on Google Play →</Text>
      )}
      {!!desk && (
        <>
          <Text style={{ fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 }}>Printer</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Ask every time" active={!cfg.device} onPress={() => update({ device: '' })} />
            {(printers || []).map((pr) => (
              <Chip key={pr.name} label={`${pr.displayName || pr.name}${pr.isDefault ? ' (default)' : ''}`} active={cfg.device === pr.name} onPress={() => update({ device: pr.name })} />
            ))}
          </View>
          <Text style={[s.itemMeta, { marginTop: 6 }]}>
            {printers && !printers.length ? 'No printers found on this computer. Add the printer in Windows settings, then press Refresh. '
              : cfg.device ? `Bills print straight to ${cfg.device}, with no print window. ` : 'The print window opens for each bill. Choose a printer to print bills straight away. '}
            <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={loadPrinters}>Refresh</Text>
          </Text>
        </>
      )}
      <Text style={{ fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 }}>Paper</Text>
      <Segmented value={paper} onChange={(v) => update({ paper: v })} options={papers.map((p) => ({ value: p, label: paperLabel(p) }))} />
      <Text style={[s.itemMeta, { marginTop: 6 }]}>
        {paper === 'a4' ? 'The full bill with your logo, same as the Bill screen. For normal office printers.' : `A receipt sized for a ${paper} mm thermal roll.`}
      </Text>
      {paper !== 'a4' && !rawbt && (
        <>
          <Text style={{ fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 }}>Print width</Text>
          <Segmented value={printWidth({ ...cfg, paper })} onChange={(v) => update({ width: v })}
            options={PRINT_WIDTHS[paper].map((w, i) => ({ value: w, label: `${w} mm${i === 0 ? ' (usual)' : ''}` }))} />
          <Text style={[s.itemMeta, { marginTop: 6 }]}>
            {`Receipt printers can't print to the edge of the roll. If the bill is cut on the right, choose a smaller width; if there is empty space on the right, choose a bigger one. Print a test bill to check.`}
          </Text>
        </>
      )}
      {paper !== 'a4' && rawbt && (
        <>
          <Text style={{ fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 }}>Characters per line</Text>
          <Segmented value={printCols({ ...cfg, paper })} onChange={(v) => update({ cols: v })}
            options={PRINT_COLS[paper].map((c, i) => ({ value: c, label: `${c}${i === 0 ? ' (usual)' : ''}` }))} />
          <Text style={[s.itemMeta, { marginTop: 6 }]}>If the bill is cut on the right, choose the smaller number. Print a test bill to check.</Text>
        </>
      )}
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

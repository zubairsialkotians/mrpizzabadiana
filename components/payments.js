import React, { useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Field, s } from './ui';
import { money, niceDate, cashLabel, paymentLabel } from '../services/format';

export { cashLabel, paymentLabel };
import { colors } from '../theme';

// Kinds of account the owner can add in Shop settings
export const PAY_TYPES = {
  easypaisa: { label: 'Easypaisa', icon: 'phone-portrait-outline' },
  jazzcash: { label: 'JazzCash', icon: 'phone-portrait-outline' },
  bank: { label: 'Bank transfer', icon: 'business-outline' },
  other: { label: 'Other', icon: 'wallet-outline' },
};

const STATUS = {
  awaiting: { label: 'Screenshot needed', fg: colors.warning, bg: colors.warningSoft },
  submitted: { label: 'Checking payment', fg: '#1d4ed8', bg: '#e8eefc' },
  verified: { label: 'Paid', fg: colors.success, bg: colors.successSoft },
  rejected: { label: 'Not accepted', fg: colors.danger, bg: colors.dangerSoft },
};

export function PayStatus({ status }) {
  const c = STATUS[status];
  if (!c) return null;
  return (
    <View style={[st.pill, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontWeight: '800', fontSize: 11 }}>{c.label}</Text>
    </View>
  );
}

// Account the customer sends money to (checkout + order page)
export function AccountBox({ title, number, note, amount }) {
  return (
    <View style={st.account}>
      {amount != null && <Text style={st.accountHint}>Send {money(amount)} to</Text>}
      {!!title && <Text style={st.accountTitle}>{title}</Text>}
      <Text style={st.accountNumber} selectable>{number}</Text>
      {!!note && <Text style={s.itemMeta}>{note}</Text>}
    </View>
  );
}

// Full-screen view of a screenshot
export function ProofViewer({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.viewer} activeOpacity={1} onPress={onClose}>
        {!!uri && <Image source={{ uri }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />}
        <Text style={{ color: '#fff', marginTop: 12 }}>Tap to close</Text>
      </TouchableOpacity>
    </Modal>
  );
}

/*
  Payment on an order page.
  customer: where to pay + send / replace the screenshot (onSend)
  staff: screenshot + Verify / Not accepted (onVerify, onReject(reason))
*/
export function PaymentCard({ order: o, staff, onSend, sending, onVerify, onReject, busy }) {
  const [view, setView] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!o.payment_method || o.payment_method === 'cod') {
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="cash-outline" size={20} color={colors.primary} />
        <Text style={{ fontWeight: '700', color: colors.text }}>{cashLabel(o.fulfilment)}</Text>
      </Card>
    );
  }

  const [title, number, ...rest] = (o.payment_account || '').split(' · ');
  const cancelled = o.status === 'cancelled';
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="wallet-outline" size={20} color={colors.primary} />
        <Text style={{ flex: 1, fontWeight: '800', color: colors.text }}>{o.payment_name}</Text>
        {!cancelled && <PayStatus status={o.payment_status} />}
      </View>

      {!staff && o.payment_status !== 'verified' && !cancelled && !!o.payment_account && (
        <AccountBox title={number ? title : ''} number={number || title} note={rest.join(' · ')} amount={o.total} />
      )}
      {staff && !!o.payment_account && <Text style={s.itemMeta}>To: {o.payment_account}</Text>}

      {o.payment_status === 'rejected' && !!o.payment_note && (
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Not accepted: {o.payment_note}</Text>
      )}
      {!staff && o.payment_status === 'awaiting' && !cancelled && (
        <Text style={s.itemMeta}>After sending the money, add a screenshot of the payment so the shop can check it.</Text>
      )}
      {!staff && o.payment_status === 'submitted' && <Text style={s.itemMeta}>The shop will check your payment soon.</Text>}

      {o.payment_proof ? (
        <TouchableOpacity onPress={() => setView(o.payment_proof.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="proof-thumb">
          <Image source={{ uri: o.payment_proof.thumb }} style={st.thumb} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>Payment screenshot</Text>
            <Text style={s.itemMeta}>{o.payment_at ? `Sent ${niceDate(o.payment_at)} · ` : ''}tap to view</Text>
          </View>
        </TouchableOpacity>
      ) : staff ? <Text style={s.itemMeta}>No screenshot yet.</Text> : null}

      {!staff && o.can_send_proof && onSend && (
        <Button small variant={o.payment_proof ? 'outline' : 'primary'} icon="image-outline" loading={sending} onPress={onSend} testID="send-proof"
          title={o.payment_proof ? 'Send a new screenshot' : 'Add payment screenshot'} />
      )}

      {/* Verified: done. The small link only undoes a mistake (e.g. the money never actually arrived). */}
      {staff && !cancelled && o.payment_status === 'verified' && (
        <View style={st.verified}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={{ flex: 1, color: colors.success, fontWeight: '700' }}>You marked this payment as received</Text>
          <Text style={st.undo} onPress={() => setRejectOpen(true)} testID="pay-undo">Undo</Text>
        </View>
      )}

      {staff && !cancelled && o.payment_status !== 'verified' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="success" icon="checkmark-circle-outline" title="Payment received" loading={busy === 'verified'}
            onPress={onVerify} style={{ flex: 1 }} testID="pay-verify" />
          {o.payment_status === 'submitted' && (
            <Button small variant="outline" icon="close-circle-outline" title="Not accepted" onPress={() => setRejectOpen(true)} style={{ flex: 1 }} testID="pay-reject" />
          )}
        </View>
      )}

      <ProofViewer uri={view} onClose={() => setView(null)} />
      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={[s.modalBack, { justifyContent: 'center', padding: 24 }]}>
          <View style={[s.card, { padding: 18 }]}>
            <Text style={[s.sheetTitle, { marginBottom: 8 }]}>Payment not accepted?</Text>
            <Text style={{ color: colors.muted, marginBottom: 10 }}>The customer is notified and can send a new screenshot.</Text>
            <Field label="Reason (sent to the customer)" value={reason} onChangeText={setReason} placeholder="e.g. Amount not received yet" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Back" variant="outline" onPress={() => setRejectOpen(false)} style={{ flex: 1 }} />
              <Button title="Send" variant="danger" disabled={!reason.trim()} loading={busy === 'rejected'}
                onPress={async () => { if (await onReject(reason.trim())) { setRejectOpen(false); setReason(''); } }} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Card>
  );
}

const st = StyleSheet.create({
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  account: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, gap: 2 },
  accountHint: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
  accountTitle: { color: colors.text, fontWeight: '700' },
  accountNumber: { color: colors.primaryDark, fontWeight: '800', fontSize: 18, letterSpacing: 0.5 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.background },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successSoft, borderRadius: 10, padding: 10 },
  undo: { color: colors.muted, fontWeight: '700', textDecorationLine: 'underline', paddingHorizontal: 4 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 16 },
});

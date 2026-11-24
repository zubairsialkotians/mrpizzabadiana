import React, { useCallback, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Button, Empty, ErrorBox, s } from './ui';
import { api } from '../services/api';
import { confirmAction } from '../services/confirm';
import { colors } from '../theme';

// Bottom sheet listing the riders who can take an order (least busy first)
export function RiderPicker({ order, onClose, onPick }) {
  const insets = useSafeAreaInsets();
  const [riders, setRiders] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setRiders(null);
    setError(null);
    api.riders(order.id).then((r) => setRiders(r.riders)).catch((e) => setError(e.message));
  }, [order?.id]);

  return (
    <Modal visible={!!order} animationType="slide" transparent onRequestClose={onClose} onShow={load}>
      <KeyboardAvoidingView behavior="padding" style={s.modalBack}>
        <View style={[s.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Give {order?.order_no} to a rider</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          {error ? <ErrorBox message={error} onRetry={load} /> : !riders ? <ActivityIndicator color={colors.primary} style={{ margin: 24 }} /> : (
            <FlatList
              data={riders}
              keyExtractor={(r) => String(r.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.option} onPress={() => onPick(item)} testID={`rider-${item.id}`}>
                  <Ionicons name="bicycle-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionText}>{item.name}</Text>
                    <Text style={s.itemMeta}>
                      {[item.phone, item.busy ? `${item.busy} on the way now` : 'Free'].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {order?.rider_id === item.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Empty icon="bicycle-outline" text="No active riders for this branch. The owner adds them in Staff logins." />}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/*
  Kitchen / rider / admin actions on an order. onDone(order) gets the updated order from the server.
  Renders buttons from order.can: { ready, assign, accept, deliver }. Include {picker} once on the screen.
*/
export function useTeamActions(onDone) {
  const [busy, setBusy] = useState('');
  const [assigning, setAssigning] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      const r = await fn();
      Toast.show({ type: 'success', text1: r.message });
      onDone?.(r.order);
      return true;
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not update the order', text2: e.message, visibilityTime: 7000 });
      onDone?.(null);
      return false;
    } finally {
      setBusy('');
    }
  };

  const ready = (o) => run(`ready-${o.id}`, () => api.markReady(o.id));
  const accept = (o) => run(`accept-${o.id}`, () => api.acceptOrder(o.id));
  const deliver = async (o) => {
    const cash = o.payment_method === 'cod' || o.payment_status !== 'verified';
    if (await confirmAction(`Delivered ${o.order_no}?`, cash ? `Collect the payment from ${o.name} before you confirm.` : `${o.name} has already paid.`, 'Delivered')) {
      run(`deliver-${o.id}`, () => api.markDelivered(o.id));
    }
  };
  const pick = (rider) => {
    const o = assigning;
    setAssigning(null);
    run(`assign-${o.id}`, () => api.assignRider(o.id, rider.id));
  };

  const buttons = (o, { small } = {}) => {
    const can = o.can || {};
    const list = [];
    const b = (key, title, onPress, variant, icon) => (
      <Button key={key} testID={`team-${key}-${o.id}`} small={small} title={title} variant={variant} icon={icon}
        loading={busy === `${key}-${o.id}`} onPress={onPress} style={{ flex: 1 }} />
    );
    if (can.ready) list.push(b('ready', o.fulfilment === 'pickup' ? 'Ready for pickup' : 'Ready for delivery', () => ready(o), 'success', 'checkmark-circle-outline'));
    if (can.assign) list.push(b('assign', o.rider_id ? 'Change rider' : 'Give to rider', () => setAssigning(o), 'outline', 'bicycle-outline'));
    if (can.accept) list.push(b('accept', 'Accept delivery', () => accept(o), 'success', 'bicycle-outline'));
    if (can.deliver) list.push(b('deliver', 'Delivered', () => deliver(o), 'success', 'checkmark-done-outline'));
    return list.length ? <View style={{ flexDirection: 'row', gap: 8 }}>{list}</View> : null;
  };

  const picker = <RiderPicker order={assigning} onClose={() => setAssigning(null)} onPick={pick} />;
  return { busy, buttons, picker, openAssign: setAssigning };
}

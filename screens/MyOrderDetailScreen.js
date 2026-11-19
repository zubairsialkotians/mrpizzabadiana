import React, { useState } from 'react';
import { Text, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Card, Loading, ErrorBox, SectionTitle, Button, Footer, s } from '../components/ui';
import { OrderProgress, OrderItems, OrderTotals, StatusBadge } from '../components/orders';
import { PaymentCard } from '../components/payments';
import { pickImage } from '../services/images';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { confirmAction } from '../services/confirm';
import { niceDate } from '../services/format';
import { colors } from '../theme';

// Logged-in customer (params.id) or a guest's saved order (params.id + params.key)
export default function MyOrderDetailScreen({ navigation, route }) {
  const { id, key } = route.params;
  const { shop } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const { data: o, loading, error, reload, refresh, refreshing, setData } = useLoad(
    () => (key ? api.trackOrder(id, key) : api.myOrder(id)).then((r) => r.order), [id, key],
  );

  const cancel = async () => {
    if (!(await confirmAction('Cancel this order?', 'The shop will be told straight away.', 'Cancel order', true))) return;
    setBusy(true);
    try {
      const r = await api.cancelMyOrder(o.id);
      setData(r.order);
      Toast.show({ type: 'success', text1: r.message });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not cancel', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  const sendProof = async () => {
    try {
      const img = await pickImage({ maxWidth: 1400 });
      if (!img) return;
      setSending(true);
      const r = await api.sendPaymentProof(o.id, img.base64, key);
      setData(r.order);
      Toast.show({ type: 'success', text1: r.message });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not send the screenshot', text2: e.message });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Screen title="Order"><Loading /></Screen>;
  if (error) return <Screen title="Order"><ErrorBox message={error} onRetry={reload} /></Screen>;

  return (
    <Screen
      title={o.order_no}
      subtitle={niceDate(o.created_at)}
      right={<StatusBadge status={o.status} />}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={o.can_cancel && !key ? <Footer><Button title="Cancel order" variant="outline" onPress={cancel} loading={busy} /></Footer> : null}
    >
      <OrderProgress order={o} />
      <SectionTitle>Payment</SectionTitle>
      <PaymentCard order={o} onSend={sendProof} sending={sending} />
      <SectionTitle>{o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</SectionTitle>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>{o.name} · {o.phone}</Text>
        {o.fulfilment === 'pickup'
          ? <Text style={s.itemSub}>Pick up from {o.branch_name}{o.branch_address ? `, ${o.branch_address}` : ''}</Text>
          : <Text style={s.itemSub}>{o.address}</Text>}
        {!!o.note && <Text style={[s.itemMeta, { marginTop: 4 }]}>Note: {o.note}</Text>}
      </Card>
      <SectionTitle>Items</SectionTitle>
      <OrderItems order={o} />
      <OrderTotals order={o} />
      <Button testID="my-bill" title="View bill · save or share" icon="receipt-outline" variant="ghost"
        onPress={() => navigation.navigate('Bill', { id: o.id, key })} style={{ marginBottom: 10 }} />
      {!!shop?.phone && (
        <Button title="Call the shop about this order" variant="ghost" icon="call-outline" onPress={() => Linking.openURL(`tel:${shop.phone}`)} />
      )}
    </Screen>
  );
}

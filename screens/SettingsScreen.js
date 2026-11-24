import React, { useEffect, useState } from 'react';
import { View, Text, Image, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, SectionTitle, Card, Loading, ErrorBox, Chip, ChipRow, Segmented, s } from '../components/ui';
import { PAY_TYPES } from '../components/payments';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { pickAndUpload } from '../services/images';
import { colors } from '../theme';

// Owner: what customers see (logo, contact, notice), delivery rules, open/closed, bill caption
export default function SettingsScreen({ navigation }) {
  const { setShop } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api.settings().then((r) => r.settings));
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !f) {
      setF({
        ...data,
        about: data.about || '', email: data.email || '', hours: data.hours || '', map_url: data.map_url || '',
        website: data.website || '', facebook: data.facebook || '', instagram: data.instagram || '',
        cod: data.cod !== false, pay_accounts: data.pay_accounts || [],
        delivery_fee: String(data.delivery_fee || ''), free_delivery_over: String(data.free_delivery_over || ''), min_order: String(data.min_order || ''),
        tax_type: data.tax_type || '', tax_value: data.tax_value ? String(data.tax_value) : '',
        bill_print: data.bill_print === 'manual' ? 'manual' : 'auto',
        qr_url: data.qr_url || '', qr_label: data.qr_label || '',
        service_type: data.service_type || '', service_value: data.service_value ? String(data.service_value) : '',
      });
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  if (loading || !f) return <Screen title="Shop settings">{error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />}</Screen>;

  const pickLogo = async () => {
    try {
      const img = await pickAndUpload({ square: true, maxWidth: 600, title: 'Logo' });
      if (img) setF((x) => ({ ...x, logo_id: img.id, logo_url: img.url }));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not add the logo', text2: e.message });
    }
  };

  // Payment accounts (Easypaisa, JazzCash, bank…) edited in place; the server gives new ones their key
  const setAcc = (i, patch) => setF((x) => ({ ...x, pay_accounts: x.pay_accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const addAcc = () => setF((x) => ({ ...x, pay_accounts: [...x.pay_accounts, { type: 'easypaisa', name: 'Easypaisa', title: '', number: '', note: '' }] }));
  const removeAcc = (i) => setF((x) => ({ ...x, pay_accounts: x.pay_accounts.filter((_, j) => j !== i) }));
  const pickType = (i, a, type) => setAcc(i, {
    type, name: !a.name || a.name === PAY_TYPES[a.type]?.label ? PAY_TYPES[type].label : a.name,
  });

  const save = async () => {
    setBusy(true);
    try {
      const keys = ['phone', 'whatsapp', 'address', 'notice', 'delivery_fee', 'free_delivery_over', 'min_order', 'pickup', 'is_open', 'closed_message', 'order_prefix', 'bill_caption', 'logo_id',
        'about', 'email', 'hours', 'map_url', 'website', 'facebook', 'instagram', 'cod', 'pay_accounts',
        'tax_type', 'tax_value', 'service_type', 'service_value', 'bill_print', 'qr_url', 'qr_label'];
      const r = await api.saveSettings(Object.fromEntries(keys.map((k) => [k, typeof f[k] === 'boolean' ? (f[k] ? 1 : 0) : f[k]])));
      setShop(r.shop);
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Shop settings" subtitle={f.name} footer={<Footer><Button testID="settings-save" title="Save settings" onPress={save} loading={busy} /></Footer>}>
      <Card style={{ backgroundColor: f.is_open ? colors.successSoft : colors.dangerSoft, borderColor: 'transparent' }}>
        <Toggle label={f.is_open ? 'Shop is open for orders' : 'Shop is closed'} value={f.is_open} onChange={set('is_open')}
          hint={f.is_open ? 'Turn off to stop new orders (e.g. at night)' : 'Customers can browse but not order'} />
        {!f.is_open && <Field label="Message to customers" value={f.closed_message} onChangeText={set('closed_message')} placeholder="We open at 9 am" style={{ marginTop: 8, marginBottom: 0 }} />}
      </Card>

      <SectionTitle>Logo</SectionTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {f.logo_url ? <Image source={{ uri: f.logo_url }} style={{ width: 72, height: 72, borderRadius: 12 }} resizeMode="contain" />
          : <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><Text style={s.itemMeta}>No logo</Text></View>}
        <View style={{ flex: 1, gap: 8 }}>
          <Button small variant="ghost" icon="image-outline" title={f.logo_url ? 'Change logo' : 'Add logo'} onPress={pickLogo} />
          {!!f.logo_url && <Button small variant="outline" title="Remove" onPress={() => setF((x) => ({ ...x, logo_id: 0, logo_url: '' }))} />}
        </View>
      </Card>

      <SectionTitle>Contact</SectionTitle>
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="WhatsApp number" value={f.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" hint="Leave empty to use the phone" />
      <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="shop@example.com" />
      <Field label="Shop address" value={f.address} onChangeText={set('address')} hint="Shown for pickup orders and on the About page" />
      <Field label="Google Maps link" value={f.map_url} onChangeText={set('map_url')} autoCapitalize="none" keyboardType="url"
        placeholder="https://maps.app.goo.gl/…" hint="Optional. Without it, the map searches for the address" />
      <Field label="Notice on home page" value={f.notice} onChangeText={set('notice')} placeholder="e.g. Fresh mangoes arrived!" />

      <SectionTitle>About page</SectionTitle>
      <Text style={[s.itemMeta, { marginBottom: 10 }]}>Customers open it from the ⓘ icon on the shop's home page. It also shows the contact details above.</Text>
      <Field label="About the shop" value={f.about} onChangeText={set('about')} multiline maxLength={3000} inputStyle={{ height: 120 }}
        placeholder="Who you are, what you sell, since when…" testID="set-about" />
      <Field label="Opening hours" value={f.hours} onChangeText={set('hours')} multiline maxLength={500} inputStyle={{ height: 80 }}
        placeholder={'Mon–Sat: 9 am – 10 pm\nSunday: 12 pm – 8 pm'} />
      <Field label="Website" value={f.website} onChangeText={set('website')} autoCapitalize="none" keyboardType="url" placeholder="www.example.com" />
      <Field label="Facebook page" value={f.facebook} onChangeText={set('facebook')} autoCapitalize="none" keyboardType="url" placeholder="facebook.com/yourshop" />
      <Field label="Instagram" value={f.instagram} onChangeText={set('instagram')} autoCapitalize="none" keyboardType="url" placeholder="instagram.com/yourshop" />

      <SectionTitle>Payment methods</SectionTitle>
      <Card>
        <Toggle label="Cash on delivery / at pickup" value={f.cod} onChange={set('cod')}
          hint={f.cod ? 'Customers can pay cash' : 'Customers must pay into one of the accounts below'} />
      </Card>
      <Text style={[s.itemMeta, { marginBottom: 10 }]}>
        Accounts customers can send money to. At checkout they choose one, see the number, and add a payment screenshot. You check it on the order page.
      </Text>
      {f.pay_accounts.map((a, i) => (
        <Card key={a.key || `new-${i}`} style={{ gap: 4 }}>
          <ChipRow style={{ marginBottom: 8 }}>
            {Object.entries(PAY_TYPES).map(([t, m]) => <Chip key={t} label={m.label} active={a.type === t} onPress={() => pickType(i, a, t)} />)}
          </ChipRow>
          <Field label="Name customers see" value={a.name} onChangeText={(v) => setAcc(i, { name: v })} maxLength={60} placeholder="e.g. Easypaisa" />
          <Field label="Account title" value={a.title} onChangeText={(v) => setAcc(i, { title: v })} maxLength={100} placeholder="e.g. Muhammad Ali" />
          <Field label={a.type === 'bank' ? 'Account number / IBAN' : 'Account / mobile number'} value={a.number} onChangeText={(v) => setAcc(i, { number: v })}
            maxLength={60} keyboardType={a.type === 'bank' ? 'default' : 'phone-pad'} autoCapitalize="characters" testID={`acc-number-${i}`} />
          <Field label="Note (optional)" value={a.note} onChangeText={(v) => setAcc(i, { note: v })} maxLength={191}
            placeholder={a.type === 'bank' ? 'e.g. Meezan Bank, Sialkot branch' : 'e.g. Send the screenshot after paying'} />
          <Button small variant="outline" title="Remove this account" onPress={() => removeAcc(i)} />
        </Card>
      ))}
      {f.pay_accounts.length < 10 && (
        <Button variant="ghost" icon="add-circle-outline" title="Add payment account" onPress={addAcc} style={{ marginBottom: 14 }} testID="add-pay-account" />
      )}
      {!f.cod && !f.pay_accounts.length && (
        <Text style={[s.itemMeta, { color: colors.danger, marginBottom: 10 }]}>Add an account or turn cash on — customers need a way to pay.</Text>
      )}

      <SectionTitle>Delivery</SectionTitle>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field style={{ flex: 1 }} label="Delivery charge" value={f.delivery_fee} onChangeText={set('delivery_fee')} keyboardType="decimal-pad" testID="set-fee" />
        <Field style={{ flex: 1 }} label="Free delivery over" value={f.free_delivery_over} onChangeText={set('free_delivery_over')} keyboardType="decimal-pad" hint="0 = never free" />
      </View>
      <Field label="Minimum order amount" value={f.min_order} onChangeText={set('min_order')} keyboardType="decimal-pad" hint="0 = no minimum" />
      <Card><Toggle label="Allow pickup from shop" value={f.pickup} onChange={set('pickup')} hint="No delivery charge for pickup" /></Card>

      <SectionTitle>Tax & service charge</SectionTitle>
      <Text style={[s.itemMeta, { marginBottom: 10 }]}>
        Added to every order: customers' orders and orders taken by staff (staff can change it on the order). Worked out on items + delivery, after any discount. None by default.
      </Text>
      <ChargeField title="Tax" k="tax" f={f} set={set} />
      <ChargeField title="Service charge" k="service" f={f} set={set} />

      <SectionTitle>Orders & bills</SectionTitle>
      <Field label="Order number prefix" value={f.order_prefix} onChangeText={(v) => set('order_prefix')(v.toUpperCase())} autoCapitalize="characters" maxLength={8} placeholder="e.g. MM-" hint="Orders are numbered MM-00001, MM-00002…" />
      <Field label="Bill caption" value={f.bill_caption} onChangeText={set('bill_caption')} multiline maxLength={300} placeholder="Thank you for shopping with us!" />
      <Field label="QR code link (optional)" value={f.qr_url} onChangeText={set('qr_url')} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        placeholder="https://instagram.com/yourshop" testID="qr-url"
        hint="A QR code for this link is printed on every bill. Customers scan it to open the link: your menu, Google reviews, Instagram, WhatsApp, payment page…" />
      {!!f.qr_url.trim() && (
        <Field label="Text under the QR code" value={f.qr_label} onChangeText={set('qr_label')} maxLength={60} placeholder="Scan me" testID="qr-label" />
      )}
      <Text style={{ fontWeight: '800', color: colors.text, marginTop: 4, marginBottom: 8 }}>Print the bill</Text>
      <Segmented value={f.bill_print} onChange={set('bill_print')}
        options={[{ value: 'auto', label: 'When order is placed' }, { value: 'manual', label: 'Only with Print button' }]} />
      <Text style={[s.itemMeta, { marginTop: 6, marginBottom: 10 }]}>
        {f.bill_print === 'manual'
          ? 'Staff print from the Print bill button on the order.'
          : 'The bill prints as soon as staff place an order. The Print bill button is always on the order too.'} Each phone / tablet picks its printer in My account.
      </Text>
    </Screen>
  );
}

function ChargeField({ title, k, f, set }) {
  const type = f[`${k}_type`];
  const pctOver = type === 'percent' && Number(f[`${k}_value`]) > 100;
  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>{title}</Text>
      <Segmented value={type} onChange={set(`${k}_type`)}
        options={[{ value: '', label: 'None' }, { value: 'fixed', label: 'Amount' }, { value: 'percent', label: '%' }]} />
      {!!type && (
        <Field label={type === 'percent' ? `${title} %` : `${title} amount per order`} value={f[`${k}_value`]} onChangeText={set(`${k}_value`)}
          keyboardType="decimal-pad" placeholder="0" error={pctOver ? 'At most 100%' : undefined} style={{ marginTop: 10, marginBottom: 0 }} testID={`set-${k}`} />
      )}
    </Card>
  );
}

function Toggle({ label, value, onChange, hint }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>{label}</Text>
        {!!hint && <Text style={s.itemMeta}>{hint}</Text>}
      </View>
      <Switch value={!!value} onValueChange={onChange} />
    </View>
  );
}

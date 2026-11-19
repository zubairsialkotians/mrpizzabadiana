import React, { useState } from 'react';
import { Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Card } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

export default function RegisterScreen({ navigation }) {
  const { startSession } = useAuth();
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const ok = f.name.trim() && f.phone.replace(/\D/g, '').length >= 7 && /^\S+@\S+\.\S+$/.test(f.email.trim()) && f.password.length >= 6;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.register({ ...f, email: f.email.trim() });
      await startSession(r);
      Toast.show({ type: 'success', text1: r.message });
      navigation.navigate('Home');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not create the account', text2: e.message, visibilityTime: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Create account">
      <Card>
        <Field label="Full name" value={f.name} onChangeText={set('name')} testID="reg-name" />
        <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" testID="reg-phone" />
        <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" testID="reg-email" hint="For order updates and password reset" />
        <Field label="Delivery address" value={f.address} onChangeText={set('address')} multiline placeholder="House, street, area, city" testID="reg-address" />
        <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry hint="At least 6 characters" testID="reg-password" />
        <Button testID="reg-submit" title="Create account" onPress={submit} loading={busy} disabled={!ok} />
      </Card>
      <Text style={{ textAlign: 'center', color: colors.muted }}>
        Have an account? <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => navigation.replace('Login')}>Log in</Text>
      </Text>
    </Screen>
  );
}

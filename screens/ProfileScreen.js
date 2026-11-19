import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';

export default function ProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [f, setF] = useState({ name: user.name, phone: user.phone, email: user.email, address: user.address });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveProfile(f);
      await updateUser(r.user);
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Profile" footer={<Footer><Button title="Save" onPress={save} loading={busy} /></Footer>}>
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Delivery address" value={f.address} onChangeText={set('address')} multiline />
    </Screen>
  );
}

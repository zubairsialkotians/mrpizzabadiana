import React, { useState } from 'react';
import { Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

// Accounts made at checkout have no password yet: they just set one
export default function PasswordScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.changePassword(current, next);
      if (r.user) await updateUser(r.user);
      Toast.show({ type: 'success', text1: r.message, text2: 'Other phones have been logged out' });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={user.has_password ? 'Change password' : 'Set a password'}>
      {!user.has_password && (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Your account was created when you placed an order. Set a password to log in on other phones.</Text>
      )}
      {user.has_password && <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />}
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry hint="At least 6 characters" />
      <Button title="Save password" onPress={save} loading={busy} disabled={next.length < 6 || (user.has_password && !current)} />
    </Screen>
  );
}

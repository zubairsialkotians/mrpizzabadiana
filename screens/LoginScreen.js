import React, { useState } from 'react';
import { Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Card } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { colors } from '../theme';

// Customers: phone or email. Shop staff log in here too (with their email).
export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const user = await login(id, password);
      Toast.show({ type: 'success', text1: `Welcome, ${user.name?.split(' ')[0] || ''}` });
      // Staff: the app switches to the admin screens by itself (App.js remounts the stack)
      if (user.kind === 'staff') return;
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Home');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not log in', text2: e.message, visibilityTime: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Log in">
      <Card>
        <Field label="Phone number or email" value={id} onChangeText={setId} autoCapitalize="none" keyboardType="email-address" testID="login-id" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} testID="login-password" />
        <Button testID="login-submit" title="Log in" onPress={submit} loading={busy} disabled={!id.trim() || !password} />
        <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 14 }} onPress={() => navigation.navigate('ForgotPassword', { email: id.includes('@') ? id : '' })}>
          Forgot password?
        </Text>
      </Card>
      <Text style={{ textAlign: 'center', color: colors.muted }}>
        New here? <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => navigation.replace('Register')}>Create an account</Text>
      </Text>
    </Screen>
  );
}


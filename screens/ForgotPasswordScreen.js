import React, { useState } from 'react';
import { Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Card } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

// Step 1: email → 6-digit code by email. Step 2: code + new password (logs you in).
export default function ForgotPasswordScreen({ navigation, route }) {
  const { startSession } = useAuth();
  const [email, setEmail] = useState(route.params?.email || '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.forgotPassword(email.trim());
      setSent(true);
      Toast.show({ type: 'success', text1: 'Check your email', text2: r.message, visibilityTime: 6000 });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not send the code', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const r = await api.resetPassword(email.trim(), code.trim(), password);
      await startSession(r);
      Toast.show({ type: 'success', text1: r.message });
      if (r.user.kind !== 'staff') navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not reset the password', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Reset password">
      <Card>
        <Field label="Email of your account" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!sent} testID="fp-email" />
        {!sent ? (
          <Button testID="fp-send" title="Send code" onPress={send} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} />
        ) : (
          <>
            <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} testID="fp-code" />
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 6 characters" testID="fp-password" />
            <Button testID="fp-reset" title="Save new password" onPress={reset} loading={busy} disabled={code.length !== 6 || password.length < 6} />
            <Text style={{ color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 14 }} onPress={send}>Send a new code</Text>
          </>
        )}
      </Card>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>The code arrives in a minute or two. Check your spam folder too.</Text>
    </Screen>
  );
}

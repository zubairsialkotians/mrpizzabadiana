import React, { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, SectionTitle, Segmented, Card } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme';

export default function BranchFormScreen({ navigation, route }) {
  const b = route.params?.branch;
  const { reloadBranches } = useAuth();
  const [f, setF] = useState({
    name: b?.name || '', address: b?.address || '', phone: b?.phone || '', is_main: !!b?.is_main,
    admin_name: b?.admin?.name || '', admin_email: b?.admin?.email || '', admin_password: '', status: b?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.saveBranch({ id: b?.id, ...f, is_main: f.is_main ? 1 : 0 });
      Toast.show({ type: 'success', text1: r.message });
      reloadBranches();
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title={b ? 'Edit branch' : 'New branch'} footer={<Footer><Button title={b ? 'Save changes' : 'Create branch'} onPress={save} loading={saving} disabled={!f.name.trim()} /></Footer>}>
      <Field label="Branch name" value={f.name} onChangeText={set('name')} placeholder="e.g. Madina Mart Gulberg" />
      <Field label="Address" value={f.address} onChangeText={set('address')} />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>Main branch</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Receives online orders; its stock shows in the app</Text>
          </View>
          <Switch value={f.is_main} onValueChange={set('is_main')} disabled={!!b?.is_main} />
        </View>
      </Card>

      <SectionTitle>Branch admin login (optional)</SectionTitle>
      <Field label="Admin name" value={f.admin_name} onChangeText={set('admin_name')} />
      <Field label="Email" value={f.admin_email} onChangeText={set('admin_email')} autoCapitalize="none" keyboardType="email-address" />
      <Field label={b?.admin ? 'New password' : 'Password'} value={f.admin_password} onChangeText={set('admin_password')} secureTextEntry
        hint={b?.admin ? 'Leave empty to keep the current password' : 'At least 6 characters. They log in from "My account" in the app.'} />

      {b && !b.is_main && (
        <>
          <SectionTitle>Status</SectionTitle>
          <Segmented value={f.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Disabled' }]} />
        </>
      )}
    </Screen>
  );
}

import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, SectionTitle, Segmented, SelectField } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';

// Owner: add or edit a kitchen / rider login
export default function TeamFormScreen({ navigation, route }) {
  const m = route.params?.member;
  const { branches } = useAuth();
  const [f, setF] = useState({
    role: m?.role || 'kitchen', name: m?.name || '', email: m?.email || '', phone: m?.phone || '', password: '',
    branch_id: m?.branch_id ?? 0, status: m?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const active = branches.filter((b) => b.status === 'active');
  const main = active.find((b) => b.is_main) || active[0];
  // Kitchen / cashier: one branch (main unless chosen). Rider: one branch or all of them.
  const options = [
    ...(f.role === 'rider' ? [{ value: 0, label: 'All branches' }] : []),
    ...active.map((b) => ({ value: b.id, label: `${b.name}${b.is_main ? ' (main)' : ''}`, sub: b.address })),
  ];
  const branchValue = f.role !== 'rider' && !f.branch_id ? main?.id : f.branch_id;

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.saveTeamMember({ id: m?.id, ...f, branch_id: branchValue || 0 });
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message, visibilityTime: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const ok = f.name.trim() && f.email.trim() && (m || f.password.length >= 6);
  return (
    <Screen title={m ? `Edit ${m.role}` : 'New login'}
      footer={<Footer><Button title={m ? 'Save changes' : 'Create login'} onPress={save} loading={saving} disabled={!ok} /></Footer>}>
      {!m && (
        <>
          <SectionTitle>Who is it for?</SectionTitle>
          <Segmented value={f.role} onChange={set('role')} options={[{ value: 'kitchen', label: 'Kitchen' }, { value: 'rider', label: 'Rider' }, { value: 'cashier', label: 'Cashier' }]} />
        </>
      )}
      <Field label="Name" value={f.name} onChangeText={set('name')} placeholder={f.role === 'rider' ? 'e.g. Ali (rider)' : 'e.g. Main kitchen'} />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad"
        hint={f.role === 'rider' ? 'Customers and the kitchen see it on orders this rider carries' : undefined} />
      <Field label="Email (to log in)" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Field label={m ? 'New password' : 'Password'} value={f.password} onChangeText={set('password')} secureTextEntry
        hint={m ? 'Leave empty to keep the current password' : 'At least 6 characters'} />

      {/* One branch only: kitchen goes to it, riders deliver for it (no choice to make) */}
      {active.length > 1 && (
        <SelectField label={{ rider: 'Delivers for', cashier: 'Cashier at' }[f.role] || 'Kitchen of'} value={branchValue} options={options} onChange={set('branch_id')} />
      )}

      {m && (
        <>
          <SectionTitle>Status</SectionTitle>
          <Segmented value={f.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Disabled' }]} />
        </>
      )}
    </Screen>
  );
}

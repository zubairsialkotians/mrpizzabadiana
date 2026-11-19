import React, { useState } from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, SelectField, BranchField } from '../components/ui';
import { useLoad } from '../components/useData';
import { api } from '../services/api';
import { confirmAction } from '../services/confirm';
import { ymd, isYmd } from '../services/format';

const DEFAULT_CATEGORIES = ['Salary', 'Rent', 'Electricity', 'Delivery', 'Packaging', 'Fuel', 'Repairs', 'General'];

export default function ExpenseFormScreen({ navigation, route }) {
  const e = route.params?.expense;
  // Categories already used (most used first), then the usual ones not used yet
  const used = useLoad(() => api.expenseCategories().then((r) => r.categories).catch(() => []));
  const cats = [...(used.data || []), ...DEFAULT_CATEGORIES.filter((d) => !(used.data || []).some((u) => u.toLowerCase() === d.toLowerCase()))];
  const [f, setF] = useState({
    category: e?.category || 'General', amount: e ? String(e.amount) : '', note: e?.note || '',
    expense_date: e?.expense_date || ymd(new Date()), branch_id: route.params?.branchId || 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.saveExpense({ id: e?.id, ...f });
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Delete expense?', 'This cannot be undone.', 'Delete', true))) return;
    try {
      await api.deleteExpense(e.id);
      Toast.show({ type: 'success', text1: 'Expense deleted' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: err.message });
    }
  };

  return (
    <Screen title={e ? 'Edit expense' : 'New expense'} footer={(
      <Footer>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {e && <Button title="Delete" variant="outline" onPress={remove} />}
          <Button title="Save" onPress={save} loading={saving} disabled={!isYmd(f.expense_date)} style={{ flex: 1 }} />
        </View>
      </Footer>
    )}>
      {!e && <BranchField value={f.branch_id} onChange={set('branch_id')} />}
      <SelectField label="Category" value={f.category} onChange={set('category')} creatable createLabel="Add new category"
        placeholder="Choose or type a category" options={cats.map((c) => ({ value: c, label: c }))} />
      <Field label="Amount" value={f.amount} onChangeText={set('amount')} keyboardType="decimal-pad" />
      <Field label="Date (YYYY-MM-DD)" value={f.expense_date} onChangeText={set('expense_date')} autoCapitalize="none"
        error={f.expense_date && !isYmd(f.expense_date) ? 'Invalid date' : ''} />
      <Field label="Note" value={f.note} onChangeText={set('note')} multiline />
    </Screen>
  );
}

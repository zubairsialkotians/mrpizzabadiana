import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, Button, s } from './ui';
import { catalogueStatus, onCatalogueChange, savedCatalogue, syncCatalogue, clearCatalogue } from '../services/catalogCache';
import { confirmAction } from '../services/confirm';
import { colors } from '../theme';

// { saved, syncing, synced_at, products, categories, error }, kept up to date
export function useCatalogueStatus() {
  const [st, setSt] = useState(catalogueStatus());
  useEffect(() => {
    const off = onCatalogueChange(() => setSt(catalogueStatus()));
    savedCatalogue().then(() => setSt(catalogueStatus())).catch(() => {});
    return off;
  }, []);
  return st;
}

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString();
};

export async function runSync() {
  try {
    await syncCatalogue();
    const st = catalogueStatus();
    Toast.show({ type: 'success', text1: 'Menu saved on this device', text2: `${st.products} items in ${st.categories} categories` });
  } catch (e) {
    Toast.show({ type: 'error', text1: 'Could not save the menu', text2: e.message, visibilityTime: 6000 });
  }
}

// My account: save / sync / clear the shop's menu on this device
export function MenuSyncCard() {
  const st = useCatalogueStatus();
  const clear = async () => {
    if (await confirmAction('Use the live menu?', 'The saved menu is deleted from this device. Items load from the server again every time.', 'Use live')) {
      await clearCatalogue();
      Toast.show({ type: 'success', text1: 'Using the live menu' });
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[st2.icon, { backgroundColor: st.saved ? colors.successSoft : colors.primarySoft }]}>
          <Ionicons name={st.saved ? 'cloud-done-outline' : 'cloud-outline'} size={22} color={st.saved ? colors.success : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st2.title}>{st.saved ? 'Menu saved on this device' : 'Live menu'}</Text>
          <Text style={s.itemMeta}>
            {st.syncing ? 'Saving the menu…'
              : st.saved ? `${st.products} items · ${st.categories} categories · synced ${when(st.synced_at)}`
                : 'Items load from the server each time.'}
          </Text>
        </View>
      </View>
      <Text style={[s.itemMeta, { marginTop: 10 }]}>
        {st.saved
          ? 'Taking orders uses this saved copy, so it is fast and needs less internet. Items, categories and stock you change in this app are synced by themselves; press Sync after changes made on another phone. The server still checks stock and prices when an order is placed.'
          : 'Save the categories and items on this device so taking orders is faster and does not ask the server every time. Needed to take orders with no internet.'}
      </Text>
      {!!st.error && <Text style={{ color: colors.danger, marginTop: 6 }}>{st.error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Button testID="menu-sync" title={st.saved ? 'Sync now' : 'Save menu on this device'} icon="sync-outline" onPress={runSync} loading={st.syncing} style={{ flex: 1 }} />
        {st.saved && <Button testID="menu-clear" title="Use live" icon="trash-outline" variant="outline" onPress={clear} disabled={st.syncing} style={{ flex: 0.7 }} />}
      </View>
    </Card>
  );
}

// Shop screen: small strip showing whether the saved menu is in use (tap → sync)
export function MenuStrip({ onSetup }) {
  const st = useCatalogueStatus();
  if (!st.saved && !st.syncing) {
    return (
      <TouchableOpacity style={st2.strip} onPress={onSetup} testID="menu-strip">
        <Ionicons name="cloud-download-outline" size={16} color={colors.primaryDark} />
        <Text style={st2.stripText}>Save the menu on this device for faster ordering</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={[st2.strip, { backgroundColor: colors.successSoft }]} onPress={st.syncing ? undefined : runSync} testID="menu-strip">
      <Ionicons name={st.syncing ? 'sync-outline' : 'cloud-done-outline'} size={16} color={colors.success} />
      <Text style={[st2.stripText, { color: colors.success }]}>
        {st.syncing ? 'Syncing the menu…' : `Saved menu · synced ${when(st.synced_at)}`}
      </Text>
      {!st.syncing && <Text style={{ color: colors.success, fontWeight: '800', fontSize: 13 }}>Sync</Text>}
    </TouchableOpacity>
  );
}

const st2 = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.black },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  stripText: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
});

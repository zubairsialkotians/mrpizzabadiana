import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Switch, KeyboardAvoidingView, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Field, Button, Loading, ErrorBox, Empty, Fab, Badge, Chip, s } from '../components/ui';
import { catTree } from '../components/CategoryFilter';
import { ProductImage } from '../components/shop';
import { useLoad } from '../components/useData';
import { api } from '../services/api';
import { pickAndUpload } from '../services/images';
import { colors } from '../theme';

export default function CategoriesScreen() {
  const { data, loading, error, reload, refresh, refreshing } = useLoad(() => api.adminCategories().then((r) => r.categories));
  const [edit, setEdit] = useState(null);

  return (
    <Screen title="Categories" onRefresh={refresh} refreshing={refreshing}>
      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.length ? (
        <Empty icon="grid-outline" text="No categories yet. Tap + to add one (e.g. Fruits, Dairy, Rice)." />
      ) : catTree(data).map((m) => (
        <View key={m.id}>
          <CategoryRow c={m} onPress={() => setEdit(m)}
            right={(
              <TouchableOpacity onPress={() => setEdit({ parent_id: m.id })} hitSlop={8} testID={`cat-addsub-${m.id}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6 }}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Sub</Text>
              </TouchableOpacity>
            )} />
          {m.subs.map((c) => <CategoryRow key={c.id} c={c} sub onPress={() => setEdit(c)} />)}
        </View>
      ))}
      <View style={{ height: 70 }} />
      <Fab onPress={() => setEdit({})} label="Category" />
      {edit && <CategoryModal cat={edit} cats={data || []} onClose={(saved) => { setEdit(null); if (saved) reload(); }} />}
    </Screen>
  );
}

function CategoryRow({ c, sub, onPress, right }) {
  return (
    <TouchableOpacity style={[s.item, { gap: 10 }, sub && { marginLeft: 28 }]} onPress={onPress} testID={`cat-row-${c.id}`}>
      {sub && <Ionicons name="return-down-forward" size={16} color={colors.muted} />}
      <ProductImage uri={c.image} style={sub ? { width: 34, height: 34, borderRadius: 17 } : { width: 44, height: 44, borderRadius: 22 }} iconSize={sub ? 14 : 18} />
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle}>{c.name}</Text>
        <Text style={s.itemMeta}>
          {c.items} item{c.items === 1 ? '' : 's'}{!sub && c.subs?.length ? ` · ${c.subs.length} sub-categor${c.subs.length === 1 ? 'y' : 'ies'}` : ''} · order {c.sort}
        </Text>
      </View>
      {c.status === 'inactive' && <Badge status="inactive" label="Hidden" />}
      {right}
    </TouchableOpacity>
  );
}

function CategoryModal({ cat, cats, onClose }) {
  const [name, setName] = useState(cat.name || '');
  const [parentId, setParentId] = useState(cat.parent_id || 0);
  // A main category with sub-categories stays a main category (one level only)
  const hasSubs = !!cat.id && cats.some((c) => c.parent_id === cat.id);
  const parents = cats.filter((c) => !c.parent_id && c.id !== cat.id);
  const [sort, setSort] = useState(String(cat.sort ?? 0));
  const [active, setActive] = useState(cat.status !== 'inactive');
  const [image, setImage] = useState(cat.image_id ? { id: cat.image_id, thumb: cat.image } : null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    try {
      const img = await pickAndUpload({ square: true, maxWidth: 600, title: name });
      if (img) setImage(img);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not add the photo', text2: e.message });
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveCategory({ id: cat.id, name, parent_id: parentId, sort: Number(sort) || 0, status: active ? 'active' : 'inactive', image_id: image?.id || 0 });
      Toast.show({ type: 'success', text1: r.message });
      onClose(true);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView behavior="padding" style={[s.modalBack, { justifyContent: 'center', padding: 24 }]}>
        <View style={[s.card, { padding: 18 }]}>
          <Text style={[s.sheetTitle, { marginBottom: 12 }]}>{cat.id ? (parentId ? 'Edit sub-category' : 'Edit category') : (parentId ? 'New sub-category' : 'New category')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <ProductImage uri={image?.thumb} style={{ width: 64, height: 64, borderRadius: 32 }} iconSize={22} />
            <Button small variant="ghost" icon="image-outline" title={image ? 'Change picture' : 'Add picture'} onPress={pick} />
          </View>
          <Field label="Name" value={name} onChangeText={setName} testID="cat-name" />
          {hasSubs ? (
            <Text style={[s.itemMeta, { marginBottom: 12 }]}>Main category — it has sub-categories.</Text>
          ) : parents.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 6 }}>Main category</Text>
              <ScrollView style={{ maxHeight: 120 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} keyboardShouldPersistTaps="handled">
                <Chip label="None (main category)" active={!parentId} onPress={() => setParentId(0)} />
                {parents.map((c) => <Chip key={c.id} label={c.name} active={parentId === c.id} onPress={() => setParentId(c.id)} />)}
              </ScrollView>
              <Text style={[s.itemMeta, { marginTop: 4 }]}>{parentId ? 'This is a sub-category: it shows when customers pick its main category.' : 'Pick one to make this a sub-category.'}</Text>
            </View>
          )}
          <Field label="Display order" value={sort} onChangeText={setSort} keyboardType="number-pad" hint="Lower numbers show first" />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>Show in shop</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancel" variant="outline" onPress={() => onClose(false)} style={{ flex: 1 }} />
            <Button testID="cat-save" title="Save" onPress={save} loading={busy} disabled={!name.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

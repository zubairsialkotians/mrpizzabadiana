import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Loading, ErrorBox, Empty, Fab, Badge, s } from '../components/ui';
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
      ) : data.map((c) => (
        <TouchableOpacity key={c.id} style={[s.item, { gap: 10 }]} onPress={() => setEdit(c)}>
          <ProductImage uri={c.image} style={{ width: 44, height: 44, borderRadius: 22 }} iconSize={18} />
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>{c.name}</Text>
            <Text style={s.itemMeta}>{c.items} item{c.items === 1 ? '' : 's'} · order {c.sort}</Text>
          </View>
          {c.status === 'inactive' && <Badge status="inactive" label="Hidden" />}
        </TouchableOpacity>
      ))}
      <View style={{ height: 70 }} />
      <Fab onPress={() => setEdit({})} label="Category" />
      {edit && <CategoryModal cat={edit} onClose={(saved) => { setEdit(null); if (saved) reload(); }} />}
    </Screen>
  );
}

function CategoryModal({ cat, onClose }) {
  const [name, setName] = useState(cat.name || '');
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
      const r = await api.saveCategory({ id: cat.id, name, sort: Number(sort) || 0, status: active ? 'active' : 'inactive', image_id: image?.id || 0 });
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
      <View style={[s.modalBack, { justifyContent: 'center', padding: 24 }]}>
        <View style={[s.card, { padding: 18 }]}>
          <Text style={[s.sheetTitle, { marginBottom: 12 }]}>{cat.id ? 'Edit category' : 'New category'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <ProductImage uri={image?.thumb} style={{ width: 64, height: 64, borderRadius: 32 }} iconSize={22} />
            <Button small variant="ghost" icon="image-outline" title={image ? 'Change picture' : 'Add picture'} onPress={pick} />
          </View>
          <Field label="Name" value={name} onChangeText={setName} testID="cat-name" />
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
      </View>
    </Modal>
  );
}

import React, { useState } from 'react';
import { View, Text, Image, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, Card, SectionTitle, SelectField, s } from '../components/ui';
import { useLoad } from '../components/useData';
import { api } from '../services/api';
import { catOptions } from '../components/CategoryFilter';
import { pickAndUpload } from '../services/images';
import { confirmAction } from '../services/confirm';
import { colors } from '../theme';

// Owner: add / edit a home-page banner
export default function BannerFormScreen({ navigation, route }) {
  const b = route.params?.banner;
  const cats = useLoad(() => api.adminCategories().then((r) => r.categories));
  const [f, setF] = useState({
    image: b?.image || null, title: b?.title || '', category_id: b?.category_id || 0,
    sort_order: String(b ? b.sort_order : (route.params?.nextPosition || 0)),
    visible: b ? b.status !== 'hidden' : true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const pick = async () => {
    setUploading(true);
    try {
      const img = await pickAndUpload({ maxWidth: 1400, title: f.title || 'Banner' });
      if (img) set('image')(img);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not add the photo', text2: e.message });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.saveBanner({
        id: b?.id, image_id: f.image?.id || 0, title: f.title, category_id: f.category_id,
        sort_order: parseInt(f.sort_order, 10) || 0, status: f.visible ? 'active' : 'hidden',
      });
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Delete banner?', 'It will be removed from the home page. This cannot be undone.', 'Delete', true))) return;
    try {
      await api.deleteBanner(b.id);
      Toast.show({ type: 'success', text1: 'Banner deleted' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: err.message });
    }
  };

  return (
    <Screen title={b ? 'Edit banner' : 'New banner'} footer={(
      <Footer>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {b && <Button title="Delete" variant="outline" onPress={remove} />}
          <Button testID="banner-save" title="Save" onPress={save} loading={saving} disabled={!f.image || uploading} style={{ flex: 1 }} />
        </View>
      </Footer>
    )}>
      <SectionTitle>Photo</SectionTitle>
      <Card style={{ gap: 10 }}>
        {f.image
          ? <Image source={{ uri: f.image.url }} style={{ width: '100%', aspectRatio: 2, borderRadius: 10, backgroundColor: colors.background }} resizeMode="cover" />
          : <Text style={s.itemMeta}>Use a wide photo (2:1, e.g. 1200 × 600). Edges may be trimmed to fit.</Text>}
        <Button small variant="ghost" icon="image-outline" title={f.image ? 'Change photo' : 'Add photo'} onPress={pick} loading={uploading} testID="banner-pick" />
      </Card>

      <Field label="Caption (optional)" value={f.title} onChangeText={set('title')} maxLength={191} placeholder="e.g. 20% off on all fruits" testID="banner-title" />
      <SelectField label="When tapped, open" value={f.category_id} onChange={set('category_id')}
        options={[{ value: 0, label: 'Nothing (just a picture)' }, ...catOptions(cats.data || [])]} />
      <Field label="Position" value={f.sort_order} onChangeText={(v) => set('sort_order')(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
        hint="Lower numbers show first" maxLength={4} />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>Show to customers</Text>
            <Text style={s.itemMeta}>{f.visible ? 'Visible in the home-page slider' : 'Hidden — only you can see it'}</Text>
          </View>
          <Switch value={f.visible} onValueChange={set('visible')} />
        </View>
      </Card>
    </Screen>
  );
}

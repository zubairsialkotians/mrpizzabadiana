import React, { useState } from 'react';
import { View, Text, Image, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Field, Button, Footer, Card, SectionTitle, s } from '../components/ui';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { pickAndUpload } from '../services/images';
import { confirmAction } from '../services/confirm';
import { niceDate } from '../services/format';
import { colors } from '../theme';

// Owner: write / edit a news post; new posts notify all customers unless switched off
export default function NewsFormScreen({ navigation, route }) {
  const { reloadShop } = useAuth();
  const n = route.params?.news;
  const [f, setF] = useState({
    title: n?.title || '', body: n?.body || '', image: n?.image || null,
    visible: n ? n.status !== 'hidden' : true,
    notify: !n, // edits don't re-send unless asked
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const pick = async () => {
    try {
      const img = await pickAndUpload({ maxWidth: 1200, title: f.title || 'News' });
      if (img) set('image')(img);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not add the photo', text2: e.message });
    }
  };

  const save = async () => {
    const notify = f.notify && f.visible;
    if (notify && n?.notified_at && !(await confirmAction('Send again?', 'Customers were already notified about this news. Send the notification again?', 'Send'))) return;
    setSaving(true);
    try {
      const r = await api.saveNews({
        id: n?.id, title: f.title, body: f.body, image_id: f.image?.id || 0,
        status: f.visible ? 'published' : 'hidden', notify: notify ? 1 : 0,
      });
      reloadShop();
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Delete news?', 'Customers will no longer see it. This cannot be undone.', 'Delete', true))) return;
    try {
      await api.deleteNews(n.id);
      reloadShop();
      Toast.show({ type: 'success', text1: 'News deleted' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: err.message });
    }
  };

  const willSend = f.notify && f.visible;
  return (
    <Screen title={n ? 'Edit news' : 'New news'} footer={(
      <Footer>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {n && <Button title="Delete" variant="outline" onPress={remove} />}
          <Button testID="news-save" title={willSend ? (n ? 'Save & notify' : 'Post & notify') : (n ? 'Save' : 'Post')}
            icon={willSend ? 'notifications-outline' : undefined} onPress={save} loading={saving} disabled={!f.title.trim()} style={{ flex: 1 }} />
        </View>
      </Footer>
    )}>
      <Field label="Title" value={f.title} onChangeText={set('title')} maxLength={191} placeholder="e.g. Fresh mangoes have arrived!" testID="news-title" />
      <Field label="Message" value={f.body} onChangeText={set('body')} multiline maxLength={5000} inputStyle={{ height: 140 }}
        placeholder="Details, prices, timings…" testID="news-body" />

      <SectionTitle>Photo (optional)</SectionTitle>
      <Card style={{ gap: 10 }}>
        {f.image
          ? <Image source={{ uri: f.image.url }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.background }} resizeMode="cover" />
          : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="ghost" icon="image-outline" title={f.image ? 'Change photo' : 'Add photo'} onPress={pick} style={{ flex: 1 }} />
          {!!f.image && <Button small variant="outline" title="Remove" onPress={() => set('image')(null)} />}
        </View>
      </Card>

      <Card>
        <Toggle label="Show to customers" value={f.visible} onChange={set('visible')} hint={f.visible ? 'Visible in the News section of the app' : 'Hidden — only you can see it'} />
        <View style={{ height: 12 }} />
        <Toggle label="Send notification" value={willSend} onChange={set('notify')} disabled={!f.visible}
          hint={n?.notified_at ? `Last sent ${niceDate(n.notified_at)} to ${n.notified_count} phone${n.notified_count === 1 ? '' : 's'}` : 'Every customer with the app gets a notification on their phone'} />
      </Card>
    </Screen>
  );
}

function Toggle({ label, value, onChange, hint, disabled }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>{label}</Text>
        {!!hint && <Text style={s.itemMeta}>{hint}</Text>}
      </View>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

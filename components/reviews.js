import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, Field, Button, s } from './ui';
import { api } from '../services/api';
import { niceDate } from '../services/format';
import { colors } from '../theme';

export const STAR_COLOR = '#f59e0b';
export const RATING_WORDS = ['', 'Very bad', 'Bad', 'Okay', 'Good', 'Excellent'];

// Read-only stars, or tappable when onChange is given
export function Stars({ value = 0, size = 18, onChange, testID }) {
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 8 : 2 }} testID={testID}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? STAR_COLOR : colors.faint} />;
        return onChange
          ? <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6} testID={testID && `${testID}-${n}`}>{icon}</TouchableOpacity>
          : <View key={n}>{icon}</View>;
      })}
    </View>
  );
}

// Customer side: rate a delivered order (guests pass the order's access key)
export function ReviewForm({ order, accessKey, onSaved }) {
  const review = order.review;
  const [editing, setEditing] = useState(!review);
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!rating) { Toast.show({ type: 'error', text1: 'Please tap the stars to rate your order' }); return; }
    setSaving(true);
    try {
      const r = await api.reviewOrder(order.id, rating, comment.trim(), accessKey);
      onSaved?.(r.order);
      setEditing(false);
      Toast.show({ type: 'success', text1: r.message });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not send your review', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!editing && review) {
    return (
      <Card>
        <View style={st.row}>
          <Stars value={review.rating} size={20} />
          <Text style={st.word}>{RATING_WORDS[review.rating]}</Text>
        </View>
        {!!review.comment && <Text style={st.comment}>{review.comment}</Text>}
        <Text style={s.itemMeta}>{niceDate(review.updated_at || review.created_at)}</Text>
        <Button small variant="ghost" icon="create-outline" title="Edit my review" onPress={() => setEditing(true)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 10 }}>How was your order?</Text>
      <View style={[st.row, { marginBottom: 14 }]}>
        <Stars value={rating} size={32} onChange={setRating} testID="review-stars" />
        {!!rating && <Text style={st.word}>{RATING_WORDS[rating]}</Text>}
      </View>
      <Field label="Comment (optional)" value={comment} onChangeText={setComment} multiline maxLength={1000}
        placeholder="Tell the shop what you liked or what could be better" testID="review-comment" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {!!review && <Button title="Cancel" variant="outline" onPress={() => { setEditing(false); setRating(review.rating); setComment(review.comment); }} style={{ flex: 1 }} />}
        <Button title={review ? 'Update review' : 'Submit review'} icon="send-outline" loading={saving} onPress={save} style={{ flex: 1 }} testID="review-submit" />
      </View>
    </Card>
  );
}

// Staff side: one review (on the order page or in the reviews list)
export function ReviewView({ review, title, sub, onPress }) {
  return (
    <Card onPress={onPress}>
      {!!title && <Text style={s.itemTitle}>{title}</Text>}
      <View style={[st.row, !!title && { marginTop: 4 }]}>
        <Stars value={review.rating} size={18} />
        <Text style={st.word}>{RATING_WORDS[review.rating]}</Text>
      </View>
      {review.comment
        ? <Text style={st.comment}>{review.comment}</Text>
        : <Text style={[s.itemMeta, { marginTop: 6 }]}>No comment</Text>}
      <Text style={s.itemMeta}>{niceDate(review.created_at)}{review.updated_at && review.updated_at !== review.created_at ? ' · edited' : ''}{sub ? ` · ${sub}` : ''}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontWeight: '700', color: colors.text },
  comment: { color: colors.text, marginTop: 8, marginBottom: 4, lineHeight: 20 },
});

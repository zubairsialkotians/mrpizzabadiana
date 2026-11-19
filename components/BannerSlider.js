import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

const RATIO = 2; // banners are 2:1 (e.g. 1200 × 600)
const AUTO_MS = 4000;

// Home-page slider: swipes, auto-advances, pauses while the customer is swiping
export default function BannerSlider({ banners, width, onPress }) {
  const list = useRef(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;
  const dragging = useRef(false);
  const count = banners.length;
  const height = width / RATIO;

  useEffect(() => { if (index >= count) setIndex(0); }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (count < 2 || !width) return undefined;
    const t = setInterval(() => {
      if (dragging.current) return;
      const next = (indexRef.current + 1) % count;
      list.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [count, width]);

  if (!count || !width) return null;

  const onScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < count) setIndex(i);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <FlatList
        ref={list}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => String(b.id)}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onScrollEndDrag={() => { dragging.current = false; }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={{ width, borderRadius: 14 }}
        renderItem={({ item: b }) => (
          <TouchableOpacity activeOpacity={b.category_id ? 0.85 : 1} disabled={!b.category_id} onPress={() => onPress?.(b)}
            style={{ width, height }} testID={`banner-${b.id}`}>
            <Image source={{ uri: b.image.url }} style={[st.img, { width, height }]} resizeMode="cover" />
            {!!b.title && (
              <View style={st.caption}><Text style={st.captionText} numberOfLines={2}>{b.title}</Text></View>
            )}
          </TouchableOpacity>
        )}
      />
      {count > 1 && (
        <View style={st.dots}>
          {banners.map((b, i) => <View key={b.id} style={[st.dot, i === index && st.dotActive]} />)}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  img: { borderRadius: 14, backgroundColor: colors.border },
  caption: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.38)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },
  captionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },
});

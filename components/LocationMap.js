import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_NAME } from '../config';
import { colors } from '../theme';

/*
  A small map with a pin. image: a ready map picture (Google Static Maps, when the shop has a key in wp-admin);
  without it the map is drawn from OpenStreetMap tiles around the point (free, no key).
*/
const TILE = 256;
const ZOOM = 15;

export function LocationMap({ lat, lng, image, height = 180, onPress, style }) {
  const [w, setW] = useState(0);
  const [failed, setFailed] = useState(false);

  const google = !!image && !failed; // a bad / restricted key → OpenStreetMap instead
  const tiles = [];
  if (w && !google) {
    const n = 2 ** ZOOM;
    const latR = (lat * Math.PI) / 180;
    const x = ((lng + 180) / 360) * n * TILE;
    const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n * TILE;
    const left = x - w / 2;
    const top = y - height / 2;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${tx}_${ty}`, uri: `https://tile.openstreetmap.org/${ZOOM}/${wx}/${ty}.png`, x: tx * TILE - left, y: ty * TILE - top });
      }
    }
  }

  const body = (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={[{ height, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.background }, style]}>
      {google ? (
        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <>
          {tiles.map((t) => (
            <Image key={t.key} source={{ uri: t.uri, headers: { 'User-Agent': `${APP_NAME.replace(/[^\w .-]/g, '')}/1.0 (shop app)` } }}
              style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE }} />
          ))}
          <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 18, top: height / 2 - 34 }}>
            <Ionicons name="location" size={36} color="#d93025" />
          </View>
          <Text style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 9, color: '#333', backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 3 }}>
            © OpenStreetMap
          </Text>
        </>
      )}
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.85} onPress={onPress}>{body}</TouchableOpacity> : body;
}

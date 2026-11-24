import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { qrMatrix } from '../services/qr';
import { DEVELOPER_LINE } from '../services/documents';

/*
  Draws a document model (services/documents.js) as native views.
  What you see here is exactly what "Share image" captures, so it has its own white
  background and fixed width.
*/
const DocView = forwardRef(function DocView({ model: m, width }, ref) {
  const c = m.company;
  const tone = (t) => (t === 'good' ? { color: colors.success } : t === 'bad' ? { color: colors.danger } : null);

  return (
    <View ref={ref} collapsable={false} style={[st.page, { width }]}>
      <View style={st.top}>
        <View style={st.co}>
          {!!c.logo_url && <Image source={{ uri: c.logo_url }} style={st.logo} resizeMode="contain" />}
          <View style={{ flexShrink: 1 }}>
            <Text style={st.name}>{c.name}</Text>
            {m.from.map((l, i) => <Text key={i} style={st.muted}>{l}</Text>)}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: '48%' }}>
          <Text style={st.title}>{m.title}</Text>
          {m.meta.map(([k, v]) => (
            <Text key={k} style={st.metaRow}><Text style={st.muted}>{k}  </Text><Text style={{ fontWeight: '700' }}>{v}</Text></Text>
          ))}
          {!!m.stamp && <Text style={st.stamp}>{m.stamp}</Text>}
        </View>
      </View>

      {m.party && (
        <View style={{ marginTop: 10 }}>
          <Text style={st.partyHead}>{m.party.heading}</Text>
          {m.party.lines.map((l, i) => <Text key={i} style={i ? st.muted : st.partyName}>{l}</Text>)}
        </View>
      )}

      {m.summary && (
        <View style={st.summary}>
          {m.summary.map(([k, v]) => (
            <View key={k} style={st.sumBox}>
              <Text style={st.sumLabel}>{k}</Text>
              <Text style={st.sumValue}>{v}</Text>
            </View>
          ))}
        </View>
      )}

      {m.blocks.map((b, bi) => (
        <View key={bi} style={{ marginTop: 10 }}>
          {!!b.heading && <Text style={st.blockHead}>{b.heading}</Text>}
          {!!b.sub && <Text style={[st.muted, { marginBottom: 4 }]}>{b.sub}</Text>}
          <View style={[st.tr, st.th]}>
            {b.columns.map((col, i) => (
              <Text key={i} style={[st.thText, { flex: col.w, textAlign: col.align || 'left' }]}>{col.label}</Text>
            ))}
          </View>
          {b.rows.map((r, ri) => (
            <View key={ri} style={st.tr}>
              {r.cells.map((cell, i) => {
                const align = { flex: b.columns[i]?.w || 1, textAlign: b.columns[i]?.align || 'left' };
                const obj = typeof cell === 'object' && cell;
                return (
                  <View key={i} style={{ flex: align.flex }}>
                    <Text style={[st.td, { textAlign: align.textAlign }, r.bold && { fontWeight: '700' }]}>{obj ? obj.text : cell}</Text>
                    {!!obj?.sub && <Text style={[st.cellSub, { textAlign: align.textAlign }]}>{obj.sub}</Text>}
                  </View>
                );
              })}
            </View>
          ))}
          {b.foot && (
            <View style={[st.tr, st.foot]}>
              <Text style={[st.td, { flex: 1, fontWeight: '800' }]}>{b.foot[0]}</Text>
              <Text style={[st.td, { fontWeight: '800' }]}>{b.foot[1]}</Text>
            </View>
          )}
        </View>
      ))}

      {m.totals && (
        <View style={st.totals}>
          {m.totals.map((t, i) => (
            <View key={i} style={[st.totRow, t.big && st.totBig, t.divider && st.totDiv]}>
              <Text style={[st.totText, t.bold && { fontWeight: '800' }, t.big && { fontSize: 15 }]}>{t.label}</Text>
              <Text style={[st.totText, t.bold && { fontWeight: '800' }, t.big && { fontSize: 15 }, tone(t.tone)]}>{t.value}</Text>
            </View>
          ))}
        </View>
      )}

      {m.notes?.map((n, i) => <Text key={i} style={[st.muted, { marginTop: i ? 2 : 12, fontSize: 11 }]}>{n}</Text>)}

      {!!m.qr && <BillQr url={m.qr.url} label={m.qr.label} />}

      {!!(c.bill_caption || c.support_phone) && (
        <View style={st.footer}>
          {!!c.bill_caption && <Text style={st.caption}>{c.bill_caption}</Text>}
          {!!c.support_phone && (
            <Text style={[st.muted, { textAlign: 'center' }]}>For support call: <Text style={{ fontWeight: '800', color: colors.text }}>{c.support_phone}</Text></Text>
          )}
        </View>
      )}
      <Text style={st.dev}>{DEVELOPER_LINE}</Text>
    </View>
  );
});

// QR code drawn with plain views (dark runs per row), so "Share image" and printing capture it too
function BillQr({ url, label, size = 116 }) {
  const m = qrMatrix(url);
  if (!m) return null;
  const n = m.size + 4; // quiet zone
  const cell = size / n;
  return (
    <View style={{ alignItems: 'center', marginTop: 14 }}>
      <View style={{ width: size, height: size, backgroundColor: '#fff' }}>
        {m.rows.map((runs, r) => runs.map(([c, len]) => (
          <View key={`${r}-${c}`} style={{ position: 'absolute', top: (r + 2) * cell, left: (c + 2) * cell, width: len * cell + 0.4, height: cell + 0.4, backgroundColor: '#000' }} />
        )))}
      </View>
      {!!label && <Text style={{ fontWeight: '800', color: colors.text, marginTop: 4, fontSize: 13 }}>{label}</Text>}
    </View>
  );
}

export default DocView;

const st = StyleSheet.create({
  page: { backgroundColor: '#fff', padding: 14, alignSelf: 'center', borderRadius: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 10 },
  co: { flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 1 },
  logo: { width: 52, height: 52 },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  muted: { color: colors.muted, fontSize: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  metaRow: { fontSize: 11, color: colors.text, textAlign: 'right' },
  stamp: { marginTop: 4, color: colors.danger, borderWidth: 2, borderColor: colors.danger, paddingHorizontal: 6, fontWeight: '800', letterSpacing: 2 },
  partyHead: { fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  partyName: { fontSize: 15, fontWeight: '800', color: colors.text },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  sumBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  sumLabel: { fontSize: 10, color: colors.muted },
  sumValue: { fontSize: 13, fontWeight: '800', color: colors.text },
  blockHead: { fontSize: 13, fontWeight: '800', color: colors.text },
  tr: { flexDirection: 'row', gap: 4, paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { backgroundColor: colors.primarySoft, borderBottomWidth: 0 },
  thText: { fontSize: 10, fontWeight: '800', color: colors.primaryDark },
  td: { fontSize: 11, color: colors.text },
  cellSub: { fontSize: 9, color: colors.muted },
  foot: { backgroundColor: colors.background, borderBottomWidth: 0 },
  totals: { marginTop: 10, marginLeft: 'auto', width: '66%' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totBig: { borderTopWidth: 1, borderTopColor: colors.text, paddingTop: 5, marginTop: 3 },
  totDiv: { borderTopWidth: 1, borderTopColor: colors.faint, borderStyle: 'dashed', paddingTop: 5, marginTop: 3 },
  totText: { fontSize: 12, color: colors.text },
  dev: { marginTop: 10, textAlign: 'center', color: colors.faint, fontSize: 10 },
  footer: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, alignItems: 'center', gap: 2 },
  caption: { fontStyle: 'italic', color: colors.text, textAlign: 'center', fontSize: 12 },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView,
  Modal, FlatList, RefreshControl, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, statusColors } from '../theme';
import { RANGE_PRESETS, RANGE_LABELS, rangeFor, rangeLabel, isYmd } from '../services/format';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

/* ---------------- Screen ---------------- */

export function Screen({
  title, subtitle, right, children, scroll = true, onRefresh, refreshing = false,
  footer, back = true, padded = true,
}) {
  const navigation = useNavigation();
  const canBack = back && navigation.canGoBack();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && s.body, { paddingBottom: 32 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, padded && s.body]}>{children}</View>;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        {canBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : <View style={{ width: 4 }} />}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {/* Android draws edge to edge (the window no longer shrinks for the keyboard): lift the content on both platforms */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {body}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function HeaderButton({ icon, onPress, badge }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.headerBtn} hitSlop={8}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      {!!badge && <View style={s.dot}><Text style={s.dotText}>{badge > 99 ? '99+' : badge}</Text></View>}
    </TouchableOpacity>
  );
}

// Fixed bottom bar for a form's main action
export function Footer({ children }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.footer, { paddingBottom: 12 + insets.bottom }]}>{children}</View>;
}

/* ---------------- Basics ---------------- */

export function Card({ children, style, onPress }) {
  const C = onPress ? TouchableOpacity : View;
  return <C style={[s.card, style]} onPress={onPress} activeOpacity={0.7}>{children}</C>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, small, style, testID }) {
  const v = {
    primary: { bg: colors.brand, fg: colors.onBrand, border: colors.brand },
    outline: { bg: '#fff', fg: colors.primary, border: colors.primary },
    danger: { bg: colors.danger, fg: '#fff', border: colors.danger },
    success: { bg: colors.success, fg: '#fff', border: colors.success },
    ghost: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
  }[variant];
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border }, (disabled || loading) && { opacity: 0.55 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} />}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, error, hint, style, inputStyle, multiline, ...props }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.faint}
        style={[s.input, multiline && { height: 90, textAlignVertical: 'top', paddingTop: 12 }, error && { borderColor: colors.danger }, inputStyle]}
        multiline={multiline}
        {...props}
      />
      {!!error && <Text style={s.error}>{error}</Text>}
      {!!hint && !error && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      {icon && <Ionicons name={icon} size={14} color={active ? colors.onBrand : colors.muted} />}
      <Text style={[s.chipText, active && { color: colors.onBrand }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ children, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0, marginBottom: 10 }, style]}
      contentContainerStyle={{ gap: 8, paddingRight: 8 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <TouchableOpacity key={o.value} style={[s.segItem, value === o.value && s.segActive]} onPress={() => onChange(o.value)}>
          <Text style={[s.segText, value === o.value && { color: colors.primary }]} numberOfLines={1}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Badge({ status, label }) {
  const c = statusColors[status] || statusColors.inactive;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.fg }]}>{label || status}</Text>
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', text = 'Nothing here yet' }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color={colors.faint} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return <View style={s.empty}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <View style={s.empty}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
      <Text style={[s.emptyText, { color: colors.danger }]}>{message}</Text>
      {onRetry && <Button title="Try again" variant="outline" small onPress={onRetry} style={{ marginTop: 12 }} />}
    </View>
  );
}

export function Stat({ label, value, sub, tone = 'default', icon, onPress, style }) {
  const fg = { default: colors.text, good: colors.success, bad: colors.danger, warn: colors.warning, primary: colors.primary }[tone];
  const C = onPress ? TouchableOpacity : View;
  return (
    <C style={[s.stat, style]} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon && <Ionicons name={icon} size={14} color={colors.muted} />}
        <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.statValue, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {!!sub && <Text style={s.statSub} numberOfLines={1}>{sub}</Text>}
    </C>
  );
}

export function StatGrid({ children }) {
  return <View style={s.grid}>{children}</View>;
}

export function KV({ label, value, bold, tone }) {
  const fg = { good: colors.success, bad: colors.danger }[tone] || colors.text;
  return (
    <View style={s.kv}>
      <Text style={[s.kvLabel, bold && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
      <Text style={[s.kvValue, bold && { fontWeight: '800' }, { color: fg }]}>{value}</Text>
    </View>
  );
}

export function ListItem({ title, subtitle, meta, right, rightSub, rightTone, onPress, onLongPress, icon, badge }) {
  const fg = { good: colors.success, bad: colors.danger, warn: colors.warning }[rightTone] || colors.text;
  const C = onPress ? TouchableOpacity : View;
  return (
    <C style={s.item} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      {icon && <View style={s.itemIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.itemTitle} numberOfLines={1}>{title}</Text>
          {badge}
        </View>
        {!!subtitle && <Text style={s.itemSub} numberOfLines={2}>{subtitle}</Text>}
        {!!meta && <Text style={s.itemMeta} numberOfLines={1}>{meta}</Text>}
      </View>
      {(right !== undefined || rightSub) && (
        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          {right !== undefined && <Text style={[s.itemRight, { color: fg }]}>{right}</Text>}
          {!!rightSub && <Text style={s.itemMeta}>{rightSub}</Text>}
        </View>
      )}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.faint} style={{ marginLeft: 6 }} />}
    </C>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Search' }) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={18} color={colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={s.searchInput}
        returnKeyType="search"
        autoCorrect={false}
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.faint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function Fab({ icon = 'add', onPress, label }) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity style={[s.fab, { bottom: 20 + insets.bottom }]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={colors.onBrand} />
      {!!label && <Text style={s.fabText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function LoadMore({ hasMore, loading, onPress }) {
  if (!hasMore) return null;
  return <Button title="Load more" variant="ghost" small loading={loading} onPress={onPress} style={{ marginTop: 6 }} />;
}

/* ---------------- Pickers ---------------- */

// options: [{ value, label, sub }]
// alwaysSearch: show the search box even for short lists
// action: { label, icon, onPress } — a button at the top of the list (e.g. "Add new shop")
export function SelectField({
  label, value, options, onChange, placeholder = 'Select', searchable = true, alwaysSearch, searchPlaceholder,
  action, style, error, compact, creatable, createLabel = 'Add',
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const insets = useSafeAreaInsets();
  // creatable: the value may be text that isn't in the list yet (typed in the search box)
  const current = options.find((o) => String(o.value) === String(value))
    || (creatable && value ? { value, label: String(value) } : null);
  const typed = q.trim().replace(/\s+/g, ' ');
  const canCreate = creatable && typed && !options.some((o) => String(o.label).toLowerCase() === typed.toLowerCase());
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(t)) : options;
  }, [q, options]);

  return (
    <View style={[!compact && { marginBottom: 14 }, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity style={[compact ? s.chip : s.input, s.select, error && { borderColor: colors.danger }]} onPress={() => setOpen(true)}>
        {/* compact: size to the text (flex: 0 collapses it to zero width on web) */}
        <Text style={[compact ? { flexShrink: 1, maxWidth: 200, fontWeight: '600' } : { flex: 1 }, { color: current ? colors.text : colors.faint, fontSize: compact ? 13 : 15 }]} numberOfLines={1}>
          {current ? current.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </TouchableOpacity>
      {!!error && <Text style={s.error}>{error}</Text>}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={s.modalBack}>
          <View style={[s.sheet, { paddingBottom: 12 + insets.bottom }]}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{label || placeholder}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            {searchable && (alwaysSearch || creatable || options.length > 8) && (
              <SearchBar value={q} onChangeText={setQ} placeholder={searchPlaceholder || (creatable ? 'Search or type a new one' : 'Search')} />
            )}
            {canCreate && (
              <TouchableOpacity style={[s.option, { gap: 10 }]} onPress={() => { onChange(typed, { value: typed, label: typed }); setOpen(false); setQ(''); }} testID="select-create">
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Text style={[s.optionText, { color: colors.primary, flex: 1 }]}>{createLabel} “{typed}”</Text>
              </TouchableOpacity>
            )}
            {action && (
              <TouchableOpacity style={[s.option, { gap: 10 }]} onPress={() => { setOpen(false); setQ(''); action.onPress(); }}>
                <Ionicons name={action.icon || 'add-circle'} size={22} color={colors.primary} />
                <Text style={[s.optionText, { color: colors.primary, flex: 1 }]}>{action.label}</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={list}
              keyExtractor={(o) => String(o.value)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={s.option} onPress={() => { onChange(item.value, item); setOpen(false); setQ(''); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionText}>{item.label}</Text>
                    {!!item.sub && <Text style={s.itemMeta}>{item.sub}</Text>}
                  </View>
                  {String(item.value) === String(value) && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={canCreate ? null : <Empty text="No matches" />}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Owner only: "All branches" or one branch. Renders nothing for other roles.
export function BranchFilter({ value, onChange, allowAll = true, style }) {
  const { isOwner, branches } = useAuth();
  if (!isOwner || branches.length < 2) return null;
  const options = [
    ...(allowAll ? [{ value: 0, label: 'All branches' }] : []),
    ...branches.map((b) => ({ value: b.id, label: b.name, sub: b.address })),
  ];
  return <SelectField compact value={value} options={options} onChange={onChange} placeholder="Choose branch" style={style} label={undefined} />;
}

// Owner / branch admin: who took the orders — everyone, online (customers), or one cashier / admin.
// value: '' | 'online' | user id. Renders nothing for other roles.
export function SellerFilter({ value, onChange, style }) {
  const { isStaff } = useAuth();
  const [sellers, setSellers] = useState([]);
  useEffect(() => {
    if (isStaff) api.sellers().then((r) => setSellers(r.sellers || [])).catch(() => {});
  }, [isStaff]);
  if (!isStaff) return null;
  const roleLabel = { owner: 'Owner', branch: 'Branch admin', cashier: 'Cashier' };
  const options = [
    { value: '', label: 'Taken by: everyone' },
    { value: 'online', label: 'Online (customers)' },
    ...sellers.map((u) => ({ value: String(u.id), label: u.name, sub: roleLabel[u.role] || u.role })),
  ];
  return (
    <SelectField compact value={value} options={options} onChange={(v) => onChange(String(v))} placeholder="Taken by"
      label={undefined} style={style} />
  );
}

// Owner forms: pick which branch a new record belongs to (only with 2+ branches)
export function BranchField({ value, onChange, error, label = 'Branch' }) {
  const { isOwner, branches } = useAuth();
  if (!isOwner || branches.length < 2) return null;
  return (
    <SelectField
      label={label}
      value={value}
      options={branches.filter((b) => b.status === 'active').map((b) => ({ value: b.id, label: `${b.name}${b.is_main ? ' (main)' : ''}`, sub: b.address }))}
      onChange={onChange}
      placeholder="Choose branch"
      error={error}
    />
  );
}

export function DateRangeBar({ value, onChange, presets = RANGE_PRESETS }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from || '');
  const [to, setTo] = useState(value.to || '');
  const valid = isYmd(from) && isYmd(to) && from <= to;
  return (
    <>
      <ChipRow>
        {presets.map((k) => (
          <Chip key={k} label={RANGE_LABELS[k]} active={value.key === k} onPress={() => onChange(rangeFor(k))} />
        ))}
        <Chip icon="calendar-outline" label={value.key === 'custom' ? rangeLabel(value) : 'Custom'} active={value.key === 'custom'} onPress={() => setOpen(true)} />
      </ChipRow>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={[s.modalBack, { justifyContent: 'center', padding: 24 }]}>
          <View style={[s.card, { padding: 18 }]}>
            <Text style={[s.sheetTitle, { marginBottom: 12 }]}>Custom dates</Text>
            <Field label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} placeholder="2026-11-01" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} placeholder="2026-11-30" autoCapitalize="none" keyboardType="numbers-and-punctuation"
              error={from && to && !valid ? 'Enter valid dates, From before To' : ''} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cancel" variant="outline" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button title="Apply" disabled={!valid} onPress={() => { onChange(rangeFor('custom', { from, to })); setOpen(false); }} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

/* ---------------- Styles ---------------- */

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.black },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  dot: { position: 'absolute', top: 0, right: 0, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  body: { padding: 14 },
  footer: { padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  btn: { height: 50, borderRadius: 25, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  btnSmall: { height: 38, borderRadius: 19, paddingHorizontal: 12 },
  btnText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 14,
    paddingHorizontal: 14, height: 48, fontSize: 15, color: colors.text, outlineStyle: 'none',
  },
  select: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { fontSize: 12, color: colors.danger, marginTop: 4 },
  hint: { fontSize: 12, color: colors.faint, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 17,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start',
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text, maxWidth: 220 },
  seg: { flexDirection: 'row', backgroundColor: '#e7ebf3', borderRadius: 12, padding: 3, marginBottom: 12 },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  segActive: { backgroundColor: '#fff' },
  segText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyText: { marginTop: 10, color: colors.muted, fontSize: 14, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', flexShrink: 1 },
  statValue: { fontSize: 19, fontWeight: '800', marginTop: 4 },
  statSub: { fontSize: 11, color: colors.faint, marginTop: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  kvLabel: { color: colors.muted, fontSize: 14 },
  kvValue: { fontSize: 14, fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  itemSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  itemMeta: { fontSize: 12, color: colors.faint, marginTop: 2 },
  itemRight: { fontSize: 15, fontWeight: '800' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 23,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 46, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, outlineStyle: 'none' },
  fab: {
    position: 'absolute', right: 18, height: 54, minWidth: 54, borderRadius: 27, backgroundColor: colors.brand,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  fabText: { color: colors.onBrand, fontWeight: '800', fontSize: 15 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, maxHeight: '80%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.black },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: 15, color: colors.text, fontWeight: '600' },
});

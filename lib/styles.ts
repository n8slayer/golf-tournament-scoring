import { StyleSheet } from 'react-native';

// Fairway palette. Text pairs checked for ≥4.5:1 contrast on bg/card.
export const colors = {
  bg: '#F2F5F1',
  card: '#FFFFFF',
  primary: '#123F2A', // header, headings
  accent: '#15803D', // buttons (white text 5.0:1)
  accentDark: '#0E5A30',
  accentSoft: '#E3F1E7',
  text: '#10261A',
  muted: '#4A5D51',
  danger: '#B3261E',
  under: '#B3261E', // under par: red, scorecard convention
  border: '#D6E0D9',
  sand: '#F4E9D0',
};

export const icon = { sm: 18, md: 22, lg: 28 };

// Shared native-stack header look for every navigator.
export const headerOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    boxShadow: '0 1px 3px rgba(16, 38, 26, 0.08)',
  },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  label: { fontSize: 13, color: colors.muted, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonTextSecondary: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.4 },
  linkText: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 24,
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.accent },
  pillText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  pillTextActive: { color: '#fff', fontWeight: '600', fontSize: 15 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

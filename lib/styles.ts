import { StyleSheet } from 'react-native';

// Dark navy + gold. Text pairs checked for ≥4.5:1 contrast on bg/card;
// team colours carry white text, gold carries navy text (onAccent).
export const colors = {
  bg: '#0B1626',
  card: '#13233A',
  cardAlt: '#0F1D31', // inputs, sunken areas
  primary: '#0E1B2E', // header / dark panels
  headBar: '#1B2F4B', // table header rows
  accent: '#C9A86A', // gold: primary buttons, active states, links (8.6:1 on bg)
  onAccent: '#0B1626', // text/icons on gold
  accentSoft: 'rgba(201, 168, 106, 0.15)',
  text: '#EEF2F7',
  muted: '#A3B1C2', // 7.1:1 on card
  danger: '#FF6B6B',
  under: '#FF6B6B', // under par: red, scorecard convention (brightened for dark)
  border: '#2A3D57',
  sand: '#C9A86A', // gold highlights (banners, rules)
  teamA: '#D93036', // red, white text 4.6:1
  teamB: '#2563EB', // blue, white text 5.2:1
  onTeam: '#FFFFFF',
  teamAText: '#FF8A8E', // team colours for text on dark cards (≥5:1)
  teamBText: '#8FB4FF',
  good: '#4ADE80', // finished / joined / money (9.6:1 on card)
  zebra: '#172A44',
  leadRow: 'rgba(201, 168, 106, 0.14)',
  avgRow: '#101E33',
};

export const icon = { sm: 18, md: 22, lg: 28 };

// Shared native-stack header look for every navigator.
export const headerOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
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
    backgroundColor: colors.cardAlt,
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
    backgroundColor: 'transparent',
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
  buttonText: { color: colors.onAccent, fontWeight: '800', fontSize: 16 },
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
  pillTextActive: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Small rounded tag, e.g. SKINS / FOUR BALL.
  chip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.zebra, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: colors.muted },
});

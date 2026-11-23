import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Link, Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon as iconSize } from '../lib/styles';

type IconName = keyof typeof Ionicons.glyphMap;

// Link + Pressable with press feedback. Link asChild drops function styles,
// so the pressed look lives on an inner View.
export function PressableLink({
  href,
  style,
  label,
  dismissTo,
  children,
}: {
  href: Href;
  dismissTo?: boolean; // go back to href if it's already in the stack, instead of pushing
  style: StyleProp<ViewStyle>;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} dismissTo={dismissTo} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label}>
        {({ pressed }) => <View style={[style, pressed && s.pressed]}>{children}</View>}
      </Pressable>
    </Link>
  );
}

// Tappable card row: icon badge, title, optional subtitle, chevron.
export function NavCard({ href, icon, title, subtitle }: { href: Href; icon: IconName; title: string; subtitle?: string }) {
  return (
    <PressableLink
      href={href}
      label={subtitle ? `${title}, ${subtitle}` : title}
      style={[s.card, s.row, { justifyContent: 'flex-start' }]}
    >
      <View style={s.iconBadge}>
        <Ionicons name={icon} size={iconSize.md} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? (
          <Text style={s.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.muted} />
    </PressableLink>
  );
}

import { useState } from 'react';
import { View, Text, Pressable, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon } from '../lib/styles';
import { Trip } from '../types/models';

// Native builds have no page origin; set EXPO_PUBLIC_SITE_URL to the production web address.
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://nate69-golf-app.expo.app';

export function joinLink(code: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  return `${origin}/join/${code}`;
}

// Invite card: link + QR (same link) + copy/share. The link is the key to the event.
export function ShareCard({ trip }: { trip: Trip }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!trip.sync) return null;
  const link = joinLink(trip.sync.inviteCode);

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = async () => {
    try {
      await Share.share({ message: `Join ${trip.name} on the golf trip app: ${link}`, url: link });
    } catch {
      await copy(); // browsers without a share sheet
    }
  };

  return (
    <View style={[s.card, { gap: 10 }]}>
      <View style={[s.row, { justifyContent: 'flex-start' }]}>
        <View style={s.iconBadge}>
          <Ionicons name="person-add" size={icon.md} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Invite players</Text>
          <Text style={s.subtitle}>Anyone with this link can join and enter scores.</Text>
        </View>
      </View>
      <Text style={[s.subtitle, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]} selectable numberOfLines={1}>
        {link}
      </Text>
      <View style={s.row}>
        <Pressable onPress={copy} accessibilityRole="button" style={({ pressed }) => [s.buttonSecondary, { flex: 1 }, pressed && s.pressed]}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={icon.sm} color={colors.accent} />
          <Text style={s.buttonTextSecondary}>{copied ? 'Copied' : 'Copy link'}</Text>
        </Pressable>
        <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => [s.button, { flex: 1 }, pressed && s.pressed]}>
          <Ionicons name="share-outline" size={icon.sm} color="#fff" />
          <Text style={s.buttonText}>Share</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => setShowQr((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showQr }}
        style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={s.linkText}>{showQr ? 'Hide QR code' : 'Show QR code for the first tee'}</Text>
      </Pressable>
      {showQr && (
        <View style={{ alignItems: 'center', padding: 12, backgroundColor: '#fff' }} accessibilityLabel={`QR code for ${link}`}>
          <QRCode value={link} size={200} color={colors.primary} backgroundColor="#fff" />
          <Text style={[s.subtitle, { marginTop: 8 }]}>Scan with a phone camera to join</Text>
        </View>
      )}
    </View>
  );
}

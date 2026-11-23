import { useState } from 'react';
import { View, Text, Pressable, Platform, Share, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon } from '../lib/styles';
import { Trip } from '../types/models';
import { useTrips } from '../context/TripsContext';
import { regenerateCode } from '../lib/sync';

// Native builds have no page origin; set EXPO_PUBLIC_SITE_URL to the production web address.
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://golf-tournament-scoring-jet.vercel.app';

export function joinLink(code: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  return `${origin}/join/${code}`;
}

// Invite card: link + QR (same link) + copy/share. The link is the key to the event.
export function ShareCard({ trip }: { trip: Trip }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const { isOwner, canEdit, refresh } = useTrips();
  if (!trip.sync) return null;
  const link = joinLink(trip.sync.inviteCode);
  const code = trip.sync.inviteCode.toUpperCase();

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const message = `Join ${trip.name} on the golf trip app: ${link}`;
  const share = async () => {
    try {
      await Share.share({ message, url: link });
    } catch {
      await copy(); // browsers without a share sheet
    }
  };
  // Opens the user's email app with the invite filled in (they add the addresses).
  const email = () =>
    Linking.openURL(
      `mailto:?subject=${encodeURIComponent(`You're invited: ${trip.name}`)}&body=${encodeURIComponent(
        `${message}

Open the link, sign in with your email (you'll get a code), then pick which player you are.`,
      )}`,
    ).catch(copy);

  // Organizers: one email to every player with an address (BCC), each signs in with that address.
  const invitees = canEdit(trip) ? trip.players.flatMap((p) => (p.email ? [p.email] : [])) : [];
  const emailAll = () =>
    Linking.openURL(
      `mailto:?bcc=${invitees.map(encodeURIComponent).join(',')}&subject=${encodeURIComponent(`You're invited: ${trip.name}`)}&body=${encodeURIComponent(
        `You're on the player list for ${trip.name}.

Open ${link} and sign in with THIS email address (you'll get a code). You'll go straight into the event as your player, ready to enter scores.

Join code: ${code}`,
      )}`,
    ).catch(copy);

  return (
    <View style={[s.card, { gap: 10 }]}>
      <View style={[s.row, { justifyContent: 'flex-start' }]}>
        <View style={s.iconBadge}>
          <Ionicons name="person-add" size={icon.md} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Invite players</Text>
          <Text style={s.subtitle}>Share the code or the link. Anyone with it can join and enter scores.</Text>
        </View>
      </View>
      <Text
        style={{ color: colors.accent, fontSize: 26, fontWeight: '800', letterSpacing: 6, textAlign: 'center' }}
        selectable
        accessibilityLabel={`Join code ${trip.sync.inviteCode.toUpperCase().split('').join(' ')}`}
      >
        {trip.sync.inviteCode.toUpperCase()}
      </Text>
      <Text style={[s.subtitle, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]} selectable numberOfLines={1}>
        {link}
      </Text>
      <View style={s.row}>
        <Pressable
          onPress={copy}
          accessibilityRole="button"
          style={({ pressed }) => [s.buttonSecondary, { flex: 1 }, pressed && s.pressed]}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={icon.sm} color={colors.accent} />
          <Text style={s.buttonTextSecondary}>{copied ? 'Copied' : 'Copy link'}</Text>
        </Pressable>
        <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => [s.button, { flex: 1 }, pressed && s.pressed]}>
          <Ionicons name="share-outline" size={icon.sm} color={colors.onAccent} />
          <Text style={s.buttonText}>Share</Text>
        </Pressable>
      </View>
      {invitees.length > 0 && (
        <Pressable onPress={emailAll} accessibilityRole="button" style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Ionicons name="mail" size={icon.sm} color={colors.onAccent} />
          <Text style={s.buttonText}>Email all players ({invitees.length})</Text>
        </Pressable>
      )}
      <Pressable onPress={email} accessibilityRole="button" style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]}>
        <Ionicons name="mail-outline" size={icon.sm} color={colors.accent} />
        <Text style={s.buttonTextSecondary}>Email invite</Text>
      </Pressable>
      {isOwner(trip) && trip.sync.inviteCode.length !== 6 && (
        <Pressable
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await regenerateCode(trip.id);
              await refresh();
            } finally {
              setBusy(false);
            }
          }}
          accessibilityRole="button"
          style={({ pressed }) => [s.buttonSecondary, busy && s.disabled, pressed && s.pressed]}
        >
          <Ionicons name="key-outline" size={icon.sm} color={colors.accent} />
          <Text style={s.buttonTextSecondary}>Get a short code (old link stops working)</Text>
        </Pressable>
      )}
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

import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon } from '../lib/styles';

// Type a join code (e.g. ABC123) → the join page. Case and spaces don't matter.
export function JoinCodeCard({ title = 'Got a code?' }: { title?: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const join = () => {
    const c = code.replace(/\s+/g, '');
    if (c.length < 4) return setError('Enter the code from your organizer.');
    router.push(`/join/${c}`);
  };
  return (
    <View style={[s.card, { gap: 10 }]}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>Your organizer can read it to you or text you the link.</Text>
      <TextInput
        style={[s.input, { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' }]}
        value={code}
        onChangeText={(v) => {
          setCode(v.toUpperCase());
          setError('');
        }}
        onSubmitEditing={join}
        placeholder="ABC123"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        accessibilityLabel="Join code"
      />
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <Pressable onPress={join} accessibilityRole="button" style={({ pressed }) => [s.button, pressed && s.pressed]}>
        <Ionicons name="enter-outline" size={icon.sm} color={colors.onAccent} />
        <Text style={s.buttonText}>Join event</Text>
      </Pressable>
    </View>
  );
}

import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { s, colors } from '../lib/styles';
import { parseHandicapIndex, MAX_INDEX, MAX_PLUS } from '../lib/handicap';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Name + handicap index with a "+ Plus" toggle (+ optional invite email); validates before calling onAdd.
export function PlayerForm({
  onAdd,
  buttonLabel = 'Add player',
  withEmail = false,
}: {
  onAdd: (name: string, handicapIndex: number, email?: string) => void;
  buttonLabel?: string;
  withEmail?: boolean;
}) {
  const [name, setName] = useState('');
  const [hcp, setHcp] = useState('');
  const [plus, setPlus] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return setError('Enter a name.');
    // The toggle and a typed "+" both mean plus handicap.
    const typedPlus = hcp.trim().startsWith('+');
    const handicapIndex = parseHandicapIndex((plus || typedPlus ? '+' : '') + hcp.trim().replace(/^\+/, ''));
    if (handicapIndex === null)
      return setError(`Handicap index must be between +${MAX_PLUS} and ${MAX_INDEX}, e.g. 12.4 or +5.4.`);
    if (withEmail && email.trim() && !EMAIL_RE.test(email.trim())) return setError('That email doesn’t look right.');
    onAdd(name.trim(), handicapIndex, withEmail && email.trim() ? email.trim().toLowerCase() : undefined);
    setName('');
    setEmail('');
    setHcp('');
    setPlus(false);
    setError('');
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Name</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Player name" accessibilityLabel="Player name" />
      <Text style={s.label}>Handicap index</Text>
      <View style={s.row}>
        <Pressable
          onPress={() => setPlus((v) => !v)}
          accessibilityRole="switch"
          accessibilityLabel="Plus handicap"
          accessibilityState={{ checked: plus }}
          style={[s.pill, { minHeight: 48 }, plus && s.pillActive]}
        >
          <Text style={plus ? s.pillTextActive : s.pillText}>+ Plus</Text>
        </Pressable>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={hcp}
          onChangeText={(v) => {
            setHcp(v);
            setError('');
          }}
          onSubmitEditing={submit}
          placeholder={plus ? 'e.g. 5.4 (plays as +5.4)' : 'e.g. 12.4'}
          accessibilityLabel="Handicap index"
          keyboardType="decimal-pad"
        />
      </View>
      <Text style={s.subtitle}>Up to {MAX_INDEX}. Tap “+ Plus” for a plus handicap.</Text>
      {withEmail && (
        <>
          <Text style={s.label}>Email (optional)</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError('');
            }}
            placeholder="their@email.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel="Player email"
          />
          <Text style={s.subtitle}>When they sign in with this email they’re put straight into the event as this player. Only organizers see it.</Text>
        </>
      )}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <Pressable style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]} onPress={submit} accessibilityRole="button">
        <Text style={s.buttonTextSecondary}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

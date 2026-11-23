import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { s, colors } from '../lib/styles';
import { parseHandicapIndex, MAX_INDEX, MAX_PLUS } from '../lib/handicap';

// Name + handicap index with a "+ Plus" toggle; validates before calling onAdd.
export function PlayerForm({ onAdd, buttonLabel = 'Add player' }: { onAdd: (name: string, handicapIndex: number) => void; buttonLabel?: string }) {
  const [name, setName] = useState('');
  const [hcp, setHcp] = useState('');
  const [plus, setPlus] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return setError('Enter a name.');
    // The toggle and a typed "+" both mean plus handicap.
    const typedPlus = hcp.trim().startsWith('+');
    const handicapIndex = parseHandicapIndex((plus || typedPlus ? '+' : '') + hcp.trim().replace(/^\+/, ''));
    if (handicapIndex === null)
      return setError(`Handicap index must be between +${MAX_PLUS} and ${MAX_INDEX}, e.g. 12.4 or +5.4.`);
    onAdd(name.trim(), handicapIndex);
    setName('');
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
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <Pressable style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]} onPress={submit} accessibilityRole="button">
        <Text style={s.buttonTextSecondary}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

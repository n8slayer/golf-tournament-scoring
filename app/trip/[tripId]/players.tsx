import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { s, colors } from '../../../lib/styles';
import { courseHandicap, parseHandicapIndex, formatHandicap, MAX_INDEX, MAX_PLUS } from '../../../lib/handicap';

export default function Players() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, addPlayer, removePlayer } = useTrips();
  const trip = getTrip(tripId);
  const [name, setName] = useState('');
  const [hcp, setHcp] = useState('');
  const [plus, setPlus] = useState(false);
  const [error, setError] = useState('');

  if (!trip) return null;

  const submit = () => {
    if (!name.trim()) return setError('Enter a name.');
    // The toggle and a typed "+" both mean plus handicap.
    const typedPlus = hcp.trim().startsWith('+');
    const handicapIndex = parseHandicapIndex((plus || typedPlus ? '+' : '') + hcp.trim().replace(/^\+/, ''));
    if (handicapIndex === null)
      return setError(`Handicap index must be between +${MAX_PLUS} and ${MAX_INDEX}, e.g. 12.4 or +5.4.`);
    addPlayer(tripId, name.trim(), handicapIndex);
    setName('');
    setHcp('');
    setPlus(false);
    setError('');
  };

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trip.players}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
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
                placeholder={plus ? 'e.g. 5.4 (plays as +5.4)' : 'e.g. 12.4'}
                accessibilityLabel="Handicap index"
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={s.subtitle}>Up to {MAX_INDEX}. Tap “+ Plus” for a plus handicap.</Text>
            {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
            <Pressable style={s.button} onPress={submit} accessibilityRole="button">
              <Text style={s.buttonText}>Add player</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={<Text style={s.subtitle}>No players yet.</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, s.row]}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.name}</Text>
              <Text style={s.subtitle}>
                Index {formatHandicap(item.handicapIndex)}
                {trip.courses
                  .filter((c) => c.slope)
                  .map((c) => ` · ${trip.courses.length > 1 ? c.name : 'Course'} HCP ${formatHandicap(courseHandicap(item.handicapIndex, c))}`)
                  .join('')}
              </Text>
            </View>
            <Pressable
              onPress={() => removePlayer(tripId, item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

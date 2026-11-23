import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { holeNumbersFor } from '../../../../../lib/holeRanges';
import { s } from '../../../../../lib/styles';

export default function Score() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip, recordScore } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  const holes = round ? holeNumbersFor(round.holesPlayed) : [];
  const [index, setIndex] = useState(0);

  if (!trip || !round) return null;

  const holeNumber = holes[index];
  const hole = trip.course.holes.find((h) => h.number === holeNumber)!;
  const players = trip.players.filter((p) => round.playerIds.includes(p.id));

  const scoreFor = (playerId: string) =>
    trip.scores.find((sc) => sc.roundId === roundId && sc.playerId === playerId && sc.holeNumber === holeNumber);

  return (
    <View style={s.screen}>
      <View style={s.content}>
        <View style={s.row}>
          <Pressable
            style={s.buttonSecondary}
            disabled={index === 0}
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <Text style={s.buttonTextSecondary}>← Prev</Text>
          </Pressable>
          <Text style={s.title}>
            Hole {holeNumber} · Par {hole.par}
          </Text>
          <Pressable
            style={s.buttonSecondary}
            disabled={index === holes.length - 1}
            onPress={() => setIndex((i) => Math.min(holes.length - 1, i + 1))}
          >
            <Text style={s.buttonTextSecondary}>Next →</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ gap: 10 }}>
          {players.map((p) => {
            const sc = scoreFor(p.id);
            return (
              <View key={p.id} style={[s.card, s.row]}>
                <Text style={s.title}>{p.name}</Text>
                <TextInput
                  style={[s.input, { width: 70, textAlign: 'center' }]}
                  value={sc ? String(sc.strokes) : ''}
                  placeholder="–"
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    const strokes = parseInt(v, 10);
                    if (!Number.isNaN(strokes)) recordScore(tripId, roundId, p.id, holeNumber, strokes);
                  }}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

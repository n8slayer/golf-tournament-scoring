import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { s } from '../../../lib/styles';

export default function Players() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, addPlayer, removePlayer } = useTrips();
  const trip = getTrip(tripId);
  const [name, setName] = useState('');
  const [hcp, setHcp] = useState('');

  if (!trip) return null;

  const submit = () => {
    const handicapIndex = parseFloat(hcp);
    if (!name.trim() || Number.isNaN(handicapIndex)) return;
    addPlayer(tripId, name.trim(), handicapIndex);
    setName('');
    setHcp('');
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
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Player name" />
            <Text style={s.label}>Handicap index</Text>
            <TextInput
              style={s.input}
              value={hcp}
              onChangeText={setHcp}
              placeholder="e.g. 12.4"
              keyboardType="decimal-pad"
            />
            <Pressable style={s.button} onPress={submit}>
              <Text style={s.buttonText}>+ Add Player</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={<Text style={s.subtitle}>No players yet.</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, s.row]}>
            <View>
              <Text style={s.title}>{item.name}</Text>
              <Text style={s.subtitle}>HCP {item.handicapIndex}</Text>
            </View>
            <Pressable onPress={() => removePlayer(tripId, item.id)}>
              <Text style={{ color: '#b3261e', fontWeight: '600' }}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

import { useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTrips } from '../../../../context/TripsContext';
import { HolesPlayed } from '../../../../types/models';
import { s } from '../../../../lib/styles';

const HOLE_OPTIONS: { value: HolesPlayed; label: string }[] = [
  { value: 'front9', label: 'Front 9' },
  { value: 'back9', label: 'Back 9' },
  { value: '18', label: '18 holes' },
];

export default function NewRound() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, createRound } = useTrips();
  const trip = getTrip(tripId);
  const router = useRouter();

  const [name, setName] = useState('Round 1');
  const [holesPlayed, setHolesPlayed] = useState<HolesPlayed>('18');
  const [selected, setSelected] = useState<string[]>(trip?.players.map((p) => p.id) ?? []);
  const [skinsEnabled, setSkinsEnabled] = useState(true);
  const [skinValue, setSkinValue] = useState('5');
  const [matchEnabled, setMatchEnabled] = useState(true);
  const [matchStake, setMatchStake] = useState('20');

  if (!trip) return null;

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (!name.trim() || selected.length === 0) return;
    const id = createRound(tripId, {
      name: name.trim(),
      date: new Date().toISOString(),
      holesPlayed,
      skinsEnabled,
      skinValue: parseFloat(skinValue) || 0,
      matchEnabled,
      matchStake: parseFloat(matchStake) || 0,
      playerIds: selected,
    });
    router.replace(`/trip/${tripId}/rounds/${id}`);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.label}>Round name</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} />

      <Text style={s.label}>Holes</Text>
      <View style={s.pillRow}>
        {HOLE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[s.pill, holesPlayed === opt.value && s.pillActive]}
            onPress={() => setHolesPlayed(opt.value)}
          >
            <Text style={holesPlayed === opt.value ? s.pillTextActive : s.pillText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Players in this round</Text>
      <View style={s.pillRow}>
        {trip.players.map((p) => (
          <Pressable
            key={p.id}
            style={[s.pill, selected.includes(p.id) && s.pillActive]}
            onPress={() => toggleSelected(p.id)}
          >
            <Text style={selected.includes(p.id) ? s.pillTextActive : s.pillText}>{p.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.row, { marginTop: 8 }]}>
        <Text style={s.label}>Skins</Text>
        <Switch value={skinsEnabled} onValueChange={setSkinsEnabled} />
      </View>
      {skinsEnabled && (
        <View>
          <Text style={s.label}>$ per skin</Text>
          <TextInput style={s.input} value={skinValue} onChangeText={setSkinValue} keyboardType="decimal-pad" />
        </View>
      )}

      <View style={s.row}>
        <Text style={s.label}>Match Play</Text>
        <Switch value={matchEnabled} onValueChange={setMatchEnabled} />
      </View>
      {matchEnabled && (
        <View>
          <Text style={s.label}>$ per match</Text>
          <TextInput style={s.input} value={matchStake} onChangeText={setMatchStake} keyboardType="decimal-pad" />
        </View>
      )}

      <Pressable style={[s.button, { marginTop: 12 }]} onPress={submit}>
        <Text style={s.buttonText}>Create Round</Text>
      </Pressable>
    </ScrollView>
  );
}

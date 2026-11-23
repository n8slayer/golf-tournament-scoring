import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTrips } from '../../context/TripsContext';
import { s } from '../../lib/styles';

export default function NewTrip() {
  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const { addTrip } = useTrips();
  const router = useRouter();

  const canSubmit = name.trim().length > 0 && courseName.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const id = addTrip(name.trim(), courseName.trim());
    router.replace(`/trip/${id}`);
  };

  return (
    <View style={s.screen}>
      <View style={s.content}>
        <Text style={s.label}>Trip name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Myrtle Beach 2026" />
        <Text style={s.label}>Course name</Text>
        <TextInput style={s.input} value={courseName} onChangeText={setCourseName} placeholder="e.g. Barefoot Resort" />
        <Pressable style={[s.button, !canSubmit && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit}>
          <Text style={s.buttonText}>Create Trip</Text>
        </Pressable>
      </View>
    </View>
  );
}

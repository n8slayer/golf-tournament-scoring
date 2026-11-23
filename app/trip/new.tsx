import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../context/TripsContext';
import { CourseSearch, courseSummary } from '../../components/CourseSearch';
import { s, colors, icon } from '../../lib/styles';
import { NewCourse } from '../../types/models';

export default function NewTrip() {
  const [name, setName] = useState('');
  const [courses, setCourses] = useState<NewCourse[]>([]);
  const { addTrip } = useTrips();
  const router = useRouter();

  const canSubmit = name.trim().length > 0 && courses.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const id = addTrip(name.trim(), courses);
    router.replace(`/trip/${id}`);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Trip name</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Myrtle Beach 2026"
        accessibilityLabel="Trip name"
      />

      <Text style={[s.label, { marginTop: 8 }]}>Courses ({courses.length})</Text>
      {courses.length === 0 && (
        <Text style={s.subtitle}>Add every course you're playing. Each round is scored on its own course.</Text>
      )}
      {courses.map((c, i) => (
        <View key={`${c.name}-${c.tee}-${i}`} style={[s.card, s.row, { justifyContent: 'flex-start' }]}>
          <View style={s.iconBadge}>
            <Ionicons name="flag" size={icon.md} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.title}>{c.name}</Text>
            <Text style={s.subtitle}>{courseSummary(c)}</Text>
          </View>
          <Pressable
            onPress={() => setCourses((prev) => prev.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${c.name}`}
            style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && s.pressed]}
          >
            <Ionicons name="close" size={icon.md} color={colors.muted} />
          </Pressable>
        </View>
      ))}

      <CourseSearch
        title={courses.length ? 'Add another course' : 'Add a course'}
        onAdd={(c) => setCourses((prev) => [...prev, c])}
      />

      <Pressable
        style={({ pressed }) => [s.button, { marginTop: 8 }, !canSubmit && s.disabled, pressed && s.pressed]}
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
      >
        <Text style={s.buttonText}>Create trip</Text>
      </Pressable>
      {!canSubmit && (
        <Text style={[s.subtitle, { textAlign: 'center' }]}>
          {name.trim() ? 'Add at least one course.' : 'Name your trip and add at least one course.'}
        </Text>
      )}
    </ScrollView>
  );
}

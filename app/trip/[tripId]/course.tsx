import { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { CourseSearch, courseSummary } from '../../../components/CourseSearch';
import { s, colors } from '../../../lib/styles';

export default function CourseSetup() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, updateHole, addCourse, removeCourse, canEdit: canEditTrip } = useTrips();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trip = getTrip(tripId);
  if (!trip) return null;

  const course = trip.courses.find((c) => c.id === selectedId) ?? trip.courses[0];
  const canEdit = canEditTrip(trip);
  const inUse = trip.rounds.some((r) => r.courseId === course?.id);

  const header = (
    <View style={{ gap: 12 }}>
      {canEdit ? (
        <CourseSearch title="Add a course to this trip" onAdd={(c) => setSelectedId(addCourse(tripId, c))} />
      ) : (
        <Text style={s.subtitle}>Only organizers can change courses and scorecards.</Text>
      )}

      <Text style={[s.label, { marginTop: 8 }]}>Trip courses ({trip.courses.length})</Text>
      <View style={s.pillRow}>
        {trip.courses.map((c) => {
          const active = c.id === course?.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setSelectedId(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[s.pill, active && s.pillActive]}
            >
              <Text style={active ? s.pillTextActive : s.pillText}>
                {c.name}
                {c.tee ? ` · ${c.tee}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {course && (
        <View style={{ gap: 4 }}>
          <Text style={s.title}>{course.name}</Text>
          <Text style={s.subtitle}>{courseSummary(course)}</Text>
          <Text style={s.subtitle}>Par and stroke index (1 = hardest) can be edited below.</Text>
          {canEdit && trip.courses.length > 1 &&
            (inUse ? (
              <Text style={s.subtitle}>Rounds are scored on this course, so it can't be removed.</Text>
            ) : (
              <Pressable
                onPress={() => {
                  removeCourse(tripId, course.id);
                  setSelectedId(null);
                }}
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove this course</Text>
              </Pressable>
            ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={course?.holes ?? []}
        keyExtractor={(h) => `${course?.id}-${h.number}`}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={[s.card, s.row]}>
            <View style={{ width: 70 }}>
              <Text style={s.title}>#{item.number}</Text>
              {item.yardage ? <Text style={s.subtitle}>{item.yardage} yds</Text> : null}
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.label}>Par</Text>
              <TextInput
                style={[s.input, { width: 60, textAlign: 'center' }]}
                value={String(item.par)}
                onChangeText={(v) => {
                  const par = parseInt(v, 10);
                  if (!Number.isNaN(par)) updateHole(tripId, course.id, item.number, { par });
                }}
                keyboardType="number-pad"
                editable={canEdit}
                accessibilityLabel={`Hole ${item.number} par`}
              />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.label}>Stroke Idx</Text>
              <TextInput
                style={[s.input, { width: 60, textAlign: 'center' }]}
                value={String(item.strokeIndex)}
                onChangeText={(v) => {
                  const strokeIndex = parseInt(v, 10);
                  if (!Number.isNaN(strokeIndex)) updateHole(tripId, course.id, item.number, { strokeIndex });
                }}
                keyboardType="number-pad"
                editable={canEdit}
                accessibilityLabel={`Hole ${item.number} stroke index`}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

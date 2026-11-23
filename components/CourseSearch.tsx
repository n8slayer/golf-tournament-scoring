import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon } from '../lib/styles';
import { NewCourse } from '../types/models';
import {
  searchCourses,
  getCourse,
  isUsableTee,
  teeToHoles,
  blankCourse,
  COURSE_API_MOCK,
  CourseSummary,
  CourseDetail,
} from '../lib/courseApi';

const courseName = (c: CourseSummary) =>
  c.club_name === c.course_name ? c.club_name : `${c.club_name} – ${c.course_name}`;

// Search GolfCourseAPI → pick course → pick tee → onAdd(course with holes, slope, rating).
export function CourseSearch({ onAdd, title = 'Add a course' }: { onAdd: (course: NewCourse) => void; title?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseSummary[] | null>(null);
  const [picked, setPicked] = useState<CourseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPicked(null);
    setResults(null);
    setQuery('');
  };

  const search = () =>
    query.trim() &&
    run(async () => {
      setPicked(null);
      setResults(await searchCourses(query.trim()));
    });

  const pick = (c: CourseSummary) => run(async () => setPicked(await getCourse(c.id)));

  const tees = picked
    ? [
        ...(picked.tees.male ?? []).map((t) => ({ tee: t, label: `${t.tee_name} (M)` })),
        ...(picked.tees.female ?? []).map((t) => ({ tee: t, label: `${t.tee_name} (W)` })),
      ].filter((t) => isUsableTee(t.tee))
    : [];

  return (
    <View style={s.card}>
      <Text style={s.label}>{title}</Text>
      {COURSE_API_MOCK && (
        <Text style={[s.subtitle, { color: colors.danger, fontWeight: '700' }]}>
          Test mode: sample courses only, no API requests used.
        </Text>
      )}
      <View style={s.row}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search courses, e.g. Pebble Beach"
          onSubmitEditing={search}
          returnKeyType="search"
          accessibilityLabel="Course name"
        />
        <Pressable
          style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]}
          onPress={search}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={icon.sm} color="#fff" />
        </Pressable>
      </View>
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}

      {!picked && results?.length === 0 && <Text style={s.subtitle}>No courses found.</Text>}
      {!picked &&
        results?.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => pick(c)}
            accessibilityRole="button"
            style={({ pressed }) => [{ paddingVertical: 8, minHeight: 44 }, pressed && s.pressed]}
          >
            <Text style={s.linkText}>{courseName(c)}</Text>
            <Text style={s.subtitle}>
              {[c.location?.city, c.location?.state, c.location?.country].filter(Boolean).join(', ')}
            </Text>
          </Pressable>
        ))}
      {!picked && results !== null && query.trim() !== '' && (
        <Pressable
          onPress={() => {
            onAdd(blankCourse(query.trim()));
            reset();
          }}
          accessibilityRole="button"
          style={{ paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={s.linkText}>Not listed? Add “{query.trim()}” and enter the scorecard by hand</Text>
        </Pressable>
      )}

      {picked && (
        <>
          <Text style={s.title}>{courseName(picked)}</Text>
          {tees.length === 0 ? (
            <Text style={s.subtitle}>No 18-hole scorecard available for this course.</Text>
          ) : (
            <>
              <Text style={s.label}>Pick your tees</Text>
              <View style={s.pillRow}>
                {tees.map(({ tee, label }) => (
                  <Pressable
                    key={label}
                    style={({ pressed }) => [s.pill, pressed && s.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${label} tees`}
                    onPress={() => {
                      onAdd({
                        name: courseName(picked),
                        holes: teeToHoles(tee),
                        tee: label,
                        slope: tee.slope_rating,
                        rating: tee.course_rating,
                      });
                      reset();
                    }}
                  >
                    <Text style={s.pillText}>
                      {label}
                      {tee.total_yards ? ` · ${tee.total_yards}y` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Pressable onPress={() => setPicked(null)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={s.linkText}>← Back to results</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// One-line summary used wherever a course is listed.
export function courseSummary(c: NewCourse): string {
  const par = c.holes.reduce((sum, h) => sum + h.par, 0);
  const yards = c.holes.reduce((sum, h) => sum + (h.yardage ?? 0), 0);
  return [
    c.tee ? `${c.tee} tees` : 'Scorecard entered by hand',
    `Par ${par}`,
    yards ? `${yards} yds` : null,
    c.rating && c.slope ? `${c.rating} / ${c.slope}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

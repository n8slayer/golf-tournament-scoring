import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, Course } from '../types/models';

const KEY = 'golf-trip-app:v1';

export interface AppState {
  trips: Trip[];
}

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(KEY);
  const state: AppState = raw ? JSON.parse(raw) : { trips: [] };
  return { trips: state.trips.map(migrateTrip) };
}

// Trips saved before multi-course support had a single `course` and rounds without courseId.
export function migrateTrip(trip: Trip & { course?: Omit<Course, 'id'> & { id?: string } }): Trip {
  const { course, ...rest } = trip;
  const courses = trip.courses ?? (course ? [{ ...course, id: course.id ?? `c-${trip.id}` }] : []);
  return {
    ...rest,
    courses,
    rounds: trip.rounds.map((r) => ({ ...r, courseId: r.courseId ?? courses[0]?.id })),
  };
}

function selfCheck() {
  const legacy = {
    id: 't',
    name: 'T',
    createdAt: '',
    players: [],
    teams: [],
    course: { name: 'Old', holes: [] },
    rounds: [{ id: 'r', name: 'R', date: '', holesPlayed: '18', skinsEnabled: false, skinValue: 0, matchEnabled: false, matchStake: 0, playerIds: [] }],
    scores: [],
  } as unknown as Trip;
  const m = migrateTrip(legacy);
  console.assert(m.courses.length === 1 && m.courses[0].name === 'Old', 'storage: legacy course moved to courses');
  console.assert(m.rounds[0].courseId === m.courses[0].id, 'storage: legacy round points at migrated course');
  console.assert(!('course' in m), 'storage: legacy course field dropped');
}
selfCheck();

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

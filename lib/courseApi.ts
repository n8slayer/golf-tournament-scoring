import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hole, NewCourse } from '../types/models';
import { FIXTURE_COURSES } from './courseFixtures';

// GolfCourseAPI (golfcourseapi.com). Free tier: 35 requests/day.
// shortcut: key is inlined into the public web bundle, so anyone can use up the quota; move behind an EAS API route if that happens.
const BASE = 'https://api.golfcourseapi.com/v1';
const KEY = process.env.EXPO_PUBLIC_GOLF_COURSE_API_KEY;
// Test mode: sample courses, no API requests. Set EXPO_PUBLIC_COURSE_API_MOCK=1 in .env.local.
export const COURSE_API_MOCK = process.env.EXPO_PUBLIC_COURSE_API_MOCK === '1';
const CACHE_PREFIX = 'golfcourseapi:v1:';
const CACHE_DAYS = 30;

export interface CourseSummary {
  id: string;
  club_name: string;
  course_name: string;
  location?: { city?: string; state?: string; country?: string };
}

export interface TeeBox {
  tee_name: string;
  course_rating?: number;
  slope_rating?: number;
  total_yards?: number;
  par_total?: number;
  holes: { par: number; yardage?: number; handicap?: number }[];
}

export interface CourseDetail extends CourseSummary {
  tees: { male?: TeeBox[]; female?: TeeBox[] };
}

// Successful lookups are cached on the device so repeat searches/picks cost no requests.
async function get<T>(path: string): Promise<T> {
  const cacheKey = CACHE_PREFIX + path.toLowerCase();
  try {
    const hit = await AsyncStorage.getItem(cacheKey);
    if (hit) {
      const { at, data } = JSON.parse(hit);
      if (Date.now() - at < CACHE_DAYS * 86400000) return data as T;
    }
  } catch {
    // cache unavailable (private window etc.): fall through to the network
  }
  if (!KEY) throw new Error('Missing EXPO_PUBLIC_GOLF_COURSE_API_KEY in .env.local');
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } });
  if (res.status === 429) throw new Error('Daily course lookup limit reached. Try again tomorrow.');
  if (!res.ok) throw new Error(`Course lookup failed (${res.status})`);
  const data = await res.json();
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore: caching is best-effort
  }
  return data as T;
}

export async function searchCourses(query: string): Promise<CourseSummary[]> {
  if (COURSE_API_MOCK) {
    const q = query.trim().toLowerCase();
    const hits = FIXTURE_COURSES.filter((c) => `${c.club_name} ${c.course_name}`.toLowerCase().includes(q));
    return hits.length ? hits : FIXTURE_COURSES; // any search shows the samples
  }
  const data = await get<{ courses?: CourseSummary[] }>(`/search?search_query=${encodeURIComponent(query)}`);
  return data.courses ?? [];
}

// The live API wraps the course as { course: {...} } (the published spec doesn't).
export async function getCourse(id: string): Promise<CourseDetail> {
  const fixture = FIXTURE_COURSES.find((c) => c.id === id);
  if (COURSE_API_MOCK && fixture) return fixture;
  const data = await get<{ course?: CourseDetail } & Partial<CourseDetail>>(`/courses/${encodeURIComponent(id)}`);
  const course = (data.course ?? data) as CourseDetail;
  return { ...course, tees: course.tees ?? {} };
}

// Hand-entered fallback: par 4 everywhere, stroke index in hole order; edit on the course screen.
export function blankCourse(name: string): NewCourse {
  return { name, holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })) };
}

// Only 18-hole tees: the app's Course is always 18 holes.
export function isUsableTee(tee: TeeBox): boolean {
  return tee.holes?.length === 18;
}

// Falls back to hole order when the API has no valid, unique stroke index set.
export function teeToHoles(tee: TeeBox): Hole[] {
  const idx = tee.holes.map((h) => h.handicap ?? 0);
  const valid = new Set(idx).size === 18 && idx.every((n) => n >= 1 && n <= 18);
  return tee.holes.map((h, i) => ({ number: i + 1, par: h.par || 4, strokeIndex: valid ? idx[i] : i + 1, yardage: h.yardage }));
}

function selfCheck() {
  const holes = Array.from({ length: 18 }, (_, i) => ({ par: 3 + (i % 3), handicap: 18 - i }));
  const out = teeToHoles({ tee_name: 'Blue', holes });
  console.assert(out[0].strokeIndex === 18 && out[17].strokeIndex === 1, 'courseApi: keeps API stroke index');
  console.assert(out[1].par === 4 && out[0].number === 1, 'courseApi: maps par and hole number');
  const dup = teeToHoles({ tee_name: 'X', holes: holes.map((h) => ({ ...h, handicap: 1 })) });
  console.assert(dup[5].strokeIndex === 6, 'courseApi: falls back to hole order on bad stroke index');
}
selfCheck();
